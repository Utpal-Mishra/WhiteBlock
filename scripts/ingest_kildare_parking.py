#!/usr/bin/env python3
"""Build a browser-safe County Kildare parking network snapshot.

Sources:
- Kildare County Council Accessible Parking ArcGIS FeatureServer (CC BY 4.0)
- Kildare County Council Kildare Town pay-parking / parking-study evidence
- Kildare Village official parking and EV information
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
from typing import Any, Dict, List, Optional, Tuple

KCC_FEATURE_URL = (
    "https://services-eu1.arcgis.com/7382h3fBABGPKrTJ/arcgis/rest/services/"
    "Kildare%20Accessible%20Parking/FeatureServer/0/query"
)
KILDARE_TOWN_PAY_URL = (
    "https://kildarecoco.ie/AllServices/Transport/PayParking/PayParkingKildareTown/"
)
KILDARE_TOWN_ACCESSIBLE_URL = (
    "https://kildarecoco.ie/AllServices/Transport/PayParking/AccessibleParking/"
    "AccessibleParkingBaysKildareTown/"
)
KILDARE_TOWN_STUDY_URL = (
    "https://kildarecoco.ie/AllServices/Planning/Part8Schemes/StrategicProjectsandPublicRealm/"
    "P8202308Part8-ProposedPublicRealmImprovementWorkstoMarketSquareKildareTown/"
    "Traffic%20and%20Transport%20Assessment%20Report.pdf"
)
KILDARE_VILLAGE_CAR_URL = (
    "https://www.thebicestercollection.com/kildare-village/en/getting-here/car"
)
KILDARE_VILLAGE_OSM_URL = "https://www.openstreetmap.org/way/45737506"
KILDARE_VILLAGE_OSM_ID = "WB-PARK-IE-KILDARE-OSM-W45737506"
APCOA_KILDARE_URL = "https://www.apcoaconnect.ie/locations"

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
KILDARE_TOWN_CENTRE = (53.1589, -6.9096)

# 2022 KCC/AECOM parking study. Kept as historical evidence rather than silently
# treating these capacities as current after subsequent public-realm changes.
TOWN_STUDY_CAPACITY_2022 = {
    "bride street car park": 80,
    "church car park": 16,
    "nugent street car park": 47,
    "claregate street": 27,
    "market square": 12,
    "main street": 23,
    "cleamore road": 32,
    "fire castle lane": 9,
    "silken thomas car park": 56,
    "cmws hall kildare parking": 19,
    "station road parking": 11,
    "bridge street": 17,
    "bangup lane": 4,
}

TOWN_STUDY_ALIASES = {
    "bride street car park": ["bride street car park", "bride street"],
    "church car park": ["church car park"],
    "nugent street car park": ["nugent street car park", "nugent street"],
    "claregate street": ["claregate street"],
    "market square": ["market square car park", "market square"],
    "main street": ["main street"],
    "cleamore road": ["cleamore road"],
    "fire castle lane": ["fire castle lane", "firecastle lane"],
    "silken thomas car park": ["silken thomas car park", "silken thomas"],
    "cmws hall kildare parking": ["cmws hall kildare parking", "cmws hall", "cmws"],
    "station road parking": ["station road parking", "station road"],
    "bridge street": ["bridge street"],
    "bangup lane": ["bangup lane"],
}

# Current KCC accessible-parking page states these Kildare Town locations/counts.
KILDARE_TOWN_ACCESSIBLE_COUNTS = {
    "dublin road": 1,
    "claregate street": 1,
    "market square": 1,
    "bride street": 1,
    "grey abbey road": 1,
    "tully road": 1,
    "top nolan car park": 3,
    "market square car park": 1,
    "st brigids square": 1,
}

# These locations are also listed by APCOA for Kildare Town. This list is used
# only to classify the named parking location; on-site signage remains authoritative.
APCOA_KILDARE_NAMES = {
    "market square",
    "market square car park",
    "bangup lane",
    "bride street",
    "bride street car park",
    "claregate street",
    "dublin street",
    "grey abbey road",
    "sraid na bpaisti",
    "st brigids car park",
    "st brigids square",
    "top nolan car park",
    "tully road",
    "white abbey road",
}

TOWN_WEEKEND_RULE = (
    "Kildare Town council pay parking is enforced 09:00–17:00 Monday–Friday. "
    "Kildare County Council states there is no council traffic-warden parking enforcement "
    "on Saturday; Sunday is outside the stated Mon–Fri enforcement period. Check on-site signage."
)

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


def normalize_name(value: Any) -> str:
    text = str(value or "").lower().replace("’", "'")
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def slug(value: str) -> str:
    return normalize_name(value).replace(" ", "-").upper()


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


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    radius = 6371.0088
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lam = math.radians(lng2 - lng1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lam / 2) ** 2
    return 2 * radius * math.asin(math.sqrt(a))


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
            except Exception as exc:
                errors.append(f"{endpoint}: {exc}")
    raise RuntimeError("Overpass parking query failed: " + " | ".join(errors[-4:]))


def element_point(element: Dict[str, Any]) -> Optional[Tuple[float, float]]:
    if element.get("type") == "node" and element.get("lat") is not None and element.get("lon") is not None:
        return float(element["lat"]), float(element["lon"])
    center = element.get("center") or {}
    if center.get("lat") is not None and center.get("lon") is not None:
        return float(center["lat"]), float(center["lon"])
    return None


def normalize_access(value: Any) -> str:
    access = normalize_name(value)
    if access in {"customers", "customer"}:
        return "customer"
    if access in {"yes", "public", "permissive"}:
        return "public"
    return access or "unknown"


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
        # Existing WHITEBLOCK browser contract uses a positive value as an
        # accessibility indicator. The exact accessible-bay count is not claimed.
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
        "access_type": normalize_access(tags.get("access")),
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


def study_match(name: str) -> Optional[Tuple[str, int]]:
    candidate = normalize_name(name)
    for canonical, aliases in TOWN_STUDY_ALIASES.items():
        if any(alias == candidate or alias in candidate for alias in aliases):
            return canonical, TOWN_STUDY_CAPACITY_2022[canonical]
    return None


def enrich_named_town_osm(osm: List[Dict[str, Any]], now: datetime) -> None:
    """Attach KCC study/rule evidence to already-mapped named town parking."""
    for record in osm:
        lat = float(record.get("latitude") or 0)
        lng = float(record.get("longitude") or 0)
        if haversine_km(lat, lng, *KILDARE_TOWN_CENTRE) > 2.0:
            continue
        match = study_match(str(record.get("name") or ""))
        if not match:
            continue
        canonical, historic_capacity = match
        record["area"] = "Kildare Town"
        record["historical_capacity_2022"] = historic_capacity
        record["town_parking_study"] = True
        record["evidence"] = list(record.get("evidence") or []) + [
            {
                "source": "Kildare County Council / AECOM 2022 parking assessment",
                "fact": f"{canonical.title()} included in 13-location town-centre study; {historic_capacity} spaces recorded in 2022",
                "url": KILDARE_TOWN_STUDY_URL,
                "truth_state": "observed_historical",
            }
        ]
        if normalize_name(record.get("name")) in APCOA_KILDARE_NAMES:
            record["pricing_raw"] = TOWN_WEEKEND_RULE
            record["access_type"] = "public"


def canonical_town_name(anchor_name: str) -> str:
    name = normalize_name(anchor_name)
    if name == "market square":
        return "Market Square Parking"
    if name == "st brigids square":
        return "St Brigid's Square Parking"
    if name in {"dublin road", "claregate street", "bride street", "grey abbey road", "tully road"}:
        return f"{anchor_name.strip()} Parking"
    return anchor_name.strip()


def promote_kildare_town_parking(
    accessible_records: List[Dict[str, Any]],
    osm: List[Dict[str, Any]],
    now: datetime,
) -> List[Dict[str, Any]]:
    """Turn official accessible-location anchors into recognisable parking assets.

    When an OSM parking polygon is close to the council accessible point we enrich
    the polygon. Otherwise the council point is retained as a representative
    parking-location point with an explicit coordinate-basis note.
    """
    promoted: List[Dict[str, Any]] = []

    for anchor in accessible_records:
        if "kildare" not in normalize_name(anchor.get("area")):
            continue
        key = normalize_name(anchor.get("name"))
        if key not in KILDARE_TOWN_ACCESSIBLE_COUNTS:
            continue

        lat = float(anchor["latitude"])
        lng = float(anchor["longitude"])
        nearest = None
        nearest_distance = float("inf")
        for record in osm:
            rlat = float(record.get("latitude") or 0)
            rlng = float(record.get("longitude") or 0)
            distance = haversine_km(lat, lng, rlat, rlng)
            if distance < nearest_distance and distance <= 0.14:
                nearest = record
                nearest_distance = distance

        name = canonical_town_name(str(anchor.get("name") or "Parking"))
        access_count = KILDARE_TOWN_ACCESSIBLE_COUNTS[key]
        study = study_match(name)
        historic_capacity = study[1] if study else None
        evidence = [
            {
                "source": "Kildare County Council accessible-parking register",
                "fact": f"Accessible parking published at {anchor.get('name')}; {access_count} designated bay(s)",
                "url": KILDARE_TOWN_ACCESSIBLE_URL,
                "truth_state": "observed",
            },
            {
                "source": "Kildare County Council Kildare Town pay-parking page",
                "fact": "Council enforcement stated as 09:00–17:00 Monday–Friday; no Saturday council traffic-warden enforcement",
                "url": KILDARE_TOWN_PAY_URL,
                "truth_state": "observed_rule",
            },
        ]
        if historic_capacity is not None:
            evidence.append(
                {
                    "source": "Kildare County Council / AECOM 2022 parking assessment",
                    "fact": f"{historic_capacity} spaces recorded at this town-centre location in 2022; retained as historical capacity only",
                    "url": KILDARE_TOWN_STUDY_URL,
                    "truth_state": "observed_historical",
                }
            )

        if nearest is not None:
            nearest.update(
                {
                    "name": name,
                    "area": "Kildare Town",
                    "access_type": "public",
                    "accessible_spaces": access_count,
                    "pricing_raw": TOWN_WEEKEND_RULE,
                    "source_key": "kildare_town_council_parking+openstreetmap",
                    "source_url": KILDARE_TOWN_PAY_URL,
                    "network_role": "parking_asset",
                    "historical_capacity_2022": historic_capacity,
                    "evidence": list(nearest.get("evidence") or []) + evidence,
                    "confidence": confidence_score(0.94, KCC_SOURCE_UPDATED_AT, 0.92, now),
                }
            )
            promoted.append(nearest)
            continue

        promoted.append(
            {
                "parking_id": f"WB-PARK-IE-KILDARE-KCC-{slug(name)}",
                "name": name,
                "area": "Kildare Town",
                "latitude": lat,
                "longitude": lng,
                "parking_type": "public_parking_location",
                "access_type": "public",
                "status": "known",
                "capacity": None,
                "available_spaces": None,
                "occupied_spaces": None,
                "occupancy_ratio": None,
                "observed_at": KCC_SOURCE_UPDATED_AT,
                "retrieved_at": iso_z(now),
                "truth_state": "observed",
                "confidence": confidence_score(0.94, KCC_SOURCE_UPDATED_AT, 0.88, now),
                "pricing_raw": TOWN_WEEKEND_RULE,
                "opening_hours_raw": None,
                "maximum_stay_minutes": None,
                "height_restriction_raw": None,
                "accessible_spaces": access_count,
                "ev_spaces": None,
                "source_key": "kildare_town_council_parking",
                "source_url": KILDARE_TOWN_PAY_URL,
                "network_role": "parking_asset",
                "coordinate_basis": "Representative point from the KCC accessible bay located at this parking location; not a surveyed car-park centroid",
                "historical_capacity_2022": historic_capacity,
                "evidence": evidence,
            }
        )

    return promoted


def enrich_kildare_village(osm: List[Dict[str, Any]], now: datetime) -> Dict[str, Any]:
    """Guarantee a recognisable Kildare Village parking asset with official facts."""
    target = next((item for item in osm if item.get("parking_id") == KILDARE_VILLAGE_OSM_ID), None)
    if target is None:
        # OSM way 45737506 parking centroid. Used only if an Overpass response omits
        # the known feature; source URL remains attached for auditability.
        target = {
            "parking_id": KILDARE_VILLAGE_OSM_ID,
            "name": "Kildare Village Parking",
            "area": "Kildare Town",
            "latitude": 53.15364,
            "longitude": -6.91816,
            "parking_type": "surface",
            "access_type": "customer",
            "status": "known",
            "capacity": None,
            "available_spaces": None,
            "occupied_spaces": None,
            "occupancy_ratio": None,
            "observed_at": None,
            "retrieved_at": iso_z(now),
            "truth_state": "observed",
            "confidence": confidence_score(0.94, None, 0.90, now),
            "opening_hours_raw": None,
            "maximum_stay_minutes": None,
            "height_restriction_raw": None,
            "source_key": "kildare_village_official+openstreetmap",
            "source_url": KILDARE_VILLAGE_CAR_URL,
            "network_role": "destination_parking",
            "surface_raw": "surface",
        }
        osm.append(target)

    target.update(
        {
            "name": "Kildare Village Parking",
            "area": "Kildare Town",
            "access_type": "customer",
            "pricing_raw": "Complimentary guest parking · EV charging is separately priced through ChargePoint",
            "accessible_spaces": max(1, int(target.get("accessible_spaces") or 0)),
            "ev_spaces": 26,
            "source_key": "kildare_village_official+openstreetmap",
            "source_url": KILDARE_VILLAGE_CAR_URL,
            "network_role": "destination_parking",
            "confidence": confidence_score(0.97, target.get("observed_at"), 0.96, now),
            "ev_charging_stations": 13,
            "ev_charging_power_kw": 11,
            "ev_operator": "ChargePoint",
            "accessibility_note": "OSM parking feature is tagged wheelchair=yes; exact accessible-bay count is not published in the official Village page",
            "evidence": list(target.get("evidence") or []) + [
                {
                    "source": "Kildare Village official getting-here page",
                    "fact": "All guest parking is complimentary",
                    "url": KILDARE_VILLAGE_CAR_URL,
                    "truth_state": "observed_rule",
                },
                {
                    "source": "Kildare Village official getting-here page",
                    "fact": "13 ChargePoint stations: 6 in the left main car park and 7 in the rear multi-storey; each serves 2 vehicles at 11 kW",
                    "url": KILDARE_VILLAGE_CAR_URL,
                    "truth_state": "observed",
                },
                {
                    "source": "OpenStreetMap way 45737506",
                    "fact": "Mapped parking area; wheelchair=yes",
                    "url": KILDARE_VILLAGE_OSM_URL,
                    "truth_state": "observed",
                },
            ],
        }
    )
    return target


def build_snapshot() -> Dict[str, Any]:
    now = utc_now()
    locations: List[Dict[str, Any]] = []
    sources: Dict[str, Any] = {}
    kcc: List[Dict[str, Any]] = []
    osm: List[Dict[str, Any]] = []

    try:
        kcc, meta = kcc_accessible_locations(now)
        locations.extend(kcc)
        sources["kildare_coco_accessible_parking"] = meta
    except Exception as exc:
        sources["kildare_coco_accessible_parking"] = {"count": 0, "status": "error", "error": str(exc)}

    try:
        osm, meta = osm_locations(now)
        sources["openstreetmap_kildare_parking"] = meta
    except Exception as exc:
        sources["openstreetmap_kildare_parking"] = {"count": 0, "status": "error", "error": str(exc)}

    if osm:
        enrich_named_town_osm(osm, now)
        village = enrich_kildare_village(osm, now)
        sources["kildare_village_official"] = {
            "count": 1,
            "status": "ok",
            "parking_id": village["parking_id"],
            "source_url": KILDARE_VILLAGE_CAR_URL,
        }
    else:
        village = enrich_kildare_village(osm, now)
        sources["kildare_village_official"] = {
            "count": 1,
            "status": "ok",
            "parking_id": village["parking_id"],
            "source_url": KILDARE_VILLAGE_CAR_URL,
            "note": "OSM fallback representative point used because Overpass inventory was unavailable",
        }

    promoted = promote_kildare_town_parking(kcc, osm, now) if kcc else []
    if promoted:
        sources["kildare_town_council_parking"] = {
            "count": len({item["parking_id"] for item in promoted}),
            "status": "ok",
            "pay_parking_url": KILDARE_TOWN_PAY_URL,
            "accessible_parking_url": KILDARE_TOWN_ACCESSIBLE_URL,
            "apcoa_directory_url": APCOA_KILDARE_URL,
        }

    locations.extend(osm)
    locations.extend(promoted)

    # Stable deterministic ordering and cross-source de-dup by canonical id.
    unique = {item["parking_id"]: item for item in locations}
    locations = sorted(unique.values(), key=lambda item: (item.get("area") or "", item.get("name") or "", item["parking_id"]))

    if not locations:
        raise RuntimeError("No Kildare parking locations could be retrieved from any source")

    capacity_values = [item["capacity"] for item in locations if isinstance(item.get("capacity"), int)]
    accessible_count = sum(1 for item in locations if (item.get("accessible_spaces") or 0) > 0)
    ev_count = sum(1 for item in locations if (item.get("ev_spaces") or 0) > 0)

    return {
        "schema_version": "1.1",
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
            "ev_locations": ev_count,
            "live_availability": False,
        },
        "licenses": [
            {"source": "Kildare County Council", "license": "CC BY 4.0"},
            {"source": "OpenStreetMap contributors", "license": "ODbL"},
            {"source": "Kildare Village", "license": "public factual service information; linked as evidence"},
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
