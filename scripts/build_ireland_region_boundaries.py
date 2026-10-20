#!/usr/bin/env python3
"""Build browser-safe selected-region boundary GeoJSON from exact OSM relations.

The output is presentation geometry only. It does not create parking records,
change access, infer capacity, or imply complete real-world parking coverage.
"""

from __future__ import annotations

import argparse
import json
import math
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Sequence, Tuple

ENDPOINTS = (
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
)
USER_AGENT = "WHITEBLOCK/1.0 Ireland-selected-region-boundaries"
Point = List[float]
Ring = List[Point]


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def load_config(path: Path) -> Dict[str, Any]:
    config = json.loads(path.read_text(encoding="utf-8"))
    regions = config.get("regions")
    if not isinstance(regions, list) or not regions:
        raise ValueError("Boundary config must contain a non-empty regions list")
    seen = set()
    for row in regions:
        key = str(row.get("key", "")).strip().lower()
        relation_id = int(row.get("relation_id", 0))
        if not key or relation_id <= 0 or key in seen:
            raise ValueError("Each region needs a unique key and positive relation_id")
        seen.add(key)
    return config


def overpass_query(relation_ids: Sequence[int]) -> str:
    selectors = "\n".join(f"rel({relation_id});" for relation_id in relation_ids)
    return f"""[out:json][timeout:120];
(
{selectors}
);
out tags geom;
"""


