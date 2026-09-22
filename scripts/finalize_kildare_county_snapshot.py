#!/usr/bin/env python3
"""Finalize the enriched County Kildare browser snapshot.

The Kildare enrichment step adds authoritative anchors. This finalizer recomputes
county-wide summary metrics without losing mapped OSM geometry counts and fails
closed if the exact county-boundary OSM source has degraded.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict

EXPECTED_OSM_RELATION_ID = 285833


def finalize(snapshot: Dict[str, Any]) -> Dict[str, Any]:
    locations = snapshot.get("locations") or []
    if not locations:
        raise RuntimeError("County Kildare snapshot is empty")

    osm_meta = (snapshot.get("sources") or {}).get("openstreetmap_kildare_parking") or {}
    if osm_meta.get("status") != "ok":
        raise RuntimeError("County Kildare OSM source is not healthy")
    if osm_meta.get("query_mode") != "exact_county_boundary":
        raise RuntimeError("County Kildare snapshot was not built from the exact county boundary")
    if int(osm_meta.get("relation_id") or 0) != EXPECTED_OSM_RELATION_ID:
        raise RuntimeError("County Kildare OSM boundary relation mismatch")

    capacities = [x.get("capacity") for x in locations if isinstance(x.get("capacity"), int)]
    polygons = sum(
        1
        for x in locations
        if isinstance(x.get("geometry"), dict)
        and x.get("geometry", {}).get("type") in {"Polygon", "MultiPolygon"}
    )
    if polygons <= 0:
        raise RuntimeError("County Kildare snapshot contains no mapped parking polygons")

    snapshot.setdefault("coverage", {})["scope"] = "county_wide_network"
    snapshot["coverage"]["osm_boundary_relation_id"] = EXPECTED_OSM_RELATION_ID
    snapshot["summary"] = {
        "locations": len(locations),
        "mapped_polygon_locations": polygons,
        "known_capacity": sum(capacities) if capacities else None,
        "accessible_locations": sum(
            1
            for x in locations
            if (x.get("accessible_spaces") or 0) > 0 or x.get("accessibility_available") is True
        ),
        "ev_locations": sum(1 for x in locations if (x.get("ev_spaces") or 0) > 0),
        "live_availability": False,
    }
    return snapshot


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=Path("web/data/kildare_parking_snapshot.json"))
    parser.add_argument("--output", type=Path, default=None)
    args = parser.parse_args()
    output = args.output or args.input

    snapshot = json.loads(args.input.read_text(encoding="utf-8"))
    snapshot = finalize(snapshot)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(snapshot, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(
        "WHITEBLOCK County Kildare finalized:",
        snapshot["summary"]["locations"],
        "locations /",
        snapshot["summary"]["mapped_polygon_locations"],
        "mapped polygons",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
