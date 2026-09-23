#!/usr/bin/env python3
"""Build a conservative Dublin venue-parking knowledge layer.

The layer discovers high-value venue classes (fuel/service areas, shopping
centres, supermarkets, department stores and named retail areas) from
OpenStreetMap inside the exact four County Dublin local-authority relations and
relates them to the already-published WHITEBLOCK parking snapshot.

A venue being open 24/7 is never interpreted as permission to leave a vehicle.
Spatial proximity is evidence for investigation, not ownership/access proof.
Imagery review creates candidate evidence only and never legal/public parking.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import time
import urllib.parse
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

USER_AGENT = "WHITEBLOCK/1.0 Dublin venue parking knowledge"
OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]

LOCAL_AUTHORITIES = {
    "Dublin City": 1109531,
    "Fingal": 1114164,
    "Dún Laoghaire–Rathdown": 1115720,
    "South Dublin": 1117469,
}

COVERAGE_CLAIM = "complete_boundary_traversal_not_complete_real_world_inventory"

STOPWORDS = {
    "the", "and", "centre", "center", "shopping", "retail", "park", "car",
    "parking", "service", "services", "station", "dublin", "ireland", "store",
}


def now_z() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def clean(value: Any) -> Optional[str]:
    if value in (None, ""):
        return None
    text = " ".join(str(value).strip().split())
    return text or None


def norm_tokens(value: Any) -> set[str]:
    text = clean(value)
    if not text:
        return set()
    parts = re.findall(r"[a-z0-9]+", text.casefold())
    return {part for part in parts if len(part) > 2 and part not in STOPWORDS}


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0088
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def venue_query(relation_id: int) -> str:
    return f"""
