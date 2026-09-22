#!/usr/bin/env python3
"""Enrich County Dublin parking records with conservative access/session semantics.

This layer never invents public access, maximum stay, opening hours or retailer
eligibility. It only normalises already-published source values into WHITEBLOCK
product fields while retaining the raw evidence for auditability.

A parking asset with unknown access remains unknown. Customer-only parking is
kept as conditional parking and is never promoted to general public parking.
"""

from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple


ACCESS_ALIASES = {
    "customer": "customer",
    "customers": "customer",
    "customers_only": "customer",
    "customer_only": "customer",
    "yes": "public",
    "public": "public",
    "private": "private",
    "permit": "permit",
    "permit_only": "permit",
    "no": "restricted",
    "restricted": "restricted",
}

GENERAL_PUBLIC_FALSE = {"customer", "private", "permit", "restricted"}


def clean_text(value: Any) -> Optional[str]:
    if value in (None, ""):
        return None
    text = " ".join(str(value).strip().split())
    return text or None


def normalise_access(value: Any) -> Tuple[str, str]:
    raw = clean_text(value)
    if raw is None:
        return "unknown", "unknown"
    key = raw.casefold().replace("-", "_").replace(" ", "_")
    if key in {"", "unknown", "none", "n/a", "na"}:
        return "unknown", raw
    return ACCESS_ALIASES.get(key, key), raw


def general_public_eligibility(access_type: str) -> Optional[bool]:
    if access_type == "public":
        return True
    if access_type in GENERAL_PUBLIC_FALSE:
        return False
    return None


def rule_evidence_fields(item: Dict[str, Any]) -> List[str]:
    fields: List[str] = []
    if item.get("access_type") != "unknown":
        fields.append("access")
    if isinstance(item.get("maximum_stay_minutes"), int) and int(item["maximum_stay_minutes"]) > 0:
        fields.append("maximum_stay")
    if clean_text(item.get("opening_hours_raw")):
        fields.append("opening_hours")
    if clean_text(item.get("pricing_raw")):
        fields.append("pricing")
    return fields


def enrich_location(item: Dict[str, Any]) -> Dict[str, Any]:
    row = dict(item)
    access_type, access_raw = normalise_access(item.get("access_raw") or item.get("access_type"))
    row["access_raw"] = access_raw
    row["access_type"] = access_type
    row["customer_only"] = access_type == "customer"
    row["general_public_eligible"] = general_public_eligibility(access_type)
    row["access_evidence_state"] = "source_published" if access_type != "unknown" else "unknown"

    fields = rule_evidence_fields(row)
    row["restriction_evidence_fields"] = fields
    row["restriction_evidence_count"] = len(fields)
    if len(fields) >= 3:
        row["session_rule_evidence_state"] = "strong_source_coverage"
    elif fields:
        row["session_rule_evidence_state"] = "partial_source_coverage"
    else:
        row["session_rule_evidence_state"] = "unknown"

    # No default maximum-stay rule is created for customer parking. The product
    # can only exclude a longer stay when a maximum stay is actually published.
    row["maximum_stay_source_state"] = (
        "source_published"
        if isinstance(row.get("maximum_stay_minutes"), int) and int(row["maximum_stay_minutes"]) > 0
        else "not_published"
    )
    row["opening_hours_source_state"] = "source_published" if clean_text(row.get("opening_hours_raw")) else "not_published"
    return row


