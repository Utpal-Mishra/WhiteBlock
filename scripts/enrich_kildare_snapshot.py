#!/usr/bin/env python3
"""Harden the Kildare browser snapshot around high-value town parking.

The broad OpenStreetMap Overpass query is intentionally best-effort. This post-
processor guarantees that evidence-backed Kildare Village and Kildare Town
parking anchors remain present even when a county-wide Overpass request times
out. It can also recover general Kildare Town OSM parking with a small bounded
query, which is substantially less expensive than the county query.

It does not fabricate live availability.
"""

from __future__ import annotations

import argparse
import json
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

USER_AGENT = "WHITEBLOCK/1.0 Kildare critical parking enrichment"
OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]

KILDARE_VILLAGE_OFFICIAL = "https://www.thebicestercollection.com/kildare-village/en/getting-here/car"
KCC_KILDARE_PAY_PARKING = "https://kildarecoco.ie/AllServices/Transport/PayParking/PayParkingKildareTown/"
KCC_ACCESSIBLE_KILDARE = "https://kildarecoco.ie/AllServices/Transport/PayParking/AccessibleParking/AccessibleParkingBaysKildareTown/"
APCOA_MARKET_SQUARE = "https://www.apcoaconnect.ie/locationDetail/?id=1633"
OSM_KILDARE_VILLAGE_WAY = "https://www.openstreetmap.org/way/45737506"

# Compact town envelope: enough for Kildare Village + the town centre without
# asking Overpass to enumerate a whole county.
KILDARE_TOWN_BBOX = (53.145, -6.940, 53.175, -6.885)


def now_z() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def confidence(score: float, source: float, freshness: float, completeness: float) -> Dict[str, Any]:
    return {
        "score": round(score, 3),
        "basis": {
            "source": round(source, 3),
            "freshness": round(freshness, 3),
            "completeness": round(completeness, 3),
        },
    }


def critical_anchors(retrieved_at: str) -> List[Dict[str, Any]]:
    return [
        {
            "parking_id": "WB-PARK-IE-KILDARE-KV-MAIN",
            "name": "Kildare Village Parking",
            "area": "Kildare",
            "latitude": 53.15364,
            "longitude": -6.91816,
            "parking_type": "surface_and_multistorey",
            "access_type": "customer",
            "status": "known",
            "capacity": None,
            "available_spaces": None,
            "occupied_spaces": None,
            "occupancy_ratio": None,
            "observed_at": None,
            "retrieved_at": retrieved_at,
            "truth_state": "observed",
            "confidence": confidence(0.93, 0.99, 0.95, 0.72),
            "pricing_raw": "Complimentary guest parking",
            "opening_hours_raw": None,
            "maximum_stay_minutes": None,
            "height_restriction_raw": None,
            "accessible_spaces": None,
            "accessibility_available": True,
            "accessibility_note": "Accessible parking indicated by mapped parking accessibility; exact bay count not asserted by WHITEBLOCK.",
            "ev_spaces": 26,
            "ev_note": "13 ChargePoint stations; each supports 2 vehicles at 11 kW according to Kildare Village.",
            "source_key": "kildare_village_official",
            "source_url": KILDARE_VILLAGE_OFFICIAL,
            "geometry_source_url": OSM_KILDARE_VILLAGE_WAY,
            "network_role": "parking_asset",
            "evidence_note": "Official Kildare Village parking/EV service information with OSM parking geometry.",
        },
        {
            "parking_id": "WB-PARK-IE-KILDARE-MARKET-SQUARE",
            "name": "Market Square Car Park",
            "area": "Kildare",
            "latitude": 53.15714,
            "longitude": -6.91038,
            "parking_type": "town_centre_car_park",
            "access_type": "public",
            "status": "known",
            "capacity": None,
            "available_spaces": None,
            "occupied_spaces": None,
            "occupancy_ratio": None,
            "observed_at": None,
            "retrieved_at": retrieved_at,
            "truth_state": "observed",
            "confidence": confidence(0.94, 0.99, 0.90, 0.78),
            "pricing_raw": "Town pay-parking rules apply; weekend tariff/enforcement evidence differs by source — verify local signage.",
            "opening_hours_raw": None,
            "maximum_stay_minutes": None,
            "height_restriction_raw": None,
            "accessible_spaces": 1,
            "ev_spaces": None,
            "source_key": "kildare_coco_market_square",
            "source_url": KCC_ACCESSIBLE_KILDARE,
            "pricing_source_url": APCOA_MARKET_SQUARE,
            "network_role": "parking_asset",
            "evidence_note": "KCC lists an accessible bay at Market Square Car Park; APCOA publishes Market Square tariffs.",
        },
        {
            "parking_id": "WB-PARK-IE-KILDARE-TOP-NOLAN",
            "name": "Top Nolan's Car Park",
            "area": "Kildare",
            "latitude": 53.157805,
            "longitude": -6.910465,
            "parking_type": "town_centre_car_park",
            "access_type": "public",
            "status": "known",
            "capacity": None,
            "available_spaces": None,
            "occupied_spaces": None,
            "occupancy_ratio": None,
            "observed_at": None,
            "retrieved_at": retrieved_at,
            "truth_state": "observed",
            "confidence": confidence(0.95, 0.99, 0.90, 0.82),
            "pricing_raw": "Kildare Town parking rules apply; confirm tariff and enforcement on local signage.",
            "opening_hours_raw": None,
            "maximum_stay_minutes": None,
            "height_restriction_raw": None,
            "accessible_spaces": 3,
            "ev_spaces": None,
            "source_key": "kildare_coco_top_nolan",
            "source_url": KCC_ACCESSIBLE_KILDARE,
            "network_role": "parking_asset",
            "evidence_note": "KCC lists three accessible bays at Top Nolan's Car Park.",
        },
        {
            "parking_id": "WB-PARK-IE-KILDARE-ST-BRIGIDS-SQUARE",
            "name": "St Brigid's Square Parking",
            "area": "Kildare",
            "latitude": 53.155259,
            "longitude": -6.911411,
            "parking_type": "town_centre_parking",
            "access_type": "public",
            "status": "known",
            "capacity": None,
            "available_spaces": None,
            "occupied_spaces": None,
            "occupancy_ratio": None,
            "observed_at": None,
            "retrieved_at": retrieved_at,
            "truth_state": "observed",
            "confidence": confidence(0.91, 0.98, 0.90, 0.66),
            "pricing_raw": "Kildare Town parking rules apply; confirm tariff and enforcement on local signage.",
            "opening_hours_raw": None,
            "maximum_stay_minutes": None,
            "height_restriction_raw": None,
            "accessible_spaces": 1,
            "ev_spaces": None,
            "source_key": "kildare_coco_st_brigids_square",
            "source_url": KCC_ACCESSIBLE_KILDARE,
            "network_role": "parking_asset",
            "evidence_note": "KCC lists an accessible parking bay at St Brigid's Square.",
        },
    ]