[out:json][timeout:70];
rel({relation_id});
map_to_area -> .searchArea;
(
  nwr[\"amenity\"=\"fuel\"](area.searchArea);
  nwr[\"highway\"~\"services|rest_area\"](area.searchArea);
  nwr[\"shop\"~\"supermarket|mall|department_store\"](area.searchArea);
  nwr[\"landuse\"=\"retail\"][\"name\"](area.searchArea);
);
out meta center tags;
""".strip()


def fetch_overpass(query: str) -> Dict[str, Any]:
    body = urllib.parse.urlencode({"data": query}).encode("utf-8")
    errors: List[str] = []
    for endpoint in OVERPASS_ENDPOINTS:
        try:
            req = urllib.request.Request(
                endpoint,
                data=body,
                headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=90) as response:
                payload = json.loads(response.read().decode("utf-8"))
            if isinstance(payload.get("elements"), list):
                return payload
        except Exception as exc:  # pragma: no cover - network failure path
            errors.append(f"{endpoint}: {exc}")
            time.sleep(1.0)
    raise RuntimeError("Overpass venue discovery failed: " + " | ".join(errors[-2:]))


def element_point(element: Dict[str, Any]) -> Tuple[Optional[float], Optional[float]]:
    if element.get("type") == "node":
        lat, lon = element.get("lat"), element.get("lon")
    else:
        center = element.get("center") or {}
        lat, lon = center.get("lat"), center.get("lon")
    try:
        return float(lat), float(lon)
    except (TypeError, ValueError):
        return None, None


def category(tags: Dict[str, Any]) -> str:
    if tags.get("amenity") == "fuel":
        return "fuel_station"
    if tags.get("highway") in {"services", "rest_area"}:
        return "road_service_area"
    if tags.get("shop") == "supermarket":
        return "supermarket"
    if tags.get("shop") == "mall":
        return "shopping_centre"
    if tags.get("shop") == "department_store":
        return "department_store"
    if tags.get("landuse") == "retail":
        return "named_retail_area"
    return "other_venue"


def default_radius_km(venue_category: str) -> float:
    if venue_category in {"fuel_station", "road_service_area"}:
        return 0.16
    if venue_category in {"supermarket", "department_store"}:
        return 0.22
    return 0.38


def venue_policy(venue_category: str) -> Dict[str, Any]:
    if venue_category in {"fuel_station", "road_service_area"}:
        return {
            "default_use": "short_customer_stop_only",
            "long_stay_requires_explicit_evidence": True,
            "open_24_7_is_parking_permission": False,
            "reason": "A 24/7 forecourt/service venue may operate continuously, but that does not prove unattended or long-stay parking is permitted.",
        }
    return {
        "default_use": "customer_visit_conditional",
        "long_stay_requires_explicit_evidence": True,
        "open_24_7_is_parking_permission": False,
        "reason": "Retail opening hours do not prove parking access outside a customer visit or override a published maximum stay.",
    }


def name_match(venue: Dict[str, Any], parking: Dict[str, Any]) -> bool:
    venue_tokens = norm_tokens(venue.get("name")) | norm_tokens(venue.get("operator")) | norm_tokens(venue.get("brand"))
    parking_tokens = norm_tokens(parking.get("name")) | norm_tokens(parking.get("operator"))
    return bool(venue_tokens and parking_tokens and venue_tokens.intersection(parking_tokens))


def parking_link(venue: Dict[str, Any], parking: Dict[str, Any], distance: float) -> Dict[str, Any]:
    access = str(parking.get("access_type") or "unknown")
    match = name_match(venue, parking)
    if match:
        association_state = "name_or_operator_match"
        association_truth = "source_supported_spatial_association"
    else:
        association_state = "proximity_only"
        association_truth = "candidate_association"

    if access == "public":
        suggestion_state = "public_parking_nearby"
    elif access == "customer" and match:
        suggestion_state = "conditional_customer_parking"
    elif access == "customer":
        suggestion_state = "customer_parking_nearby_venue_association_unverified"
    elif access in {"private", "permit", "restricted"}:
        suggestion_state = "not_general_user_parking"
    else:
        suggestion_state = "parking_access_unknown"

    return {
        "parking_id": parking.get("parking_id"),
        "parking_name": parking.get("name"),
        "distance_m": int(round(distance * 1000)),
        "association_state": association_state,
        "association_truth_state": association_truth,
        "suggestion_state": suggestion_state,
        "access_type": access,
        "customer_only": parking.get("customer_only") is True,
        "general_public_eligible": parking.get("general_public_eligible"),
        "maximum_stay_minutes": parking.get("maximum_stay_minutes"),
        "opening_hours_raw": parking.get("opening_hours_raw"),
        "pricing_raw": parking.get("pricing_raw"),
        "capacity": parking.get("capacity"),
        "available_spaces": None,
        "live_availability_state": "not_connected",
        "source_key": parking.get("source_key"),
        "source_url": parking.get("source_url"),
    }


def build_venue_record(authority: str, relation_id: int, element: Dict[str, Any], parking: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    lat, lon = element_point(element)
    if lat is None or lon is None:
        return None
    tags = element.get("tags") or {}
    venue_category = category(tags)
    radius = default_radius_km(venue_category)
    venue = {
        "venue_id": f"WB-VENUE-IE-DUBLIN-{element.get('type', 'x')[0].upper()}{element.get('id')}",
        "name": clean(tags.get("name") or tags.get("brand") or tags.get("operator")) or f"Unnamed {venue_category.replace('_', ' ')}",
        "category": venue_category,
        "local_authority": authority,
        "local_authority_relation_id": relation_id,
        "latitude": lat,
        "longitude": lon,
        "opening_hours_raw": clean(tags.get("opening_hours")),
        "venue_open_24_7": str(tags.get("opening_hours") or "").strip().casefold() == "24/7",
        "operator": clean(tags.get("operator")),
        "brand": clean(tags.get("brand")),
        "website": clean(tags.get("website") or tags.get("contact:website")),
        "osm_id": element.get("id"),
        "osm_type": element.get("type"),
        "osm_timestamp": element.get("timestamp"),
        "source_key": "openstreetmap_dublin_venue_discovery",
        "source_url": f"https://www.openstreetmap.org/{element.get('type')}/{element.get('id')}",
        "truth_state": "observed_venue",
        "policy": venue_policy(venue_category),
    }

    candidates: List[Tuple[float, Dict[str, Any]]] = []
    for item in parking:
        try:
            p_lat = float(item.get("latitude"))
            p_lon = float(item.get("longitude"))
        except (TypeError, ValueError):
            continue
        distance = haversine_km(lat, lon, p_lat, p_lon)
        if distance <= radius:
            candidates.append((distance, item))
    candidates.sort(key=lambda pair: pair[0])
    links = [parking_link(venue, item, distance) for distance, item in candidates[:8]]
    venue["parking_links"] = links
    venue["mapped_parking_nearby"] = len(links)

    strong = [link for link in links if link["association_state"] == "name_or_operator_match"]
    usable = [link for link in strong if link["access_type"] in {"public", "customer"}]
    public_nearby = [link for link in links if link["access_type"] == "public"]

    if usable:
        venue["parking_knowledge_state"] = "source_backed_or_strongly_associated_parking"
        venue["suggestion_eligibility"] = "conditional"
        venue["imagery_review_priority"] = "low"
    elif public_nearby:
        venue["parking_knowledge_state"] = "public_parking_nearby_not_venue_owned"
        venue["suggestion_eligibility"] = "nearby_public_option"
        venue["imagery_review_priority"] = "medium"
    elif links:
        venue["parking_knowledge_state"] = "mapped_parking_nearby_access_or_association_unverified"
        venue["suggestion_eligibility"] = "verify_before_recommending"
        venue["imagery_review_priority"] = "high"
    else:
        venue["parking_knowledge_state"] = "no_mapped_parking_link_in_current_snapshot"
        venue["suggestion_eligibility"] = "imagery_and_source_review_required"
        venue["imagery_review_priority"] = "high"

    venue["imagery_candidate_state"] = (
        "candidate_for_parking_footprint_review"
        if venue["imagery_review_priority"] in {"high", "medium"}
        else "not_priority"
    )
    venue["imagery_truth_rule"] = "Imagery may confirm physical parking geometry only; it does not prove public/customer access, permitted stay, or live availability."
    return venue


def discover_venues(parking: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    venues: List[Dict[str, Any]] = []
    source_meta: Dict[str, Any] = {}
    seen: set[Tuple[str, int]] = set()
    for authority, relation_id in LOCAL_AUTHORITIES.items():
        payload = fetch_overpass(venue_query(relation_id))
        count = 0
        for element in payload.get("elements", []):
            key = (str(element.get("type")), int(element.get("id") or 0))
            if key in seen:
                continue
            seen.add(key)
            record = build_venue_record(authority, relation_id, element, parking)
            if record:
                venues.append(record)
                count += 1
        source_meta[authority] = {
            "relation_id": relation_id,
            "status": "ok",
            "query_mode": "exact_local_authority_boundary",
            "venue_records": count,
        }
    venues.sort(key=lambda row: (row["local_authority"], row["category"], row["name"], row["venue_id"]))
    return venues, source_meta


def build_knowledge(snapshot: Dict[str, Any]) -> Dict[str, Any]:
    parking = list(snapshot.get("locations") or [])
    venues, source_meta = discover_venues(parking)
    categories = Counter(row["category"] for row in venues)
    states = Counter(row["parking_knowledge_state"] for row in venues)
    imagery_queue = [
        {
            "venue_id": row["venue_id"],
            "name": row["name"],
            "category": row["category"],
            "local_authority": row["local_authority"],
            "latitude": row["latitude"],
            "longitude": row["longitude"],
            "priority": row["imagery_review_priority"],
            "reason": row["parking_knowledge_state"],
        }
        for row in venues
        if row["imagery_review_priority"] in {"high", "medium"}
    ]
    imagery_queue.sort(key=lambda row: (0 if row["priority"] == "high" else 1, row["local_authority"], row["name"]))

    return {
        "schema_version": "1.0",
        "generated_at": now_z(),
        "coverage": {
            "scope": "county_wide_network",
            "coverage_claim": COVERAGE_CLAIM,
            "local_authority_relation_ids": LOCAL_AUTHORITIES,
            "venue_source": "OpenStreetMap exact-local-authority traversal",
            "parking_source": "WHITEBLOCK Dublin enriched parking snapshot",
        },
        "summary": {
            "venues": len(venues),
            "venue_categories": dict(sorted(categories.items())),
            "parking_knowledge_states": dict(sorted(states.items())),
            "venues_with_any_mapped_parking_nearby": sum(1 for row in venues if row["mapped_parking_nearby"] > 0),
            "venues_with_strong_parking_association": sum(1 for row in venues if row["parking_knowledge_state"] == "source_backed_or_strongly_associated_parking"),
            "imagery_review_queue": len(imagery_queue),
            "open_24_7_venues": sum(1 for row in venues if row["venue_open_24_7"]),
        },
        "source_runs": source_meta,
        "knowledge_rules": [
            "Venue opening hours are not parking permission.",
            "A fuel station that is open 24/7 is not automatically suitable for unattended or long-stay parking.",
            "Customer parking is conditional and remains separate from general-public parking.",
            "Spatial proximity alone does not prove that a parking asset belongs to a venue.",
            "Requested stay must fit source-published maximum-stay/opening-hour evidence when those rules exist.",
            "Unknown access remains unknown; it is never promoted to public parking.",
            "Imagery can create/validate a physical parking candidate, but cannot establish legal access or live occupancy.",
            "Live availability remains null unless a source publishes occupancy/free-space observations.",
        ],
        "imagery_strategy": {
            "high_resolution_reference": "Tailte Éireann / GeoHive or other licensed high-resolution aerial imagery where terms permit analysis",
            "frequent_change_detection": "Copernicus Sentinel-2 may support coarse land-cover/change signals but is not treated as parking-bay or vehicle-count evidence",
            "commercial_future": "Use licensed high-resolution frequent imagery for automated candidate detection only after licensing, resolution and validation requirements are met",
            "candidate_truth_state": "candidate_not_legal_parking",
        },
        "venues": venues,
        "imagery_review_queue": imagery_queue,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Build County Dublin venue parking knowledge")
    parser.add_argument("--input", type=Path, default=Path("web/data/dublin_parking_snapshot.json"))
    parser.add_argument("--output", type=Path, default=Path("web/data/dublin_venue_knowledge.json"))
    args = parser.parse_args()

    snapshot = json.loads(args.input.read_text(encoding="utf-8"))
    coverage = snapshot.get("coverage") or {}
    if coverage.get("coverage_claim") != COVERAGE_CLAIM:
        raise SystemExit("Dublin snapshot precision disclaimer missing")
    actual = {key: int(value) for key, value in (coverage.get("local_authority_relation_ids") or {}).items()}
    if actual != LOCAL_AUTHORITIES:
        raise SystemExit(f"Dublin local-authority relations mismatch: {actual!r}")

    knowledge = build_knowledge(snapshot)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(knowledge, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(
        "WHITEBLOCK Dublin venue knowledge:",
        knowledge["summary"]["venues"], "venues /",
        knowledge["summary"]["venues_with_any_mapped_parking_nearby"], "with mapped parking nearby /",
        knowledge["summary"]["imagery_review_queue"], "imagery review candidates ->",
        args.output,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
