#!/usr/bin/env python3
"""Build a provenance-labelled County Wicklow parking inventory from OSM.

The exact administrative county relation is the inclusion boundary. The existing
Bray seafront evidence pilot owns the 5 km Bray area, so that the two displayed
regional summaries never double-count the same assets. This is mapped supply,
not verified completeness, current legality, live availability or partnerships.
"""

from __future__ import annotations

import argparse
import json
import re
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

COUNTY_RELATION_ID = 282760  # OSM admin_level=6, County Wicklow (IE-WW).
OVERPASS_ENDPOINTS = (
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
)
BRAY_CENTER = (53.2048, -6.0996)
BRAY_PILOT_RADIUS_KM = 5.0

# Settlement assignment is an approximate browser navigation grouping, NOT
# an assertion about municipal boundaries or street-level geocoding.
HUBS = (
    ("Wicklow Town", 52.9808, -6.0446),
    ("Greystones", 53.1434, -6.0635),
    ("Arklow", 52.7932, -6.1412),
    ("Blessington", 53.1693, -6.5328),
    ("Baltinglass", 52.9405, -6.7068),
    ("Rathdrum", 52.9316, -6.2291),
    ("Glendalough / Laragh", 53.0102, -6.3288),
    ("Roundwood", 53.0646, -6.2258),
    ("Newtownmountkennedy", 53.0897, -6.1116),
    ("Enniskerry", 53.1920, -6.1692),
    ("Kilcoole", 53.1019, -6.0656),
    ("Aughrim", 52.8540, -6.3316),
    ("Avoca", 52.8521, -6.2160),
    ("Brittas Bay", 52.8725, -6.0813),
    ("Dunlavin", 53.0581, -6.7043),
    ("Carnew", 52.7077, -6.4941),
    ("Shillelagh", 52.7530, -6.5379),
    ("Tinahely", 52.7974, -6.4633),
    ("Ashford", 53.0120, -6.1113),
    ("Rathnew", 52.9906, -6.0858),
)

BYLAWS_URL = "https://www.wicklow.ie/Living/Services/Roads-Transport/Road-Policy/Parking-Bye-Laws"
USER_AGENT = "WHITEBLOCK/1.0 County-Wicklow-mapped-parking-research"

def distance_km(a, b, c, d):
    from math import asin, cos, radians, sin, sqrt
    x = sin(radians(c - a) / 2) ** 2 + cos(radians(a)) * cos(radians(c)) * sin(radians(d - b) / 2) ** 2
    return 12742 * asin(sqrt(min(1, x)))

def osm_query():
    return f"""[out:json][timeout:90];
rel({COUNTY_RELATION_ID})->.boundary;
map_to_area.boundary->.searchArea;
(
 nwr["amenity"="parking"](area.searchArea);
 nwr["parking"~"street_side|lane"](area.searchArea);
);
out meta center geom;"""

def fetch_osm():
    payload = urllib.parse.urlencode({"data": osm_query()}).encode("utf-8")
    errors = []
    for endpoint in OVERPASS_ENDPOINTS:
        try:
            req = urllib.request.Request(endpoint, data=payload, headers={
                "User-Agent": USER_AGENT, "Accept": "application/json"
            })
            with urllib.request.urlopen(req, timeout=110) as response:
                data = json.load(response)
            if not isinstance(data.get("elements"), list) or not data["elements"]:
                raise ValueError("empty Overpass elements")
            return data["elements"], endpoint
        except Exception as exc:
            errors.append(f"{endpoint}: {exc}")
    raise RuntimeError("All exact-county Overpass queries failed: " + " | ".join(errors))

def get_point(element):
    if element.get("lat") is not None and element.get("lon") is not None:
        return float(element["lat"]), float(element["lon"])
    center = element.get("center") or {}
    if center.get("lat") is not None and center.get("lon") is not None:
        return float(center["lat"]), float(center["lon"])
    points = element.get("geometry") or []
    points = [p for p in points if p.get("lat") is not None and p.get("lon") is not None]
    if not points:
        return None
    return (sum(float(p["lat"]) for p in points) / len(points),
            sum(float(p["lon"]) for p in points) / len(points))

def get_polygon(element):
    if element.get("type") != "way" or (element.get("tags") or {}).get("area") == "no":
        return None
    points = element.get("geometry") or []
    coords = [[float(p["lon"]), float(p["lat"])] for p in points
              if p.get("lat") is not None and p.get("lon") is not None]
    # Open street/road ways must NEVER be turned into fictional car-park polygons.
    if len(coords) < 4 or coords[0] != coords[-1]:
        return None
    return {"type": "Polygon", "coordinates": [coords]}

def parse_capacity(raw):
    if raw is None:
        return None
    text = str(raw).strip()
    return int(text) if re.fullmatch(r"\d+", text) else None