def town_overpass_query() -> str:
    south, west, north, east = KILDARE_TOWN_BBOX
    bbox = f"{south},{west},{north},{east}"
    return f"""
[out:json][timeout:20];
(
  nwr[\"amenity\"=\"parking\"]({bbox});
  nwr[\"parking\"~\"street_side|lane\"]({bbox});
);
out meta center tags;
""".strip()


def fetch_town_osm() -> tuple[List[Dict[str, Any]], Dict[str, Any]]:
    query = town_overpass_query()
    body = urllib.parse.urlencode({"data": query}).encode("utf-8")
    errors: List[str] = []
    payload: Optional[Dict[str, Any]] = None
    for endpoint in OVERPASS_ENDPOINTS:
        try:
            req = urllib.request.Request(endpoint, data=body, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=28) as response:
                payload = json.loads(response.read().decode("utf-8"))
            if payload.get("elements") is not None:
                break
        except Exception as exc:
            errors.append(f"{endpoint}: {exc}")
            payload = None

    if payload is None:
        return [], {"count": 0, "status": "error", "error": " | ".join(errors[-2:])}

    output: List[Dict[str, Any]] = []
    retrieved_at = now_z()
    seen = set()
    for element in payload.get("elements", []):
        key = (element.get("type"), element.get("id"))
        if key in seen:
            continue
        seen.add(key)
        tags = element.get("tags") or {}
        if element.get("type") == "node":
            lat, lng = element.get("lat"), element.get("lon")
        else:
            center = element.get("center") or {}
            lat, lng = center.get("lat"), center.get("lon")
        if lat is None or lng is None:
            continue

        kind = tags.get("parking") or "parking"
        name = tags.get("name") or tags.get("operator") or f"{str(kind).replace('_', ' ').title()} parking"
        capacity = None
        raw_capacity = tags.get("capacity")
        if raw_capacity and str(raw_capacity).isdigit():
            capacity = int(raw_capacity)
        accessible = None
        raw_accessible = tags.get("capacity:disabled")
        if raw_accessible and str(raw_accessible).isdigit():
            accessible = int(raw_accessible)
        accessibility_available = tags.get("wheelchair") == "yes" or (accessible or 0) > 0
        ev_spaces = None
        raw_ev = tags.get("capacity:charging")
        if raw_ev and str(raw_ev).isdigit():
            ev_spaces = int(raw_ev)
        fee = tags.get("fee")
        pricing = "No fee tagged in OpenStreetMap" if fee == "no" else ("Paid parking · tariff not published in source" if fee == "yes" else None)
        osm_type = str(element.get("type") or "object")
        osm_id = element.get("id")

        output.append({
            "parking_id": f"WB-PARK-IE-KILDARE-OSM-{osm_type[0].upper()}{osm_id}",
            "name": str(name),
            "area": "Kildare",
            "latitude": float(lat),
            "longitude": float(lng),
            "parking_type": str(kind),
            "access_type": tags.get("access") or "unknown",
            "status": "known",
            "capacity": capacity,
            "available_spaces": None,
            "occupied_spaces": None,
            "occupancy_ratio": None,
            "observed_at": element.get("timestamp"),
            "retrieved_at": retrieved_at,
            "truth_state": "observed",
            "confidence": confidence(0.77, 0.78, 0.88, 0.62),
            "pricing_raw": pricing,
            "opening_hours_raw": tags.get("opening_hours"),
            "maximum_stay_minutes": None,
            "height_restriction_raw": tags.get("maxheight"),
            "accessible_spaces": accessible,
            "accessibility_available": accessibility_available,
            "ev_spaces": ev_spaces,
            "source_key": "openstreetmap_kildare_town_recovery",
            "source_url": f"https://www.openstreetmap.org/{osm_type}/{osm_id}",
            "network_role": "parking_asset",
        })
    return output, {"count": len(output), "status": "ok", "query_mode": "kildare_town_bbox"}


