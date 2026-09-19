#!/usr/bin/env python3
"""Build a browser-safe County Kildare parking network snapshot.

Sources:
- Kildare County Council Accessible Parking ArcGIS FeatureServer (CC BY 4.0)
- OpenStreetMap parking inventory through Overpass (ODbL)

This source is inventory/network coverage, not a live occupancy feed. The script
therefore never fabricates available-space values.
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
from typing import Any, Dict, Iterable, List, Optional, Tuple

KCC_FEATURE_URL = (
    "https://services-eu1.arcgis.com/7382h3fBABGPKrTJ/arcgis/rest/services/"
    "Kildare%20Accessible%20Parking/FeatureServer/0/query"
)
OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]
KCC_SOURCE_UPDATED_AT = "2024-06-17T11:08:00Z"

# Published geographic coverage envelope from Kildare County Council open-data metadata.
KILDARE_BOUNDS = {
    "south": 52.89292777262258,
    "west": -7.094685794312817,
    "north": 53.40546821613401,
    "east": -6.4849660938960625,
}

USER_AGENT = "WHITEBLOCK/1.0 parking-network-ingestion (public research prototype)"


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso_z(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def fetch_json(url: str, *, data: Optional[bytes] = None, timeout: int = 45) -> Dict[str, Any]:
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


def kcc_accessible_locations(now: datetime) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    params = {
        "where": "1=1",
        "outFields": "id,town,location,weblink,OBJECTID",
        "returnGeometry": "true",
        "outSR": "4326",
        "f": "geojson",
    }
    url = KCC_FEATURE_URL + "?" + urllib.parse.urlencode(params)
    payload = fetch_json(url)
    output: List[Dict[str, Any]] = []

    for feature in payload.get("features", []):
        geometry = feature.get("geometry") or {}
        coords = geometry.get("coordinates") or []
        if len(coords) < 2:
            continue
        lng, lat = coords[0], coords[1]
        props = feature.get("properties") or {}
        object_id = props.get("OBJECTID") or props.get("id")
        town = (props.get("town") or "County Kildare").strip()
        location = (props.get("location") or "Accessible parking").strip()
        completeness = sum(bool(value) for value in [town, location, props.get("weblink")]) / 3.0
        output.append(
            {
                "parking_id": f"WB-ACC-IE-KILDARE-KCC-{int(object_id):05d}" if object_id is not None else f"WB-ACC-IE-KILDARE-KCC-{len(output)+1:05d}",
                "name": location,
                "area": town,
                "latitude": float(lat),
                "longitude": float(lng),
                "parking_type": "accessible_bay",
                "access_type": "public_or_bylaw_designated",
                "status": "known",
                "capacity": None,
                "available_spaces": None,
                "occupied_spaces": None,
                "occupancy_ratio": None,
                "observed_at": KCC_SOURCE_UPDATED_AT,
                "retrieved_at": iso_z(now),
                "truth_state": "observed",
                "confidence": confidence_score(0.95, KCC_SOURCE_UPDATED_AT, completeness, now),
                "pricing_raw": None,
                "opening_hours_raw": None,
                "maximum_stay_minutes": None,
                "height_restriction_raw": None,
                "accessible_spaces": 1,
                "ev_spaces": None,
                "source_key": "kildare_coco_accessible_parking",
                "source_url": props.get("weblink") or KCC_FEATURE_URL,
                "network_role": "accessible_space",
            }
        )

    return output, {"count": len(output), "status": "ok"}


def overpass_query() -> str:
    return """
[out:json][timeout:45];
rel["boundary"="administrative"]["name"="County Kildare"];
map_to_area -> .searchArea;
(
  nwr["amenity"="parking"](area.searchArea);
  nwr["parking"~"street_side|lane"](area.searchArea);
);
out meta center tags;
""".strip()


def overpass_bbox_query() -> str:
    b = KILDARE_BOUNDS
    bbox = f"{b['south']},{b['west']},{b['north']},{b['east']}"
    return f"""