def fetch_relations(relation_ids: Sequence[int]) -> Dict[str, Any]:
    body = urllib.parse.urlencode({"data": overpass_query(relation_ids)}).encode("utf-8")
    errors: List[str] = []
    for endpoint in ENDPOINTS:
        request = urllib.request.Request(
            endpoint,
            data=body,
            headers={"User-Agent": USER_AGENT, "Content-Type": "application/x-www-form-urlencoded"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=150) as response:
                payload = json.load(response)
            if not payload.get("elements"):
                raise ValueError("empty Overpass elements")
            return payload
        except Exception as exc:  # pragma: no cover - exercised through CI/network
            errors.append(f"{endpoint}: {exc}")
    raise RuntimeError("All boundary Overpass endpoints failed: " + " | ".join(errors))


def same_point(a: Point, b: Point, tolerance: float = 1e-7) -> bool:
    return abs(a[0] - b[0]) <= tolerance and abs(a[1] - b[1]) <= tolerance


def member_segment(member: Dict[str, Any]) -> Ring:
    geometry = member.get("geometry") or []
    segment = []
    for point in geometry:
        try:
            lon = float(point["lon"])
            lat = float(point["lat"])
        except (KeyError, TypeError, ValueError):
            continue
        segment.append([lon, lat])
    return segment if len(segment) >= 2 else []


def stitch_rings(segments: Iterable[Ring]) -> List[Ring]:
    remaining = [segment[:] for segment in segments if len(segment) >= 2]
    rings: List[Ring] = []
    while remaining:
        ring = remaining.pop(0)
        guard = 0
        while not same_point(ring[0], ring[-1]):
            guard += 1
            if guard > 10000:
                raise ValueError("Boundary ring stitching exceeded safety limit")
            match_index = None
            reverse = False
            prepend = False
            for index, segment in enumerate(remaining):
                if same_point(ring[-1], segment[0]):
                    match_index = index
                    break
                if same_point(ring[-1], segment[-1]):
                    match_index = index
                    reverse = True
                    break
                if same_point(ring[0], segment[-1]):
                    match_index = index
                    prepend = True
                    break
                if same_point(ring[0], segment[0]):
                    match_index = index
                    reverse = True
                    prepend = True
                    break
            if match_index is None:
                raise ValueError("OSM boundary members did not form a closed ring")
            segment = remaining.pop(match_index)
            if reverse:
                segment.reverse()
            if prepend:
                ring = segment[:-1] + ring
            else:
                ring.extend(segment[1:])
        if len(ring) < 4:
            raise ValueError("Boundary ring has fewer than four coordinates")
        ring[-1] = ring[0][:]
        rings.append(ring)
    return rings


def perpendicular_distance(point: Point, start: Point, end: Point) -> float:
    if same_point(start, end):
        return math.hypot(point[0] - start[0], point[1] - start[1])
    dx = end[0] - start[0]
    dy = end[1] - start[1]
    numerator = abs(dy * point[0] - dx * point[1] + end[0] * start[1] - end[1] * start[0])
    return numerator / math.hypot(dx, dy)


def douglas_peucker(points: Ring, tolerance: float) -> Ring:
    if len(points) <= 2:
        return points[:]
    max_distance = 0.0
    max_index = 0
    for index in range(1, len(points) - 1):
        distance = perpendicular_distance(points[index], points[0], points[-1])
        if distance > max_distance:
            max_distance = distance
            max_index = index
    if max_distance <= tolerance:
        return [points[0], points[-1]]
    left = douglas_peucker(points[: max_index + 1], tolerance)
    right = douglas_peucker(points[max_index:], tolerance)
    return left[:-1] + right


def simplify_ring(ring: Ring, tolerance: float = 0.00035) -> Ring:
    open_ring = ring[:-1]
    if len(open_ring) <= 8:
        return ring
    # Simplify two arcs rather than a closed line with identical endpoints.
    midpoint = len(open_ring) // 2
    first = douglas_peucker(open_ring[: midpoint + 1], tolerance)
    second = douglas_peucker(open_ring[midpoint:] + [open_ring[0]], tolerance)
    simplified = first[:-1] + second
    if len(simplified) < 4:
        return ring
    if not same_point(simplified[0], simplified[-1]):
        simplified.append(simplified[0][:])
    return simplified


def point_in_ring(point: Point, ring: Ring) -> bool:
    x, y = point
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if ((yi > y) != (yj > y)):
            denominator = (yj - yi) or 1e-12
            x_cross = (xj - xi) * (y - yi) / denominator + xi
            if x < x_cross:
                inside = not inside
        j = i
    return inside


def relation_geometry(element: Dict[str, Any]) -> Dict[str, Any]:
    outer_segments: List[Ring] = []
    inner_segments: List[Ring] = []
    for member in element.get("members", []):
        segment = member_segment(member)
        if not segment:
            continue
        role = str(member.get("role", "")).lower()
        if role == "inner":
            inner_segments.append(segment)
        else:
            outer_segments.append(segment)

    outers = [simplify_ring(ring) for ring in stitch_rings(outer_segments)]
    inners = [simplify_ring(ring) for ring in stitch_rings(inner_segments)] if inner_segments else []
    if not outers:
        raise ValueError(f"Relation {element.get('id')} has no closed outer boundary")

    polygons: List[List[Ring]] = [[outer] for outer in outers]
    for inner in inners:
        point = inner[0]
        target = next((polygon for polygon in polygons if point_in_ring(point, polygon[0])), None)
        if target is not None:
            target.append(inner)

    if len(polygons) == 1:
        return {"type": "Polygon", "coordinates": polygons[0]}
    return {"type": "MultiPolygon", "coordinates": polygons}


def build_feature_collection(config: Dict[str, Any], payload: Dict[str, Any]) -> Dict[str, Any]:
    relations = {
        int(element["id"]): element
        for element in payload.get("elements", [])
        if element.get("type") == "relation" and element.get("id") is not None
    }
    features = []
    for region in config["regions"]:
        relation_id = int(region["relation_id"])
        element = relations.get(relation_id)
        if not element:
            raise ValueError(f"Missing OSM relation {relation_id} for {region['key']}")
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "region_key": str(region["key"]).lower(),
                    "label": region.get("label") or element.get("tags", {}).get("name") or region["key"],
                    "osm_relation_id": relation_id,
                    "admin_level": int(config.get("admin_level", 6)),
                    "source": config.get("source", "OpenStreetMap"),
                    "license": config.get("license", "ODbL"),
                    "fetched_at": utc_now(),
                },
                "geometry": relation_geometry(element),
            }
        )
    return {"type": "FeatureCollection", "features": features}


def main() -> None:
    parser = argparse.ArgumentParser(description="Build selected-region administrative boundary GeoJSON")
    parser.add_argument("--config", type=Path, default=Path("config/ireland_region_boundaries.json"))
    parser.add_argument("--output", type=Path, default=Path("web/data/ireland_region_boundaries.geojson"))
    args = parser.parse_args()

    config = load_config(args.config)
    relation_ids = [int(row["relation_id"]) for row in config["regions"]]
    payload = fetch_relations(relation_ids)
    collection = build_feature_collection(config, payload)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(collection, separators=(",", ":")), encoding="utf-8")
    print("WHITEBLOCK selected-region boundaries:", ", ".join(
        f"{feature['properties']['region_key']}=r{feature['properties']['osm_relation_id']}"
        for feature in collection["features"]
    ))


if __name__ == "__main__":
    main()
