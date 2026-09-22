#!/usr/bin/env python3
"""Build the WHITEBLOCK County Dublin parking network snapshot.

Precision principles:
- traverse the four current Dublin local-authority boundaries exactly in OSM;
- never use a rectangular County Dublin bounding box for inventory creation;
- retain mapped access restrictions and keep unknown access as unknown;
- never fabricate capacity, occupancy, availability, price, or maximum stay;
- use official council datasets as regulatory/evidence probes, not as automatic
  proof that every meter/sign point is itself a parking area.

The snapshot is a county-wide traversal of mapped parking inventory. It is not a
claim that OpenStreetMap or any council dataset contains every physical or legal
parking space in Dublin.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import math
import re
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

DUBLIN_TRADITIONAL_COUNTY_RELATION_ID = 282800
LOCAL_AUTHORITIES = (
    {"key": "dublin_city", "name": "Dublin City", "relation_id": 1109531},
    {"key": "fingal", "name": "Fingal", "relation_id": 1114164},
    {"key": "dun_laoghaire_rathdown", "name": "Dún Laoghaire–Rathdown", "relation_id": 1115720},
    {"key": "south_dublin", "name": "South Dublin", "relation_id": 1117469},
)

OVERPASS_ENDPOINTS = (
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
)

OFFICIAL_EVIDENCE_SOURCES = (
    {
        "key": "dublin_city_parking_meters",
        "authority": "Dublin City Council",
        "url": "https://data.smartdublin.ie/dataset/58969481-417e-4f5a-b8ea-18b56419d0ed/resource/5ad94dfe-5e53-4b33-ace8-a612225873dc/download/parking-meter-locations-dcc.geojson",
        "format": "geojson",
        "published_freshness": "2025-06-20",
        "role": "regulation_and_meter_evidence",
    },
    {
        "key": "fingal_parking_meters_2026",
        "authority": "Fingal County Council",
        "url": "https://data.fingal.ie/api/download/v1/items/e42a757d98e04018a5d1b162f4b6e5aa/csv?layers=0",
        "format": "csv",
        "published_freshness": "2026-07-30",
        "role": "regulation_and_meter_evidence",
    },
    {
        "key": "south_dublin_parking_meters_2026",
        "authority": "South Dublin County Council",
        "url": "https://data-sdublincoco.opendata.arcgis.com/api/download/v1/items/dbf7effb5989414b8bd370db524c4170/csv?layers=0",
        "format": "csv",
        "published_freshness": "2026-05-18",
        "role": "regulation_and_meter_evidence",
    },
    {
        "key": "dlr_parking_tag_information",
        "authority": "Dún Laoghaire–Rathdown County Council",
        "url": "https://data.smartdublin.ie/dataset/8a1a724b-9c4c-4ab4-8571-95fecca47ee6/resource/9fa8d438-b4ae-4189-9b11-feb10ec92b4a/download/parking-tag-information-dlrcc.csv",
        "format": "csv",
        "published_freshness": "2021-04-15",
        "catalogue_metadata_last_updated": "2025-06-19",
        "role": "regulation_tariff_and_restriction_evidence",
    },
)

USER_AGENT = "WHITEBLOCK/1.0 county-dublin-parking-ingestion (public research prototype)"
PLACE_TYPES = {"city", "town", "village", "suburb", "neighbourhood"}


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso_z(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def fetch_bytes(url: str, *, data: Optional[bytes] = None, timeout: int = 90) -> bytes:
    request = urllib.request.Request(url, data=data, headers={"User-Agent": USER_AGENT, "Accept": "*/*"})
    with urllib.request.urlopen(request, timeout=timeout) as response:  # noqa: S310 - fixed HTTPS sources
        return response.read()


def fetch_json(url: str, *, data: Optional[bytes] = None, timeout: int = 90) -> Dict[str, Any]:
    return json.loads(fetch_bytes(url, data=data, timeout=timeout).decode("utf-8"))


def parse_int(value: Any) -> Optional[int]:
    if value in (None, ""):
        return None
    match = re.search(r"\d+", str(value).replace(",", ""))
    return int(match.group(0)) if match else None


def parse_maxstay_minutes(value: Any) -> Optional[int]:
    if value in (None, ""):
        return None
    raw = str(value).strip().lower()
    match = re.search(r"(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours)\b", raw)
    if match:
        return int(round(float(match.group(1)) * 60))
    match = re.search(r"(\d+)\s*(m|min|mins|minute|minutes)\b", raw)
    if match:
        return int(match.group(1))
    return None


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
        return 0.58
    age_days = max(0.0, (now - observed).total_seconds() / 86400.0)
    if age_days <= 30:
        return 1.00
    if age_days <= 180:
        return 0.90
    if age_days <= 365:
        return 0.80
    if age_days <= 730:
        return 0.68
    return 0.55


def confidence_score(base_source: float, observed_at: Optional[str], completeness: float, now: datetime) -> Dict[str, Any]:
    freshness = freshness_score(observed_at, now)
    score = max(0.0, min(1.0, 0.60 * base_source + 0.25 * freshness + 0.15 * completeness))
    return {
        "score": round(score, 3),
        "basis": {
            "source": round(base_source, 3),
            "freshness": round(freshness, 3),
            "completeness": round(completeness, 3),
        },
    }


def overpass_query(relation_id: int) -> str:
    return f"""
