#!/usr/bin/env python3
"""Build an auditable city/town/suburb/village coverage ledger for Dublin.

The ledger is intentionally diagnostic. A settlement with mapped parking is
reported as mapped inventory coverage, not as proof of complete real-world
parking coverage. Unassigned records remain visible as a quality gap.
"""

from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Dict, Iterable, List


def sorted_unique(values: Iterable[Any]) -> List[str]:
    return sorted({str(value) for value in values if value not in (None, "")})


def build_ledger(snapshot: Dict[str, Any]) -> Dict[str, Any]:
    locations = list(snapshot.get("locations") or [])
    by_authority: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for item in locations:
        by_authority[str(item.get("local_authority") or "UNASSIGNED_LOCAL_AUTHORITY")].append(item)

    authorities: List[Dict[str, Any]] = []
    for authority, authority_items in sorted(by_authority.items()):
        by_settlement: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        for item in authority_items:
            settlement = str(item.get("settlement") or item.get("area") or "UNASSIGNED_SETTLEMENT")
            by_settlement[settlement].append(item)

        settlements: List[Dict[str, Any]] = []
        for settlement, items in sorted(by_settlement.items()):
            types = Counter(str(item.get("settlement_type") or "unknown") for item in items)
            assignment_methods = Counter(str(item.get("settlement_assignment_method") or "unknown") for item in items)
            access = Counter(str(item.get("access_type") or "unknown") for item in items)
            capacity_records = [item for item in items if isinstance(item.get("capacity"), int)]
            polygons = sum(1 for item in items if item.get("geometry"))
            settlements.append(
                {
                    "settlement": settlement,
                    "settlement_types": dict(sorted(types.items())),
                    "parking_assets": len(items),
                    "mapped_polygon_assets": polygons,
                    "known_capacity_assets": len(capacity_records),
                    "known_capacity_spaces": sum(item["capacity"] for item in capacity_records),
                    "unknown_access_assets": access.get("unknown", 0),
                    "access_states": dict(sorted(access.items())),
                    "assignment_methods": dict(sorted(assignment_methods.items())),
                    "source_keys": sorted_unique(item.get("source_key") for item in items),
                    "coverage_state": "mapped_inventory_present",
                    "coverage_claim": "not_real_world_exhaustive",
                }
            )

        authorities.append(
            {
                "local_authority": authority,
                "parking_assets": len(authority_items),
                "settlements_with_mapped_inventory": len(settlements),
                "unassigned_settlement_assets": sum(
                    1
                    for item in authority_items
                    if not item.get("settlement") and not item.get("area")
                ),
                "settlements": settlements,
            }
        )

    return {
        "schema_version": "1.0",
        "generated_at": snapshot.get("generated_at"),
        "source_snapshot_schema_version": snapshot.get("schema_version"),
        "coverage": snapshot.get("coverage") or {},
        "summary": {
            "parking_assets": len(locations),
            "local_authorities": len(authorities),
            "settlement_rows": sum(len(item["settlements"]) for item in authorities),
            "settlement_assignment_fallback_assets": sum(
                1
                for item in locations
                if item.get("settlement_assignment_method") == "local_authority_fallback"
            ),
            "unknown_access_assets": sum(1 for item in locations if item.get("access_type") == "unknown"),
            "mapped_polygon_assets": sum(1 for item in locations if item.get("geometry")),
        },
        "quality_rules": [
            "Mapped inventory presence is not a claim of exhaustive real-world parking coverage.",
            "Unknown access remains unknown and is not promoted to public parking.",
            "Local-authority fallback assignments remain visible as geography-quality gaps.",
            "Capacity totals include only source-published integer capacity values.",
        ],
        "local_authorities": authorities,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Build County Dublin settlement coverage ledger")
    parser.add_argument("--input", type=Path, default=Path("web/data/dublin_parking_snapshot.json"))
    parser.add_argument("--output", type=Path, default=Path("web/data/dublin_coverage_ledger.json"))
    args = parser.parse_args()

    snapshot = json.loads(args.input.read_text(encoding="utf-8"))
    ledger = build_ledger(snapshot)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(ledger, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(
        "WHITEBLOCK Dublin coverage ledger:",
        ledger["summary"]["parking_assets"], "assets /",
        ledger["summary"]["settlement_rows"], "settlement rows /",
        ledger["summary"]["settlement_assignment_fallback_assets"], "fallback assignments ->",
        args.output,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
