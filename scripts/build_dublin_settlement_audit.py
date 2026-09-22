#!/usr/bin/env python3
"""Audit County Dublin parking coverage settlement by settlement.

This diagnostic intentionally separates two questions:
1. Did WHITEBLOCK traverse each Dublin local-authority boundary and ingest mapped
   parking assets?
2. Does every named OSM city/town/village/suburb/neighbourhood currently have a
   mapped parking asset in the resulting snapshot?

A zero count is a research gap, not proof that a settlement has no parking.
Likewise a positive count is mapped-source coverage, not proof of exhaustive
real-world parking coverage.
"""

from __future__ import annotations

import argparse
import json
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Dict, Iterable, List

import ingest_dublin_county_parking as dublin


def normalise(value: Any) -> str:
    return " ".join(unicodedata.normalize("NFKC", str(value or "")).casefold().split())


def settlement_anchor_query(relation_id: int) -> str:
    return f"""
[out:json][timeout:90];
rel({relation_id});
map_to_area -> .searchArea;
node["place"~"city|town|village|suburb|neighbourhood"]["name"](area.searchArea);
out meta;
""".strip()


def fetch_anchors(relation_id: int) -> tuple[Dict[str, Any], str]:
    original = dublin.overpass_query
    try:
        dublin.overpass_query = settlement_anchor_query
        return dublin.fetch_overpass(relation_id)
    finally:
        dublin.overpass_query = original


def anchor_rows(elements: Iterable[Dict[str, Any]], authority: str) -> List[Dict[str, Any]]:
    grouped: Dict[str, Dict[str, Any]] = {}
    for element in elements:
        tags = element.get("tags") or {}
        name = str(tags.get("name") or "").strip()
        place_type = str(tags.get("place") or "").strip()
        if not name or place_type not in dublin.PLACE_TYPES:
            continue
        key = normalise(name)
        row = grouped.setdefault(
            key,
            {
                "local_authority": authority,
                "settlement": name,
                "settlement_normalised": key,
                "anchor_place_types": set(),
                "osm_anchor_ids": [],
            },
        )
        row["anchor_place_types"].add(place_type)
        row["osm_anchor_ids"].append(element.get("id"))

    rows: List[Dict[str, Any]] = []
    for row in grouped.values():
        row["anchor_place_types"] = sorted(row["anchor_place_types"])
        row["osm_anchor_ids"] = sorted({item for item in row["osm_anchor_ids"] if item is not None})
        row["duplicate_named_anchor_count"] = len(row["osm_anchor_ids"])
        rows.append(row)
    return sorted(rows, key=lambda item: item["settlement"].casefold())


def build_audit(snapshot: Dict[str, Any]) -> Dict[str, Any]:
    locations = list(snapshot.get("locations") or [])
    assets_by_authority_name: Dict[tuple[str, str], List[Dict[str, Any]]] = defaultdict(list)
    for item in locations:
        authority = str(item.get("local_authority") or "")
        settlement = normalise(item.get("settlement") or item.get("area"))
        if authority and settlement:
            assets_by_authority_name[(authority, settlement)].append(item)

    authority_results: List[Dict[str, Any]] = []
    source_status: Dict[str, Any] = {}
    all_rows: List[Dict[str, Any]] = []

    for authority in dublin.LOCAL_AUTHORITIES:
        payload, endpoint = fetch_anchors(int(authority["relation_id"]))
        anchors = anchor_rows(payload.get("elements") or [], authority["name"])
        source_status[authority["key"]] = {
            "status": "ok",
            "relation_id": authority["relation_id"],
            "endpoint": endpoint,
            "named_settlement_anchors": len(anchors),
        }

        rows: List[Dict[str, Any]] = []
        for anchor in anchors:
            matched = assets_by_authority_name.get((authority["name"], anchor["settlement_normalised"]), [])
            access = Counter(str(item.get("access_type") or "unknown") for item in matched)
            row = {
                **anchor,
                "mapped_parking_assets": len(matched),
                "mapped_polygon_assets": sum(1 for item in matched if item.get("geometry")),
                "known_capacity_assets": sum(1 for item in matched if isinstance(item.get("capacity"), int)),
                "unknown_access_assets": access.get("unknown", 0),
                "access_states": dict(sorted(access.items())),
                "coverage_state": "mapped_inventory_present" if matched else "named_settlement_no_mapped_inventory_in_snapshot",
                "coverage_claim": "diagnostic_source_coverage_only",
            }
            rows.append(row)
            all_rows.append(row)

        authority_results.append(
            {
                "local_authority": authority["name"],
                "relation_id": authority["relation_id"],
                "named_settlements": len(rows),
                "settlements_with_mapped_inventory": sum(1 for row in rows if row["mapped_parking_assets"] > 0),
                "settlements_without_mapped_inventory": sum(1 for row in rows if row["mapped_parking_assets"] == 0),
                "settlements": rows,
            }
        )

    snapshot_names = {
        (str(item.get("local_authority") or ""), normalise(item.get("settlement") or item.get("area")))
        for item in locations
        if item.get("local_authority") and (item.get("settlement") or item.get("area"))
    }
    anchor_names = {(row["local_authority"], row["settlement_normalised"]) for row in all_rows}
    assigned_without_current_anchor = sorted(
        [
            {"local_authority": authority, "settlement_normalised": settlement}
            for authority, settlement in snapshot_names - anchor_names
        ],
        key=lambda item: (item["local_authority"], item["settlement_normalised"]),
    )

    return {
        "schema_version": "1.0",
        "generated_at": dublin.iso_z(dublin.utc_now()),
        "source_snapshot_generated_at": snapshot.get("generated_at"),
        "coverage": snapshot.get("coverage") or {},
        "summary": {
            "parking_assets": len(locations),
            "named_settlement_rows": len(all_rows),
            "settlements_with_mapped_inventory": sum(1 for row in all_rows if row["mapped_parking_assets"] > 0),
            "settlements_without_mapped_inventory": sum(1 for row in all_rows if row["mapped_parking_assets"] == 0),
            "snapshot_settlement_names_without_current_named_anchor": len(assigned_without_current_anchor),
        },
        "precision_rules": [
            "A named settlement with zero matched assets is an investigation queue, not proof that no parking exists.",
            "A positive mapped-asset count is not a claim of exhaustive real-world parking coverage.",
            "Unknown access remains unknown and must not be promoted to public parking.",
            "Settlement scope is limited to currently mapped OSM city/town/village/suburb/neighbourhood name anchors inside the exact four Dublin local-authority relations.",
            "Duplicate OSM anchors sharing the same normalised name inside one authority are collapsed and explicitly counted.",
        ],
        "sources": source_status,
        "local_authorities": authority_results,
        "snapshot_settlement_names_without_current_named_anchor": assigned_without_current_anchor,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Build County Dublin settlement-by-settlement parking audit")
    parser.add_argument("--input", type=Path, default=Path("web/data/dublin_parking_snapshot.json"))
    parser.add_argument("--output", type=Path, default=Path("web/data/dublin_settlement_audit.json"))
    args = parser.parse_args()

    snapshot = json.loads(args.input.read_text(encoding="utf-8"))
    audit = build_audit(snapshot)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(audit, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    summary = audit["summary"]
    print(
        "WHITEBLOCK Dublin settlement audit:",
        summary["named_settlement_rows"], "named settlements /",
        summary["settlements_with_mapped_inventory"], "with mapped inventory /",
        summary["settlements_without_mapped_inventory"], "research gaps ->",
        args.output,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
