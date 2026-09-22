#!/usr/bin/env python3
"""Build the production County Kildare parking network snapshot.

This deployment entrypoint uses the same Overpass area-selector pattern proven
for County Cork. It queries the traditional County Kildare admin-level-6 area
and retains relation 285833 as explicit boundary provenance.

Live occupancy is never fabricated.
"""

from __future__ import annotations

import argparse
import json
import urllib.parse
from pathlib import Path
from typing import Any, Dict, List, Tuple

import ingest_kildare_parking as base

COUNTY_NAMES = ("Kildare", "County Kildare")


def overpass_query(county_name: str = "Kildare") -> str:
    safe_name = county_name.replace('"', '')
    return f"""
[out:json][timeout:70];
area["boundary"="administrative"]["admin_level"="6"]["name"="{safe_name}"]->.searchArea;
(
  nwr(area.searchArea)["amenity"="parking"];
  nwr(area.searchArea)["parking"~"street_side|lane"];
);
out meta geom;
""".strip()


def fetch_overpass() -> Tuple[Dict[str, Any], str, str]:
    errors: List[str] = []
    for county_name in COUNTY_NAMES:
        body = urllib.parse.urlencode({"data": overpass_query(county_name)}).encode("utf-8")
        for endpoint in base.OVERPASS_ENDPOINTS:
            try:
                payload = base.fetch_json(endpoint, data=body, timeout=85)
                if payload.get("elements"):
                    return payload, endpoint, county_name
                errors.append(f"{county_name} @ {endpoint}: empty response")
            except Exception as exc:
                errors.append(f"{county_name} @ {endpoint}: {exc}")
    raise RuntimeError("County Kildare Overpass parking query failed: " + " | ".join(errors[-6:]))


def osm_locations(now) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    payload, endpoint, matched_name = fetch_overpass()
    seen = set()
    output: List[Dict[str, Any]] = []
    for element in payload.get("elements", []):
        key = (element.get("type"), element.get("id"))
        if key in seen:
            continue
        seen.add(key)
        record = base.osm_location(element, now)
        if record is not None:
            output.append(record)
    return output, {
        "count": len(output),
        "status": "ok",
        "query_mode": "exact_county_boundary",
        "relation_id": base.KILDARE_OSM_RELATION_ID,
        "matched_area_name": matched_name,
        "admin_level": 6,
        "endpoint": endpoint,
        "license": "ODbL",
    }


def build_snapshot() -> Dict[str, Any]:
    now = base.utc_now()
    locations: List[Dict[str, Any]] = []
    sources: Dict[str, Any] = {}

    try:
        kcc, meta = base.kcc_accessible_locations(now)
        locations.extend(kcc)
        sources["kildare_coco_accessible_parking"] = meta
    except Exception as exc:
        sources["kildare_coco_accessible_parking"] = {
            "count": 0,
            "status": "error",
            "error": str(exc),
        }

    osm, osm_meta = osm_locations(now)
    locations.extend(osm)
    sources["openstreetmap_kildare_parking"] = osm_meta

    unique = {item["parking_id"]: item for item in locations}
    locations = sorted(
        unique.values(),
        key=lambda item: (item.get("area") or "", item.get("name") or "", item["parking_id"]),
    )
    if not locations:
        raise RuntimeError("No County Kildare parking locations could be retrieved")

    capacities = [item["capacity"] for item in locations if isinstance(item.get("capacity"), int)]
    polygons = sum(1 for item in locations if item.get("geometry"))
    accessible = sum(1 for item in locations if (item.get("accessible_spaces") or 0) > 0)
    ev = sum(1 for item in locations if (item.get("ev_spaces") or 0) > 0)

    return {
        "schema_version": "1.1",
        "generated_at": base.iso_z(now),
        "coverage": {
            "country": "IE",
            "region": "Kildare",
            "scope": "county_wide_network",
            "mode": "network_inventory",
            "availability_mode": "not_live",
            "osm_boundary_relation_id": base.KILDARE_OSM_RELATION_ID,
            "bounds": base.KILDARE_BOUNDS,
        },
        "sources": sources,
        "summary": {
            "locations": len(locations),
            "mapped_polygon_locations": polygons,
            "known_capacity": sum(capacities) if capacities else None,
            "accessible_locations": accessible,
            "ev_locations": ev,
            "live_availability": False,
        },
        "licenses": [
            {"source": "Kildare County Council", "license": "CC BY 4.0"},
            {"source": "OpenStreetMap contributors", "license": "ODbL"},
        ],
        "locations": locations,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Build complete County Kildare parking snapshot")
    parser.add_argument("--output", type=Path, default=Path("web/data/kildare_parking_snapshot.json"))
    args = parser.parse_args()
    snapshot = build_snapshot()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(snapshot, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(
        "WHITEBLOCK County Kildare network snapshot:",
        snapshot["summary"]["locations"],
        "locations /",
        snapshot["summary"]["mapped_polygon_locations"],
        "mapped polygons ->",
        args.output,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