[out:json][timeout:90];
rel({relation_id});
map_to_area -> .searchArea;
(
  nwr["amenity"="parking"](area.searchArea);
  nwr["parking"~"street_side|lane"](area.searchArea);
  node["place"~"city|town|village|suburb|neighbourhood"](area.searchArea);
);
out meta geom;
""".strip()


def fetch_overpass(relation_id: int) -> Tuple[Dict[str, Any], str]:
    body = urllib.parse.urlencode({"data": overpass_query(relation_id)}).encode("utf-8")
    errors: List[str] = []
    for endpoint in OVERPASS_ENDPOINTS:
        try:
            payload = fetch_json(endpoint, data=body, timeout=105)
            if payload.get("elements"):
                return payload, endpoint
            errors.append(f"{endpoint}: empty response")
        except Exception as exc:  # network failover by design
            errors.append(f"{endpoint}: {exc}")
    raise RuntimeError(f"Overpass relation {relation_id} failed: " + " | ".join(errors[-6:]))


def element_point(element: Dict[str, Any]) -> Optional[Tuple[float, float]]:
    if element.get("type") == "node" and element.get("lat") is not None and element.get("lon") is not None:
        return float(element["lat"]), float(element["lon"])
    center = element.get("center") or {}
    if center.get("lat") is not None and center.get("lon") is not None:
        return float(center["lat"]), float(center["lon"])
    geometry = element.get("geometry") or []
    valid = [p for p in geometry if isinstance(p, dict) and p.get("lat") is not None and p.get("lon") is not None]
    if valid:
        return (
            sum(float(p["lat"]) for p in valid) / len(valid),
            sum(float(p["lon"]) for p in valid) / len(valid),
        )
    return None


def polygon_geometry(element: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    if element.get("type") != "way":
        return None
    geometry = element.get("geometry") or []
    coords = [[float(p["lon"]), float(p["lat"])] for p in geometry if p.get("lat") is not None and p.get("lon") is not None]
    if len(coords) < 3:
        return None
    if coords[0] != coords[-1]:
        coords.append(coords[0])
    return {"type": "Polygon", "coordinates": [coords]}


def haversine_km(a_lat: float, a_lng: float, b_lat: float, b_lng: float) -> float:
    radius = 6371.0088
    p1, p2 = math.radians(a_lat), math.radians(b_lat)
    dp = math.radians(b_lat - a_lat)
    dl = math.radians(b_lng - a_lng)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * radius * math.asin(math.sqrt(h))


def place_anchor(element: Dict[str, Any], local_authority: str) -> Optional[Dict[str, Any]]:
    tags = element.get("tags") or {}
    place_type = tags.get("place")
    if place_type not in PLACE_TYPES or not tags.get("name"):
        return None
    point = element_point(element)
    if point is None:
        return None
    return {
        "name": str(tags["name"]),
        "place_type": place_type,
        "lat": point[0],
        "lng": point[1],
        "local_authority": local_authority,
        "osm_id": element.get("id"),
    }


def explicit_settlement(tags: Dict[str, Any]) -> Optional[Tuple[str, str, str]]:
    keys = (
        ("addr:suburb", "suburb"), ("is_in:suburb", "suburb"),
        ("addr:village", "village"), ("is_in:village", "village"),
        ("addr:town", "town"), ("is_in:town", "town"),
        ("addr:city", "city"), ("is_in:city", "city"),
    )
    for key, place_type in keys:
        value = tags.get(key)
        if value:
            return str(value), place_type, f"osm_tag:{key}"
    return None


def nearest_settlement(lat: float, lng: float, anchors: Iterable[Dict[str, Any]]) -> Optional[Tuple[str, str, str, float]]:
    thresholds = {"neighbourhood": 3.0, "suburb": 4.5, "village": 7.0, "town": 10.0, "city": 15.0}
    candidates: List[Tuple[float, Dict[str, Any]]] = []
    for anchor in anchors:
        distance = haversine_km(lat, lng, anchor["lat"], anchor["lng"])
        if distance <= thresholds[anchor["place_type"]]:
            candidates.append((distance, anchor))
    if not candidates:
        return None
    distance, winner = min(candidates, key=lambda item: item[0])
    return winner["name"], winner["place_type"], "nearest_osm_place_anchor", round(distance, 3)


def parking_record(element: Dict[str, Any], authority: Dict[str, Any], anchors: Iterable[Dict[str, Any]], now: datetime) -> Optional[Dict[str, Any]]:
    tags = element.get("tags") or {}
    point = element_point(element)
    if point is None:
        return None
    lat, lng = point
    osm_type = str(element.get("type") or "object")
    osm_id = element.get("id")
    parking_kind = tags.get("parking") or "parking"
    name = tags.get("name") or tags.get("operator") or f"{str(parking_kind).replace('_', ' ').title()} parking"

    explicit = explicit_settlement(tags)
    settlement_distance = None
    if explicit:
        settlement, settlement_type, assignment = explicit
    else:
        nearest = nearest_settlement(lat, lng, anchors)
        if nearest:
            settlement, settlement_type, assignment, settlement_distance = nearest
        else:
            settlement, settlement_type, assignment = authority["name"], None, "local_authority_fallback"

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
        pricing = str(charge)
    elif fee == "no":
        pricing = "No fee tagged in OpenStreetMap"
    elif fee == "yes":
        pricing = "Paid parking · tariff not published in source"
    else:
        pricing = None

    geometry = polygon_geometry(element)
    observed_at = element.get("timestamp")
    completeness_checks = [
        bool(tags.get("name")), capacity is not None, bool(tags.get("access")),
        bool(tags.get("opening_hours")), fee is not None or bool(charge), geometry is not None,
    ]
    completeness = sum(completeness_checks) / len(completeness_checks)

    return {
        "parking_id": f"WB-PARK-IE-DUBLIN-OSM-{osm_type[0].upper()}{osm_id}",
        "name": str(name),
        "area": settlement,
        "settlement": settlement,
        "settlement_type": settlement_type,
        "settlement_assignment_method": assignment,
        "settlement_anchor_distance_km": settlement_distance,
        "local_authority": authority["name"],
        "local_authority_relation_id": authority["relation_id"],
        "latitude": lat,
        "longitude": lng,
        "geometry": geometry,
        "geometry_truth_state": "observed" if geometry else None,
        "parking_type": str(parking_kind),
        "access_type": tags.get("access") or "unknown",
        "status": "known_mapped_asset",
        "capacity": capacity,
        "available_spaces": None,
        "occupied_spaces": None,
        "occupancy_ratio": None,
        "observed_at": observed_at,
        "retrieved_at": iso_z(now),
        "truth_state": "observed",
        "confidence": confidence_score(0.76, observed_at, completeness, now),
        "pricing_raw": pricing,
        "opening_hours_raw": tags.get("opening_hours"),
        "maximum_stay_minutes": parse_maxstay_minutes(tags.get("maxstay")),
        "height_restriction_raw": tags.get("maxheight"),
        "accessible_spaces": accessible,
        "ev_spaces": ev_spaces,
        "source_key": f"openstreetmap_{authority['key']}_parking",
        "source_url": f"https://www.openstreetmap.org/{osm_type}/{osm_id}",
        "network_role": "parking_asset",
        "surface_raw": tags.get("surface"),
    }


def authority_inventory(authority: Dict[str, Any], now: datetime) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], Dict[str, Any]]:
    payload, endpoint = fetch_overpass(authority["relation_id"])
    elements = payload.get("elements", [])
    anchors = [anchor for element in elements if (anchor := place_anchor(element, authority["name"])) is not None]
    records: List[Dict[str, Any]] = []
    seen = set()
    for element in elements:
        tags = element.get("tags") or {}
        if tags.get("amenity") != "parking" and tags.get("parking") not in {"street_side", "lane"}:
            continue
        key = (element.get("type"), element.get("id"))
        if key in seen:
            continue
        seen.add(key)
        record = parking_record(element, authority, anchors, now)
        if record:
            records.append(record)
    return records, anchors, {
        "status": "ok",
        "count": len(records),
        "place_anchors": len(anchors),
        "query_mode": "exact_local_authority_boundary",
        "relation_id": authority["relation_id"],
        "admin_level": 7,
        "endpoint": endpoint,
        "license": "ODbL",
    }


def probe_official_source(source: Dict[str, str], now: datetime) -> Dict[str, Any]:
    meta: Dict[str, Any] = {
        "authority": source["authority"],
        "status": "error",
        "role": source["role"],
        "published_freshness": source["published_freshness"],
        "retrieved_at": iso_z(now),
        "url": source["url"],
        "license": "CC BY 4.0",
    }
    if source.get("catalogue_metadata_last_updated"):
        meta["catalogue_metadata_last_updated"] = source["catalogue_metadata_last_updated"]
    try:
        raw = fetch_bytes(source["url"], timeout=45)
        if source["format"] == "geojson":
            payload = json.loads(raw.decode("utf-8-sig"))
            meta["records"] = len(payload.get("features") or [])
        else:
            text = raw.decode("utf-8-sig", errors="replace")
            rows = list(csv.reader(io.StringIO(text)))
            meta["records"] = max(0, len(rows) - 1)
        meta["status"] = "ok"
    except Exception as exc:
        meta["error"] = str(exc)
    return meta


def build_snapshot() -> Dict[str, Any]:
    now = utc_now()
    locations: List[Dict[str, Any]] = []
    sources: Dict[str, Any] = {}
    place_anchors: List[Dict[str, Any]] = []

    for authority in LOCAL_AUTHORITIES:
        records, anchors, meta = authority_inventory(authority, now)
        locations.extend(records)
        place_anchors.extend(anchors)
        sources[f"openstreetmap_{authority['key']}_parking"] = meta

    # OSM objects touching local-authority boundaries can appear twice. Keep one
    # canonical asset, preferring the first exact-boundary result deterministically.
    unique: Dict[str, Dict[str, Any]] = {}
    for item in locations:
        unique.setdefault(item["parking_id"], item)
    locations = sorted(unique.values(), key=lambda item: (item["local_authority"], item.get("area") or "", item.get("name") or "", item["parking_id"]))

    if not locations:
        raise RuntimeError("No County Dublin parking locations could be retrieved")

    for source in OFFICIAL_EVIDENCE_SOURCES:
        sources[source["key"]] = probe_official_source(source, now)

    capacities = [item["capacity"] for item in locations if isinstance(item.get("capacity"), int)]
    polygons = sum(1 for item in locations if item.get("geometry"))
    accessible = sum(1 for item in locations if (item.get("accessible_spaces") or 0) > 0)
    ev = sum(1 for item in locations if (item.get("ev_spaces") or 0) > 0)
    settlement_labelled = sum(1 for item in locations if item.get("settlement_assignment_method") != "local_authority_fallback")
    unknown_access = sum(1 for item in locations if item.get("access_type") == "unknown")
    per_authority = {
        authority["name"]: sum(1 for item in locations if item["local_authority"] == authority["name"])
        for authority in LOCAL_AUTHORITIES
    }

    return {
        "schema_version": "1.2",
        "generated_at": iso_z(now),
        "coverage": {
            "country": "IE",
            "region": "Dublin",
            "scope": "county_wide_network",
            "coverage_claim": "complete_boundary_traversal_not_complete_real_world_inventory",
            "mode": "network_inventory",
            "availability_mode": "not_live",
            "osm_traditional_county_relation_id": DUBLIN_TRADITIONAL_COUNTY_RELATION_ID,
            "local_authority_relation_ids": {authority["name"]: authority["relation_id"] for authority in LOCAL_AUTHORITIES},
        },
        "sources": sources,
        "summary": {
            "locations": len(locations),
            "mapped_polygon_locations": polygons,
            "known_capacity": sum(capacities) if capacities else None,
            "accessible_locations": accessible,
            "ev_locations": ev,
            "settlement_labelled_locations": settlement_labelled,
            "unknown_access_locations": unknown_access,
            "place_anchors": len(place_anchors),
            "locations_by_local_authority": per_authority,
            "live_availability": False,
        },
        "licenses": [
            {"source": "OpenStreetMap contributors", "license": "ODbL"},
            {"source": "Dublin local authorities / Smart Dublin open data", "license": "CC BY 4.0 where specified by source"},
        ],
        "locations": locations,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Build exact-boundary County Dublin parking network snapshot")
    parser.add_argument("--output", type=Path, default=Path("web/data/dublin_parking_snapshot.json"))
    args = parser.parse_args()
    snapshot = build_snapshot()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(snapshot, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(
        "WHITEBLOCK County Dublin network snapshot:",
        snapshot["summary"]["locations"],
        "locations /",
        snapshot["summary"]["mapped_polygon_locations"],
        "mapped polygons /",
        snapshot["summary"]["settlement_labelled_locations"],
        "settlement-labelled ->",
        args.output,
    )
    print("Locations by local authority:", json.dumps(snapshot["summary"]["locations_by_local_authority"], ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
