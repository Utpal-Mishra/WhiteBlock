#!/usr/bin/env python3
"""Build a conservative County Kildare fallback snapshot.

Used only when the exact-boundary county inventory cannot be refreshed in the
deployment time budget. It combines current Kildare County Council accessible-
parking points with WHITEBLOCK's maintained high-confidence Kildare parking
anchors. The snapshot is explicitly PARTIAL and must never be labelled complete
county coverage.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import ingest_kildare_parking as base
from enrich_kildare_snapshot import critical_anchors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=Path("web/data/kildare_parking_snapshot.json"))
    args = parser.parse_args()

    now = base.utc_now()
    retrieved_at = base.iso_z(now)
    locations = []
    sources = {}

    try:
        council, meta = base.kcc_accessible_locations(now)
        locations.extend(council)
        sources["kildare_coco_accessible_parking"] = meta
    except Exception as exc:
        sources["kildare_coco_accessible_parking"] = {
            "count": 0,
            "status": "error",
            "error": str(exc),
        }

    anchors = critical_anchors(retrieved_at)
    locations.extend(anchors)
    sources["whiteblock_kildare_critical_anchors"] = {
        "count": len(anchors),
        "status": "ok",
        "role": "high_confidence_fallback_parking_anchors",
    }

    unique = {str(item.get("parking_id")): item for item in locations if item.get("parking_id")}
    locations = sorted(unique.values(), key=lambda item: (str(item.get("area") or ""), str(item.get("name") or ""), str(item.get("parking_id"))))
    if not locations:
        raise SystemExit("No Kildare fallback evidence locations are available")

    capacities = [item.get("capacity") for item in locations if isinstance(item.get("capacity"), int)]
    snapshot = {
        "schema_version": "1.2",
        "generated_at": retrieved_at,
        "coverage": {
            "country": "IE",
            "region": "Kildare",
            "scope": "partial_evidence_anchors",
            "mode": "network_inventory_fallback",
            "availability_mode": "not_live",
            "coverage_claim": "partial_not_county_complete",
            "osm_boundary_relation_id": base.KILDARE_OSM_RELATION_ID,
            "bounds": base.KILDARE_BOUNDS,
            "reason": "Exact-boundary county inventory refresh unavailable within deployment time budget.",
        },
        "sources": sources,
        "summary": {
            "locations": len(locations),
            "mapped_polygon_locations": sum(1 for item in locations if item.get("geometry")),
            "known_capacity": sum(capacities) if capacities else None,
            "accessible_locations": sum(1 for item in locations if (item.get("accessible_spaces") or 0) > 0 or item.get("accessibility_available") is True),
            "ev_locations": sum(1 for item in locations if (item.get("ev_spaces") or 0) > 0),
            "live_availability": False,
            "coverage_complete": False,
        },
        "licenses": [
            {"source": "Kildare County Council", "license": "CC BY 4.0"},
            {"source": "WHITEBLOCK maintained evidence anchors", "role": "fallback"},
        ],
        "locations": locations,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(snapshot, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"WHITEBLOCK Kildare partial fallback: {len(locations)} evidence anchors -> {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
