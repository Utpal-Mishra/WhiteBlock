#!/usr/bin/env python3
"""Build a deterministic County Dublin access-evidence research queue.

The queue prioritises *unknown access evidence*, not parking construction or
availability. It never promotes a parking asset to public/customer/restricted;
those state changes require source evidence in the canonical snapshot.

Priority is deliberately rule-based and auditable rather than a pseudo-ML score:
- P0: >= 100 unknown-access mapped assets in one settlement
- P1: 50-99
- P2: 20-49
- P3: 1-19
Within a tier, settlements sort by unknown count, then unknown share, then name.
"""

from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple

COVERAGE_CLAIM = "complete_boundary_traversal_not_complete_real_world_inventory"
UNKNOWN_RAW_ACCESS = {"", "unknown", "designated"}


def raw_access(item: Dict[str, Any]) -> str:
    return str(item.get("access_type") or item.get("accessType") or "unknown").strip().lower()


def is_unknown_access(item: Dict[str, Any]) -> bool:
    return raw_access(item) in UNKNOWN_RAW_ACCESS


def priority_tier(unknown_count: int) -> Tuple[str, str]:
    if unknown_count >= 100:
        return "P0", "100+ unknown-access assets"
    if unknown_count >= 50:
        return "P1", "50-99 unknown-access assets"
    if unknown_count >= 20:
        return "P2", "20-49 unknown-access assets"
    return "P3", "1-19 unknown-access assets"


def useful_source_keys(items: Iterable[Dict[str, Any]]) -> List[str]:
    return sorted({
        str(item.get("source_key"))
        for item in items
        if item.get("source_key") not in (None, "")
    })


def source_state_count(items: Iterable[Dict[str, Any]], field: str) -> int:
    return sum(1 for item in items if item.get(field) == "source_published")


def build_queue(snapshot: Dict[str, Any]) -> Dict[str, Any]:
    coverage = snapshot.get("coverage") or {}
    if coverage.get("coverage_claim") != COVERAGE_CLAIM:
        raise ValueError("Dublin snapshot is missing the mandatory precision coverage claim")

    locations = list(snapshot.get("locations") or [])
    grouped: Dict[Tuple[str, str], List[Dict[str, Any]]] = defaultdict(list)
    for item in locations:
        authority = str(item.get("local_authority") or "UNASSIGNED_LOCAL_AUTHORITY")
        settlement = str(item.get("settlement") or item.get("area") or "UNASSIGNED_SETTLEMENT")
        grouped[(authority, settlement)].append(item)

    rows: List[Dict[str, Any]] = []
    for (authority, settlement), items in grouped.items():
        unknown_items = [item for item in items if is_unknown_access(item)]
        if not unknown_items:
            continue

        unknown_count = len(unknown_items)
        tier, reason = priority_tier(unknown_count)
        types = Counter(str(item.get("settlement_type") or "unknown") for item in items)
        assignment_methods = Counter(str(item.get("settlement_assignment_method") or "unknown") for item in items)
        unknown_share = unknown_count / len(items) if items else 0.0

        rows.append({
            "priority": tier,
            "priority_basis": reason,
            "local_authority": authority,
            "settlement": settlement,
            "settlement_types": dict(sorted(types.items())),
            "mapped_parking_assets": len(items),
            "unknown_access_assets": unknown_count,
            "unknown_access_share": round(unknown_share, 4),
            "mapped_polygon_assets": sum(1 for item in items if item.get("geometry")),
            "known_capacity_assets": sum(1 for item in items if isinstance(item.get("capacity"), int)),
            "max_stay_published_assets": source_state_count(items, "maximum_stay_source_state"),
            "opening_hours_published_assets": source_state_count(items, "opening_hours_source_state"),
            "assignment_methods": dict(sorted(assignment_methods.items())),
            "source_keys": useful_source_keys(unknown_items),
            "research_goal": "resolve_access_evidence_without_inferring_public_access",
            "recommended_checks": [
                "official local-authority parking source where applicable",
                "operator or venue parking terms where applicable",
                "OpenStreetMap access/customer/permit tags and source history",
                "store-specific signage/max-stay/opening evidence for retail parking",
            ],
            "promotion_rule": "change access state only when a source directly supports the new state",
        })

    tier_order = {"P0": 0, "P1": 1, "P2": 2, "P3": 3}
    rows.sort(key=lambda row: (
        tier_order[row["priority"]],
        -int(row["unknown_access_assets"]),
        -float(row["unknown_access_share"]),
        str(row["local_authority"]),
        str(row["settlement"]).casefold(),
    ))

    authority_summary: Dict[str, Dict[str, int]] = defaultdict(lambda: {
        "mapped_parking_assets": 0,
        "unknown_access_assets": 0,
        "settlement_research_rows": 0,
    })
    for item in locations:
        authority = str(item.get("local_authority") or "UNASSIGNED_LOCAL_AUTHORITY")
        authority_summary[authority]["mapped_parking_assets"] += 1
        if is_unknown_access(item):
            authority_summary[authority]["unknown_access_assets"] += 1
    for row in rows:
        authority_summary[row["local_authority"]]["settlement_research_rows"] += 1

    priority_counts = Counter(row["priority"] for row in rows)
    raw_unknown_count = sum(1 for item in locations if raw_access(item) == "unknown")
    designated_uncertain_count = sum(1 for item in locations if raw_access(item) == "designated")
    total_unknown = sum(1 for item in locations if is_unknown_access(item))

    return {
        "schema_version": "1.0",
        "generated_at": snapshot.get("generated_at"),
        "source_snapshot_schema_version": snapshot.get("schema_version"),
        "coverage": {
            "scope": coverage.get("scope"),
            "coverage_claim": coverage.get("coverage_claim"),
            "local_authority_relation_ids": coverage.get("local_authority_relation_ids") or {},
        },
        "summary": {
            "parking_assets": len(locations),
            "unknown_access_assets": total_unknown,
            "raw_unknown_access_assets": raw_unknown_count,
            "designated_uncertain_assets": designated_uncertain_count,
            "settlement_research_rows": len(rows),
            "priority_rows": dict(sorted(priority_counts.items())),
        },
        "local_authorities": [
            {"local_authority": authority, **counts}
            for authority, counts in sorted(authority_summary.items())
        ],
        "precision_rules": [
            "Unknown access is an evidence gap, not public parking.",
            "OSM designated access is kept uncertain unless another field/source proves general public eligibility.",
            "Priority is based on unresolved mapped-asset volume, not a claim about parking demand or shortage.",
            "Satellite/aerial imagery may confirm physical parking geometry but cannot establish legal/public access by itself.",
            "Retail/customer restrictions must be store- or operator-specific; no chain-wide max stay is assumed.",
        ],
        "queue": rows,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Build County Dublin unknown-access research queue")
    parser.add_argument("--input", type=Path, default=Path("web/data/dublin_parking_snapshot.json"))
    parser.add_argument("--output", type=Path, default=Path("web/data/dublin_access_research_queue.json"))
    args = parser.parse_args()

    snapshot = json.loads(args.input.read_text(encoding="utf-8"))
    queue = build_queue(snapshot)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(queue, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    summary = queue["summary"]
    print(
        "WHITEBLOCK Dublin access research queue:",
        summary["unknown_access_assets"], "uncertain-access assets /",
        summary["settlement_research_rows"], "settlement rows /",
        summary["priority_rows"], "->",
        args.output,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