def build_rule_audit(snapshot: Dict[str, Any]) -> Dict[str, Any]:
    locations = list(snapshot.get("locations") or [])
    by_settlement: Dict[Tuple[str, str], List[Dict[str, Any]]] = defaultdict(list)
    for item in locations:
        authority = str(item.get("local_authority") or "UNASSIGNED_LOCAL_AUTHORITY")
        settlement = str(item.get("settlement") or item.get("area") or "UNASSIGNED_SETTLEMENT")
        by_settlement[(authority, settlement)].append(item)

    settlement_rows: List[Dict[str, Any]] = []
    for (authority, settlement), items in sorted(by_settlement.items()):
        access = Counter(str(item.get("access_type") or "unknown") for item in items)
        settlement_rows.append(
            {
                "local_authority": authority,
                "settlement": settlement,
                "parking_assets": len(items),
                "unknown_access_assets": access.get("unknown", 0),
                "customer_only_assets": access.get("customer", 0),
                "public_access_assets": access.get("public", 0),
                "private_access_assets": access.get("private", 0),
                "permit_access_assets": access.get("permit", 0),
                "restricted_access_assets": access.get("restricted", 0),
                "max_stay_published_assets": sum(1 for item in items if item.get("maximum_stay_source_state") == "source_published"),
                "opening_hours_published_assets": sum(1 for item in items if item.get("opening_hours_source_state") == "source_published"),
                "strong_rule_evidence_assets": sum(1 for item in items if item.get("session_rule_evidence_state") == "strong_source_coverage"),
                "partial_rule_evidence_assets": sum(1 for item in items if item.get("session_rule_evidence_state") == "partial_source_coverage"),
                "coverage_claim": "source_published_rules_only",
            }
        )

    access_counts = Counter(str(item.get("access_type") or "unknown") for item in locations)
    queue = sorted(
        settlement_rows,
        key=lambda row: (
            -int(row["unknown_access_assets"]),
            -int(row["parking_assets"]),
            row["local_authority"],
            row["settlement"],
        ),
    )

    return {
        "schema_version": "1.0",
        "generated_at": snapshot.get("generated_at"),
        "coverage": snapshot.get("coverage") or {},
        "summary": {
            "parking_assets": len(locations),
            "access_states": dict(sorted(access_counts.items())),
            "unknown_access_assets": access_counts.get("unknown", 0),
            "customer_only_assets": access_counts.get("customer", 0),
            "public_access_assets": access_counts.get("public", 0),
            "private_access_assets": access_counts.get("private", 0),
            "permit_access_assets": access_counts.get("permit", 0),
            "restricted_access_assets": access_counts.get("restricted", 0),
            "max_stay_published_assets": sum(1 for item in locations if item.get("maximum_stay_source_state") == "source_published"),
            "opening_hours_published_assets": sum(1 for item in locations if item.get("opening_hours_source_state") == "source_published"),
            "customer_assets_with_max_stay": sum(
                1 for item in locations
                if item.get("customer_only") and item.get("maximum_stay_source_state") == "source_published"
            ),
            "customer_assets_with_opening_hours": sum(
                1 for item in locations
                if item.get("customer_only") and item.get("opening_hours_source_state") == "source_published"
            ),
            "strong_rule_evidence_assets": sum(1 for item in locations if item.get("session_rule_evidence_state") == "strong_source_coverage"),
            "partial_rule_evidence_assets": sum(1 for item in locations if item.get("session_rule_evidence_state") == "partial_source_coverage"),
            "settlements_in_research_queue": sum(1 for row in queue if row["unknown_access_assets"] > 0),
        },
        "precision_rules": [
            "Unknown access remains unknown and is never promoted to public parking.",
            "access=customers/customer is normalised to customer-only conditional parking, not general public parking.",
            "A customer parking asset is excluded for a long requested stay only when a source-published maximum stay proves the requested duration does not fit.",
            "No default two-hour supermarket or retail parking rule is assumed.",
            "Opening hours and maximum stay are carried only when published by the source snapshot.",
            "Unrecognised access values are retained conservatively instead of being guessed into public/private classes.",
        ],
        "settlement_rule_gaps": queue,
    }


def enrich_snapshot(snapshot: Dict[str, Any]) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    enriched = dict(snapshot)
    enriched_locations = [enrich_location(item) for item in (snapshot.get("locations") or [])]
    enriched["locations"] = enriched_locations
    enriched["schema_version"] = "1.3"
    enriched.setdefault("coverage", {})["access_rule_model"] = "source_published_normalised_no_inference"
    enriched.setdefault("summary", {})["unknown_access_locations"] = sum(
        1 for item in enriched_locations if item.get("access_type") == "unknown"
    )
    enriched["summary"]["customer_only_locations"] = sum(1 for item in enriched_locations if item.get("customer_only"))
    enriched["summary"]["public_access_locations"] = sum(1 for item in enriched_locations if item.get("access_type") == "public")
    enriched["summary"]["max_stay_published_locations"] = sum(
        1 for item in enriched_locations if item.get("maximum_stay_source_state") == "source_published"
    )
    enriched["summary"]["opening_hours_published_locations"] = sum(
        1 for item in enriched_locations if item.get("opening_hours_source_state") == "source_published"
    )
    return enriched, build_rule_audit(enriched)


def main() -> int:
    parser = argparse.ArgumentParser(description="Enrich County Dublin parking access/session rule evidence")
    parser.add_argument("--input", type=Path, default=Path("web/data/dublin_parking_snapshot.json"))
    parser.add_argument("--output", type=Path, default=None, help="Enriched snapshot path; defaults to overwrite --input")
    parser.add_argument("--audit-output", type=Path, default=Path("web/data/dublin_restriction_audit.json"))
    args = parser.parse_args()

    snapshot = json.loads(args.input.read_text(encoding="utf-8"))
    enriched, audit = enrich_snapshot(snapshot)
    output = args.output or args.input
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(enriched, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    args.audit_output.parent.mkdir(parents=True, exist_ok=True)
    args.audit_output.write_text(json.dumps(audit, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    summary = audit["summary"]
    print(
        "WHITEBLOCK Dublin access/session enrichment:",
        summary["parking_assets"], "assets /",
        summary["customer_only_assets"], "customer-only /",
        summary["max_stay_published_assets"], "max-stay published /",
        summary["unknown_access_assets"], "unknown access ->",
        output,
    )
    print("Restriction audit ->", args.audit_output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