def settlement(lat, lng, tags):
    named = next((tags[k] for k in ("addr:city", "addr:town", "addr:village", "is_in:city", "is_in:town")
                  if tags.get(k)), None)
    if named:
        return named, "osm_tag"
    name, distance = min(((h[0], distance_km(lat, lng, h[1], h[2])) for h in HUBS), key=lambda v: v[1])
    return (name, "nearest_hub_approximation") if distance <= 14 else ("Other County Wicklow", "unassigned")

def make_record(element, now):
    point = get_point(element)
    if point is None or element.get("id") is None:
        return None
    lat, lng = point
    # Bray has a separately curated, already published seafront pilot.
    if distance_km(lat, lng, *BRAY_CENTER) <= BRAY_PILOT_RADIUS_KM:
        return None
    tags = element.get("tags") or {}
    area, area_source = settlement(lat, lng, tags)
    osm_type = str(element.get("type"))
    osm_id = element["id"]
    parking_kind = tags.get("parking") or "surface"
    name = tags.get("name") or tags.get("operator") or f"{parking_kind.replace('_', ' ').title()} parking"
    geometry = get_polygon(element)
    capacity = parse_capacity(tags.get("capacity"))
    accessible = parse_capacity(tags.get("capacity:disabled"))
    ev = parse_capacity(tags.get("capacity:charging"))
    fee = tags.get("fee")
    pricing = tags.get("charge") or (
        "OSM fee=no (verify on-site)" if fee == "no" else
        "OSM fee=yes (tariff unverified)" if fee == "yes" else None
    )
    checked = sum((bool(tags.get("name")), capacity is not None, bool(tags.get("access")),
                   bool(tags.get("opening_hours")), bool(tags.get("fee")), geometry is not None))
    return {
        "parking_id": f"WB-PARK-IE-WICKLOW-OSM-{osm_type[0].upper()}{osm_id}",
        "name": name, "area": area, "area_source": area_source,
        "latitude": lat, "longitude": lng,
        "geometry": geometry, "geometry_truth_state": "observed" if geometry else None,
        "parking_type": parking_kind, "access_type": tags.get("access") or "unknown",
        "capacity": capacity, "available_spaces": None, "occupancy_ratio": None,
        "accessible_spaces": accessible, "ev_spaces": ev,
        "pricing_raw": pricing, "opening_hours_raw": tags.get("opening_hours"),
        "height_restriction_raw": tags.get("maxheight"),
        "maximum_stay_minutes": None,
        "observed_at": element.get("timestamp"), "retrieved_at": now,
        "truth_state": "observed",
        "confidence": {"score": round(0.62 + 0.22 * checked / 6, 3),
                       "basis": {"source": 0.74, "completeness": round(checked / 6, 3)}},
        "source_key": "openstreetmap_wicklow_parking",
        "source_url": f"https://www.openstreetmap.org/{osm_type}/{osm_id}",
        "network_role": "parking_asset",
    }

def build_snapshot(elements, endpoint, now):
    unique = {}
    for element in elements:
        record = make_record(element, now)
        if record:
            unique[record["parking_id"]] = record
    locations = sorted(unique.values(), key=lambda x: (x["area"], x["name"], x["parking_id"]))
    if not locations:
        raise ValueError("County Wicklow query yielded no records outside existing Bray pilot")
    capacities = [r["capacity"] for r in locations if r["capacity"] is not None]
    return {
        "schema_version": "1.1", "generated_at": now,
        "coverage": {
            "country": "IE", "region": "Wicklow", "scope": "county_mapped_inventory_excluding_bray_pilot",
            "mode": "network_inventory", "availability_mode": "not_live",
            "coverage_complete": False, "coverage_claim": "partial_mapped_not_exhaustive",
            "osm_boundary_relation_id": COUNTY_RELATION_ID, "admin_level": 6,
            "excluded_existing_pilot": {"region": "Bray", "radius_km": BRAY_PILOT_RADIUS_KM},
        },
        "sources": {"openstreetmap_wicklow_parking": {
            "status": "ok", "query_mode": "exact_county_boundary", "relation_id": COUNTY_RELATION_ID,
            "endpoint": endpoint, "license": "ODbL", "retrieved_at": now
        }, "council_parking_rules": {
            "source_url": BYLAWS_URL,
            "status": "reference_only_not_automatically_joined",
        }},
        "summary": {
            "locations": len(locations),
            "mapped_polygon_locations": sum(bool(r["geometry"]) for r in locations),
            "known_capacity": sum(capacities) if capacities else None,
            "live_availability": False, "coverage_complete": False,
        },
        "licenses": [{"source": "OpenStreetMap contributors", "license": "ODbL"}],
        "locations": locations,
    }

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=Path("web/data/wicklow_parking_snapshot.json"))
    args = parser.parse_args()
    elements, endpoint = fetch_osm()
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    snapshot = build_snapshot(elements, endpoint, now)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(snapshot, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wicklow mapped inventory: {len(snapshot['locations'])} places; "
          f"{snapshot['summary']['mapped_polygon_locations']} polygons; no live occupancy")

if __name__ == "__main__":
    main()