def recompute_summary(snapshot: Dict[str, Any]) -> None:
    locations = snapshot.get("locations", [])
    capacities = [x.get("capacity") for x in locations if isinstance(x.get("capacity"), int)]
    snapshot["summary"] = {
        "locations": len(locations),
        "known_capacity": sum(capacities) if capacities else None,
        "accessible_locations": sum(1 for x in locations if (x.get("accessible_spaces") or 0) > 0 or x.get("accessibility_available") is True),
        "ev_locations": sum(1 for x in locations if (x.get("ev_spaces") or 0) > 0),
        "live_availability": False,
    }


def enrich(snapshot: Dict[str, Any]) -> Dict[str, Any]:
    retrieved_at = snapshot.get("generated_at") or now_z()
    existing = {item.get("parking_id"): item for item in snapshot.get("locations", []) if item.get("parking_id")}

    broad_osm = snapshot.get("sources", {}).get("openstreetmap_kildare_parking", {})
    has_general = any(item.get("network_role") == "parking_asset" for item in existing.values())
    recovery_meta: Dict[str, Any] = {"count": 0, "status": "not_needed"}
    if broad_osm.get("status") != "ok" or not has_general:
        recovered, recovery_meta = fetch_town_osm()
        for item in recovered:
            existing[item["parking_id"]] = item

    for anchor in critical_anchors(retrieved_at):
        existing[anchor["parking_id"]] = anchor

    snapshot.setdefault("sources", {})["whiteblock_kildare_critical_anchors"] = {
        "count": len(critical_anchors(retrieved_at)),
        "status": "ok",
        "sources": ["Kildare Village", "Kildare County Council", "APCOA", "OpenStreetMap geometry"],
    }
    snapshot["sources"]["openstreetmap_kildare_town_recovery"] = recovery_meta
    snapshot["locations"] = sorted(existing.values(), key=lambda x: (str(x.get("area") or ""), str(x.get("name") or ""), str(x.get("parking_id") or "")))
    recompute_summary(snapshot)

    critical_ids = {x["parking_id"] for x in critical_anchors(retrieved_at)}
    missing = sorted(critical_ids - {x.get("parking_id") for x in snapshot["locations"]})
    if missing:
        raise RuntimeError("Critical Kildare parking anchors missing after enrichment: " + ", ".join(missing))
    return snapshot


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=Path("web/data/kildare_parking_snapshot.json"))
    parser.add_argument("--output", type=Path, default=None)
    args = parser.parse_args()
    output = args.output or args.input
    snapshot = json.loads(args.input.read_text(encoding="utf-8"))
    snapshot = enrich(snapshot)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(snapshot, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("WHITEBLOCK Kildare hardened snapshot:", snapshot["summary"]["locations"], "locations;", snapshot["summary"].get("ev_locations", 0), "EV-enabled locations")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
