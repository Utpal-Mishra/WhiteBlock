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

When the validated Dublin snapshot publishes settlement anchors, this audit reuses
those exact anchors. A place-only Overpass query is retained only as a backwards-
compatible fallback for older snapshots.
"""

from __future__ import annotations

import argparse
import json
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

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


def _add_grouped_anchor(
    grouped: Dict[str, Dict[str, Any]],
    *,
    authority: str,
    name: str,
    place_type: str,
    osm_id: Any,
    latitude: Optional[float],
    longitude: Optional[float],
) -> None:
    if not name or place_type not in dublin.PLACE_TYPES:
        return
    key = normalise(name)
    row = grouped.setdefault(
        key,
        {
            "local_authority": authority,
            "settlement": name,
            "settlement_normalised": key,
            "anchor_place_types": set(),
            "osm_anchor_ids": [],
            "anchor_coordinates": [],
        },
    )
    row["anchor_place_types"].add(place_type)
    if osm_id is not None:
        row["osm_anchor_ids"].append(osm_id)
    if latitude is not None and longitude is not None:
        row["anchor_coordinates"].append((float(latitude), float(longitude)))


def _finalise_anchor_rows(grouped: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for row in grouped.values():
        row["anchor_place_types"] = sorted(row["anchor_place_types"])
        row["osm_anchor_ids"] = sorted({item for item in row["osm_anchor_ids"] if item is not None})
        coordinates = row.pop("anchor_coordinates", [])
        row["duplicate_named_anchor_count"] = len(row["osm_anchor_ids"])
        row["anchor_coordinate_count"] = len(coordinates)
        if coordinates:
            row["latitude"] = round(sum(item[0] for item in coordinates) / len(coordinates), 7)
            row["longitude"] = round(sum(item[1] for item in coordinates) / len(coordinates), 7)
        else:
            row["latitude"] = None
            row["longitude"] = None
        rows.append(row)
    return sorted(rows, key=lambda item: item["settlement"].casefold())


def anchor_rows(elements: Iterable[Dict[str, Any]], authority: str) -> List[Dict[str, Any]]:
    """Build rows from a fallback raw Overpass node response."""
    grouped: Dict[str, Dict[str, Any]] = {}
    for element in elements:
        tags = element.get("tags") or {}
        _add_grouped_anchor(
            grouped,
            authority=authority,
            name=str(tags.get("name") or "").strip(),
            place_type=str(tags.get("place") or "").strip(),
            osm_id=element.get("id"),
            latitude=element.get("lat"),
            longitude=element.get("lon"),
        )
    return _finalise_anchor_rows(grouped)


def snapshot_anchor_rows(snapshot: Dict[str, Any], authority: str) -> List[Dict[str, Any]]:
    """Build rows from anchors captured in the exact parking traversal."""
    grouped: Dict[str, Dict[str, Any]] = {}
    for anchor in snapshot.get("settlement_anchors") or []:
        if str(anchor.get("local_authority") or "") != authority:
            continue
        _add_grouped_anchor(
            grouped,
            authority=authority,
            name=str(anchor.get("name") or "").strip(),
            place_type=str(anchor.get("place_type") or "").strip(),
            osm_id=anchor.get("osm_id"),
            latitude=anchor.get("latitude"),
            longitude=anchor.get("longitude"),
        )
    return _finalise_anchor_rows(grouped)


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
    snapshot_has_anchors = bool(snapshot.get("settlement_anchors"))

    for authority in dublin.LOCAL_AUTHORITIES:
        if snapshot_has_anchors:
            anchors = snapshot_anchor_rows(snapshot, authority["name"])
            source_status[authority["key"]] = {
                "status": "ok",
                "relation_id": authority["relation_id"],
                "endpoint": "snapshot:settlement_anchors",
                "named_settlement_anchors": len(anchors),
                "query_mode": "same_exact_boundary_traversal_as_parking_inventory",
            }
        else:
            payload, endpoint = fetch_anchors(int(authority["relation_id"]))
            anchors = anchor_rows(payload.get("elements") or [], authority["name"])
            source_status[authority["key"]] = {
                "status": "ok",
                "relation_id": authority["relation_id"],
                "endpoint": endpoint,
                "named_settlement_anchors": len(anchors),
                "query_mode": "fallback_place_only_exact_boundary_query",
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
        "schema_version": "1.1",
        "generated_at": dublin.iso_z(dublin.utc_now()),
        "source_snapshot_generated_at": snapshot.get("generated_at"),
        "anchor_evidence_mode": (
            "same_exact_boundary_snapshot_traversal"
            if snapshot_has_anchors
            else "fallback_place_only_exact_boundary_query"
        ),
        "coverage": snapshot.get("coverage") or {},
        "summary": {
            "parking_assets": len(locations),
            "named_settlement_rows": len(all_rows),
            "settlements_with_mapped_inventory": sum(1 for row in all_rows if row["mapped_parking_assets"] > 0),
            "settlements_without_mapped_inventory": sum(1 for row in all_rows if row["mapped_parking_assets"] == 0),
            "settlements_with_coordinates": sum(1 for row in all_rows if row.get("latitude") is not None and row.get("longitude") is not None),
            "snapshot_settlement_names_without_current_named_anchor": len(assigned_without_current_anchor),
        },
        "precision_rules": [
            "A named settlement with zero matched assets is an investigation queue, not proof that no parking exists.",
            "A positive mapped-asset count is not a claim of exhaustive real-world parking coverage.",
            "Unknown access remains unknown and must not be promoted to public parking.",
            "Settlement scope is limited to currently mapped OSM city/town/village/suburb/neighbourhood name anchors inside the exact four Dublin local-authority relations.",
            "Duplicate OSM anchors sharing the same normalised name inside one authority are collapsed and explicitly counted.",
            "Representative settlement coordinates come from observed OSM place anchors and are navigation/search anchors, not parking geometry.",
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
        summary["settlements_without_mapped_inventory"], "research gaps /",
        summary["settlements_with_coordinates"], "with coordinates ->",
        args.output,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())