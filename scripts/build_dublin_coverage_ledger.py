#!/usr/bin/env python3
"""Build auditable County Dublin coverage artifacts.

The mapped-inventory ledger is intentionally diagnostic. A settlement with mapped
parking is reported as mapped inventory coverage, not as proof of complete real-
world parking coverage. Unassigned records remain visible as a quality gap.

The command also enriches the snapshot with conservative access/session-rule
semantics and publishes both the named-settlement audit and restriction audit.
This keeps GitHub Pages deployments and independent validation runs aligned.
"""

from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Dict, Iterable, List

import build_dublin_settlement_audit as settlement_audit
import enrich_dublin_access_rules as access_rules


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
                    "customer_only_assets": access.get("customer", 0),
                    "public_access_assets": access.get("public", 0),
                    "max_stay_published_assets": sum(
                        1 for item in items if item.get("maximum_stay_source_state") == "source_published"
                    ),
                    "opening_hours_published_assets": sum(
                        1 for item in items if item.get("opening_hours_source_state") == "source_published"
                    ),
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
        "schema_version": "1.2",
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
            "customer_only_assets": sum(1 for item in locations if item.get("access_type") == "customer"),
            "public_access_assets": sum(1 for item in locations if item.get("access_type") == "public"),
            "max_stay_published_assets": sum(
                1 for item in locations if item.get("maximum_stay_source_state") == "source_published"
            ),
            "opening_hours_published_assets": sum(
                1 for item in locations if item.get("opening_hours_source_state") == "source_published"
            ),
            "mapped_polygon_assets": sum(1 for item in locations if item.get("geometry")),
            "settlement_anchor_records": len(snapshot.get("settlement_anchors") or []),
        },
        "quality_rules": [
            "Mapped inventory presence is not a claim of exhaustive real-world parking coverage.",
            "Unknown access remains unknown and is not promoted to public parking.",
            "Customer-only parking remains conditional parking and is not promoted to general public parking.",
            "A maximum stay is enforced only where the source snapshot publishes one.",
            "No default supermarket or retail parking duration is assumed.",
            "Local-authority fallback assignments remain visible as geography-quality gaps.",
            "Capacity totals include only source-published integer capacity values.",
            "Named settlement audit rows are generated from the same published anchor evidence when available.",
        ],
        "local_authorities": authorities,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Build County Dublin settlement and restriction coverage artifacts")
    parser.add_argument("--input", type=Path, default=Path("web/data/dublin_parking_snapshot.json"))
    parser.add_argument("--output", type=Path, default=Path("web/data/dublin_coverage_ledger.json"))
    parser.add_argument(
        "--settlement-audit-output",
        type=Path,
        default=None,
        help="Optional audit path; defaults to dublin_settlement_audit.json beside the ledger",
    )
    parser.add_argument(
        "--restriction-audit-output",
        type=Path,
        default=None,
        help="Optional restriction audit path; defaults to dublin_restriction_audit.json beside the ledger",
    )
    args = parser.parse_args()

    raw_snapshot = json.loads(args.input.read_text(encoding="utf-8"))
    snapshot, restriction_audit = access_rules.enrich_snapshot(raw_snapshot)

    # Persist the enriched snapshot so the browser consumes exactly the same
    # access/session-rule semantics used by the coverage and evidence artifacts.
    args.input.write_text(json.dumps(snapshot, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    ledger = build_ledger(snapshot)
    audit = settlement_audit.build_audit(snapshot)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(ledger, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    audit_output = args.settlement_audit_output or args.output.with_name("dublin_settlement_audit.json")
    audit_output.parent.mkdir(parents=True, exist_ok=True)
    audit_output.write_text(json.dumps(audit, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    restriction_output = args.restriction_audit_output or args.output.with_name("dublin_restriction_audit.json")
    restriction_output.parent.mkdir(parents=True, exist_ok=True)
    restriction_output.write_text(json.dumps(restriction_audit, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(
        "WHITEBLOCK Dublin coverage ledger:",
        ledger["summary"]["parking_assets"], "assets /",
        ledger["summary"]["settlement_rows"], "settlement rows /",
        ledger["summary"]["unknown_access_assets"], "unknown access ->",
        args.output,
    )
    print(
        "WHITEBLOCK Dublin settlement audit sidecar:",
        audit["summary"]["named_settlement_rows"], "named settlements /",
        audit["summary"]["settlements_without_mapped_inventory"], "research gaps ->",
        audit_output,
    )
    print(
        "WHITEBLOCK Dublin restriction audit sidecar:",
        restriction_audit["summary"]["customer_only_assets"], "customer-only /",
        restriction_audit["summary"]["max_stay_published_assets"], "max-stay published /",
        restriction_audit["summary"]["unknown_access_assets"], "unknown access ->",
        restriction_output,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
