#!/usr/bin/env python3
"""Build a browser-safe County Cork parking network snapshot.

Primary parking source:
- OpenStreetMap parking inventory through Overpass (ODbL)

Coverage reference:
- Cork County Council CDP2022 Development Boundaries (CC BY 4.0)

The Cork City Council real-time feed remains a separate, higher-authority live
availability source. This county snapshot is inventory/network coverage only and
never fabricates available-space values.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]

CORK_COUNTY_DEVELOPMENT_BOUNDARIES_URL = (
    "https://services-eu1.arcgis.com/FxGqwVH8IzS7QaUY/arcgis/rest/services/"
    "Development_Boundaries_CDP22/FeatureServer"
)

# Geographic envelope used only as a browser-side fallback/metadata envelope.
# Parking retrieval itself uses the OSM County Cork administrative area.
CORK_COUNTY_BOUNDS = {
    "south": 51.40,
    "west": -10.72,
    "north": 52.40,
    "east": -7.72,
}

USER_AGENT = "WHITEBLOCK/1.0 county-cork-parking-ingestion (public research prototype)"


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso_z(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def fetch_json(url: str, *, data: Optional[bytes] = None, timeout: int = 75) -> Dict[str, Any]:
    request = urllib.request.Request(
        url,
        data=data,
        headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def parse_int(value: Any) -> Optional[int]:
    if value is None:
        return None
    match = re.search(r"\d+", str(value))
    return int(match.group(0)) if match else None


def parse_timestamp(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def freshness_score(observed_at: Optional[str], now: datetime) -> float:
    observed = parse_timestamp(observed_at)
    if observed is None:
        return 0.60
    age_days = max(0.0, (now - observed).total_seconds() / 86400.0)
    if age_days <= 30:
        return 1.00
    if age_days <= 180:
        return 0.90
    if age_days <= 365:
        return 0.80
    if age_days <= 730:
        return 0.68
    return 0.58


def confidence_score(base_source: float, observed_at: Optional[str], completeness: float, now: datetime) -> Dict[str, Any]:
    freshness = freshness_score(observed_at, now)
    score = 0.60 * base_source + 0.25 * freshness + 0.15 * completeness
    score = max(0.0, min(1.0, score))
    return {
        "score": round(score, 3),
        "basis": {
            "source": round(base_source, 3),
            "freshness": round(freshness, 3),
            "completeness": round(completeness, 3),
        },
    }


def overpass_query() -> str:
    # Historic County Cork is the intended geographic scope. The query also
    # accepts the common Cork name at admin level 6 to survive naming changes.
    return """
