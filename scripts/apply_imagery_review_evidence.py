#!/usr/bin/env python3
"""Overlay reviewed imagery evidence onto a WHITEBLOCK regional snapshot.

The overlay is metadata-only. It never creates parking polygons, changes legal
access, invents capacity, or creates availability/occupancy observations.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict, List


def load(path: Path) -> Dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def index_evidence(payload: Dict[str, Any], region: str | None = None) -> Dict[str, Dict[str, Any]]:
    rows = payload.get("records") or []
    output: Dict[str, Dict[str, Any]] = {}
    for row in rows:
        if region and str(row.get("region") or "").lower() != region.lower():
            continue
        parking_id = row.get("parking_id")
        if parking_id:
            output[str(parking_id)] = row
    return output


def public_review(row: Dict[str, Any]) -> Dict[str, Any]:
    result = {
        "review_id": "WB-IMG-20261003-001",
        "reviewed_at": row.get("reviewed_at"),
        "provider": row.get("imagery_provider"),
        "imagery_product": row.get("imagery_product"),
        "imagery_acquisition_date": row.get("imagery_acquisition_date"),
        "imagery_resolution_m": row.get("imagery_resolution_m"),
        "review_result": row.get("review_result"),
        "physical_parking_evidence": bool(row.get("physical_parking_evidence")),
        "geometry_action": row.get("geometry_action"),
        "confidence": row.get("confidence"),
        "note": row.get("note"),
        "access_caveat": row.get("access_caveat"),
        "occupancy_caveat": row.get("occupancy_caveat"),
    }
    action = row.get("geometry_action")
    if action == "candidate_polygon_allowed":
        result["candidate_status"] = "physical_supply_confirmed_geometry_not_digitized"
    elif action == "field_verification_required":
        result["candidate_status"] = "field_or_fresh_imagery_verification_required"
    elif row.get("review_result") == "no_distinct_parking_footprint":
        result["candidate_status"] = "imagery_did_not_confirm_distinct_footprint"
    else:
        result["candidate_status"] = "retain_existing_point_or_corridor_semantics"
    return result


def apply(snapshot: Dict[str, Any], evidence: Dict[str, Dict[str, Any]]) -> Dict[str, int]:
    stats = {"matched": 0, "unmatched": 0, "visible": 0, "ambiguous": 0, "not_confirmed": 0, "stale": 0}
    ids = set()
    for item in snapshot.get("locations") or []:
        parking_id = str(item.get("parking_id") or "")
        if parking_id:
            ids.add(parking_id)
        row = evidence.get(parking_id)
        if not row:
            continue
        item["imagery_review"] = public_review(row)
        stats["matched"] += 1
        state = row.get("review_result")
        if state == "physical_parking_visible":
            stats["visible"] += 1
        elif state == "parking_context_visible_extent_ambiguous":
            stats["ambiguous"] += 1
        elif state == "no_distinct_parking_footprint":
            stats["not_confirmed"] += 1
        elif state == "visible_but_stale_imagery":
            stats["stale"] += 1

    stats["unmatched"] = sum(1 for parking_id in evidence if parking_id not in ids)

    summary = snapshot.setdefault("summary", {})
    summary["imagery_review"] = {
        "reviewed_assets": stats["matched"],
        "physical_parking_visible": stats["visible"],
        "parking_context_visible_extent_ambiguous": stats["ambiguous"],
        "no_distinct_parking_footprint": stats["not_confirmed"],
        "visible_but_stale_imagery": stats["stale"],
        "automatic_geometry_created": 0,
        "live_occupancy_inferred": False,
    }
    sources = snapshot.setdefault("sources", {})
    sources["whiteblock_imagery_review_20261003"] = {
        "status": "reviewed",
        "review_id": "WB-IMG-20261003-001",
        "provider": "Esri World Imagery",
        "role": "physical_supply_validation_only",
        "stored_imagery": False,
        "matched_records": stats["matched"],
        "legal_access_inferred": False,
        "live_occupancy_inferred": False,
    }
    return stats


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--snapshot", type=Path, required=True)
    parser.add_argument("--evidence", type=Path, default=Path("config/imagery_review_evidence.json"))
    parser.add_argument("--region", default=None)
    parser.add_argument("--output", type=Path, default=None)
    args = parser.parse_args()

    if not args.snapshot.exists():
        print(f"Snapshot not present; skipping imagery overlay: {args.snapshot}")
        return 0

    snapshot = load(args.snapshot)
    evidence_payload = load(args.evidence)
    evidence = index_evidence(evidence_payload, args.region)
    stats = apply(snapshot, evidence)
    output = args.output or args.snapshot
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(snapshot, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Applied imagery evidence to {output}: {json.dumps(stats, sort_keys=True)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