[out:json][timeout:45];
(
  nwr["amenity"="parking"]({bbox});
  nwr["parking"~"street_side|lane"]({bbox});
);
out meta center tags;
""".strip()


def fetch_overpass() -> Tuple[Dict[str, Any], str]:
    errors: List[str] = []
    for query_name, query in [("county_boundary", overpass_query()), ("coverage_bbox_fallback", overpass_bbox_query())]:
        encoded = urllib.parse.urlencode({"data": query}).encode("utf-8")
        for endpoint in OVERPASS_ENDPOINTS:
            try:
                payload = fetch_json(endpoint, data=encoded, timeout=55)
                if payload.get("elements"):
                    return payload, query_name
            except Exception as exc:  # network failover by design
                errors.append(f"{endpoint}: {exc}")
    raise RuntimeError("Overpass parking query failed: " + " | ".join(errors[-4:]))


def element_point(element: Dict[str, Any]) -> Optional[Tuple[float, float]]:
    if element.get("type") == "node" and element.get("lat") is not None and element.get("lon") is not None:
        return float(element["lat"]), float(element["lon"])
    center = element.get("center") or {}
    if center.get("lat") is not None and center.get("lon") is not None:
        return float(center["lat"]), float(center["lon"])
    return None


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
        pretty = str(parking_kind).replace("_", " ").title()
        name = f"{pretty} parking"

    area = (
        tags.get("addr:city")
        or tags.get("addr:town")
        or tags.get("is_in:city")
        or tags.get("is_in:town")
        or "County Kildare"
    )
    capacity = parse_int(tags.get("capacity"))
    accessible = parse_int(tags.get("capacity:disabled"))
    if accessible is None and tags.get("wheelchair") == "yes":
        accessible = 1
    ev_spaces = parse_int(tags.get("capacity:charging"))
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
    completeness_checks = [bool(tags.get("name")), capacity is not None, bool(tags.get("access")), bool(tags.get("surface")), bool(tags.get("opening_hours"))]
    completeness = sum(completeness_checks) / len(completeness_checks)

    return {
        "parking_id": f"WB-PARK-IE-KILDARE-OSM-{osm_type[0].upper()}{osm_id}",
        "name": str(name),
        "area": str(area),
        "latitude": lat,
        "longitude": lng,
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
        "source_key": "openstreetmap_kildare_parking",
        "source_url": f"https://www.openstreetmap.org/{osm_type}/{osm_id}",
        "network_role": "parking_asset",
        "surface_raw": tags.get("surface"),
    }


def osm_locations(now: datetime) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    payload, query_mode = fetch_overpass()
    seen = set()
    output: List[Dict[str, Any]] = []
    for element in payload.get("elements", []):
        key = (element.get("type"), element.get("id"))
        if key in seen:
            continue
        seen.add(key)
        record = osm_location(element, now)
        if record is not None:
            output.append(record)
    return output, {"count": len(output), "status": "ok", "query_mode": query_mode}


def build_snapshot() -> Dict[str, Any]:
    now = utc_now()
    locations: List[Dict[str, Any]] = []
    sources: Dict[str, Any] = {}

    try:
        kcc, meta = kcc_accessible_locations(now)
        locations.extend(kcc)
        sources["kildare_coco_accessible_parking"] = meta
    except Exception as exc:
        sources["kildare_coco_accessible_parking"] = {"count": 0, "status": "error", "error": str(exc)}

    try:
        osm, meta = osm_locations(now)
        locations.extend(osm)
        sources["openstreetmap_kildare_parking"] = meta
    except Exception as exc:
        sources["openstreetmap_kildare_parking"] = {"count": 0, "status": "error", "error": str(exc)}

    # Stable deterministic ordering and cross-source de-dup by canonical id.
    unique = {item["parking_id"]: item for item in locations}
    locations = sorted(unique.values(), key=lambda item: (item.get("area") or "", item.get("name") or "", item["parking_id"]))

    if not locations:
        raise RuntimeError("No Kildare parking locations could be retrieved from any source")

    capacity_values = [item["capacity"] for item in locations if isinstance(item.get("capacity"), int)]
    accessible_count = sum(1 for item in locations if (item.get("accessible_spaces") or 0) > 0)

    return {
        "schema_version": "1.0",
        "generated_at": iso_z(now),
        "coverage": {
            "country": "IE",
            "region": "Kildare",
            "mode": "network_inventory",
            "availability_mode": "not_live",
            "bounds": KILDARE_BOUNDS,
        },
        "sources": sources,
        "summary": {
            "locations": len(locations),
            "known_capacity": sum(capacity_values) if capacity_values else None,
            "accessible_locations": accessible_count,
            "live_availability": False,
        },
        "licenses": [
            {"source": "Kildare County Council", "license": "CC BY 4.0"},
            {"source": "OpenStreetMap contributors", "license": "ODbL"},
        ],
        "locations": locations,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build County Kildare parking network snapshot")
    parser.add_argument("--output", type=Path, default=Path("web/data/kildare_parking_snapshot.json"))
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    snapshot = build_snapshot()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(snapshot, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(
        "WHITEBLOCK Kildare network snapshot:",
        snapshot["summary"]["locations"],
        "locations ->",
        args.output,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