[out:json][timeout:70];
(
  rel["boundary"="administrative"]["admin_level"="6"]["name"="County Cork"];
  rel["boundary"="administrative"]["admin_level"="6"]["name"="Cork"];
)->.county;
map_to_area.county -> .searchArea;
(
  nwr["amenity"="parking"](area.searchArea);
  nwr["parking"~"street_side|lane"](area.searchArea);
);
out meta center tags geom;
""".strip()


def fetch_overpass() -> Tuple[Dict[str, Any], str]:
    errors: List[str] = []
    encoded = urllib.parse.urlencode({"data": overpass_query()}).encode("utf-8")
    for endpoint in OVERPASS_ENDPOINTS:
        try:
            payload = fetch_json(endpoint, data=encoded, timeout=85)
            if payload.get("elements"):
                return payload, endpoint
            errors.append(f"{endpoint}: empty response")
        except Exception as exc:  # network failover by design
            errors.append(f"{endpoint}: {exc}")
    raise RuntimeError("County Cork Overpass parking query failed: " + " | ".join(errors[-4:]))


def element_point(element: Dict[str, Any]) -> Optional[Tuple[float, float]]:
    if element.get("type") == "node" and element.get("lat") is not None and element.get("lon") is not None:
        return float(element["lat"]), float(element["lon"])
    center = element.get("center") or {}
    if center.get("lat") is not None and center.get("lon") is not None:
        return float(center["lat"]), float(center["lon"])
    geometry = element.get("geometry") or []
    valid = [p for p in geometry if p.get("lat") is not None and p.get("lon") is not None]
    if valid:
        return (
            sum(float(p["lat"]) for p in valid) / len(valid),
            sum(float(p["lon"]) for p in valid) / len(valid),
        )
    return None


def polygon_geometry(element: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    # Overpass returns an ordered geometry array for ways. Relations can be
    # multipart and are left without a fabricated polygon unless they arrive as
    # one simple closed geometry.
    geometry = element.get("geometry") or []
    coords = [
        [float(point["lon"]), float(point["lat"])]
        for point in geometry
        if point.get("lat") is not None and point.get("lon") is not None
    ]
    if len(coords) < 3:
        return None
    if coords[0] != coords[-1]:
        coords.append(coords[0])
    return {"type": "Polygon", "coordinates": [coords]}


def osm_location(element: Dict[str, Any], now: datetime) -> Optional[Dict[str, Any]]:
    point = element_point(element)
    if point is None:
        return None
    lat, lng = point
    tags = element.get("tags") or {}
    osm_type = str(element.get("type") or "object")
    osm_id = element.get("id")
    parking_kind = tags.get("parking") or "parking"
    name = tags.get("name") or tags.get("operator")
    if not name:
        name = f"{str(parking_kind).replace('_', ' ').title()} parking"

    area = (
        tags.get("addr:city")
        or tags.get("addr:town")
        or tags.get("addr:village")
        or tags.get("is_in:city")
        or tags.get("is_in:town")
        or tags.get("is_in:village")
        or "County Cork"
    )
    capacity = parse_int(tags.get("capacity"))
    accessible = parse_int(tags.get("capacity:disabled"))
    if accessible is None and tags.get("wheelchair") == "yes":
        accessible = 1
    ev_spaces = parse_int(tags.get("capacity:charging"))
    if ev_spaces is None and tags.get("charging_station") == "yes":
        ev_spaces = 1

    charge = tags.get("charge")
    fee = tags.get("fee")
    if charge:
        pricing = charge
    elif fee == "no":
        pricing = "No fee tagged in OpenStreetMap"
    elif fee == "yes":
        pricing = "Paid parking · tariff not published in source"
    else:
        pricing = None

    observed_at = element.get("timestamp")
    geometry = polygon_geometry(element)
    completeness_checks = [
        bool(tags.get("name")),
        capacity is not None,
        bool(tags.get("access")),
        bool(tags.get("surface")),
        bool(tags.get("opening_hours")),
        geometry is not None,
    ]
    completeness = sum(completeness_checks) / len(completeness_checks)

    return {
        "parking_id": f"WB-PARK-IE-CORK-COUNTY-OSM-{osm_type[0].upper()}{osm_id}",
        "name": str(name),
        "area": str(area),
        "latitude": lat,
        "longitude": lng,
        "geometry": geometry,
        "geometry_truth_state": "observed" if geometry else None,
        "parking_type": str(parking_kind),
        "access_type": tags.get("access") or "unknown",
        "status": "known",
        "capacity": capacity,
        "available_spaces": None,
        "occupied_spaces": None,
        "occupancy_ratio": None,
        "observed_at": observed_at,
        "retrieved_at": iso_z(now),
        "truth_state": "observed",
        "confidence": confidence_score(0.74, observed_at, completeness, now),
        "pricing_raw": pricing,
        "opening_hours_raw": tags.get("opening_hours"),
        "maximum_stay_minutes": None,
        "height_restriction_raw": tags.get("maxheight"),
        "accessible_spaces": accessible,
        "ev_spaces": ev_spaces,
        "source_key": "openstreetmap_cork_county_parking",
        "source_url": f"https://www.openstreetmap.org/{osm_type}/{osm_id}",
        "network_role": "parking_asset",
        "surface_raw": tags.get("surface"),
    }


def build_snapshot() -> Dict[str, Any]:
    now = utc_now()
    payload, endpoint = fetch_overpass()
    seen = set()
    locations: List[Dict[str, Any]] = []

    for element in payload.get("elements", []):
        key = (element.get("type"), element.get("id"))
        if key in seen:
            continue
        seen.add(key)
        record = osm_location(element, now)
        if record is not None:
            locations.append(record)

    unique = {item["parking_id"]: item for item in locations}
    locations = sorted(unique.values(), key=lambda item: (item.get("area") or "", item.get("name") or "", item["parking_id"]))
    if not locations:
        raise RuntimeError("No County Cork parking locations returned from OpenStreetMap")

    capacities = [item["capacity"] for item in locations if isinstance(item.get("capacity"), int)]
    accessible = sum(1 for item in locations if (item.get("accessible_spaces") or 0) > 0)
    ev = sum(1 for item in locations if (item.get("ev_spaces") or 0) > 0)
    polygons = sum(1 for item in locations if item.get("geometry"))

    return {
        "schema_version": "1.0",
        "generated_at": iso_z(now),
        "coverage": {
            "country": "IE",
            "region": "Cork",
            "scope": "county_wide_network",
            "mode": "network_inventory",
            "availability_mode": "city_live_county_not_live",
            "bounds": CORK_COUNTY_BOUNDS,
        },
        "sources": {
            "openstreetmap_cork_county_parking": {
                "count": len(locations),
                "status": "ok",
                "endpoint": endpoint,
                "license": "ODbL",
            },
            "cork_county_cdp2022_development_boundaries": {
                "status": "coverage_reference",
                "url": CORK_COUNTY_DEVELOPMENT_BOUNDARIES_URL,
                "license": "CC BY 4.0",
            },
        },
        "summary": {
            "locations": len(locations),
            "mapped_polygon_locations": polygons,
            "known_capacity": sum(capacities) if capacities else None,
            "accessible_locations": accessible,
            "ev_locations": ev,
            "live_availability": False,
        },
        "licenses": [
            {"source": "OpenStreetMap contributors", "license": "ODbL"},
            {"source": "Cork County Council CDP2022 Development Boundaries", "license": "CC BY 4.0", "role": "coverage reference"},
        ],
        "locations": locations,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build County Cork parking network snapshot")
    parser.add_argument("--output", type=Path, default=Path("web/data/cork_county_parking_snapshot.json"))
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    snapshot = build_snapshot()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(snapshot, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(
        "WHITEBLOCK County Cork network snapshot:",
        snapshot["summary"]["locations"],
        "locations /",
        snapshot["summary"]["mapped_polygon_locations"],
        "mapped polygons ->",
        args.output,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
