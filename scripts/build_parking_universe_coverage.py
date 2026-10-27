#!/usr/bin/env python3
"""Build the WHITEBLOCK Phase 1.5 Parking Universe coverage report.

This report measures programme progress against known source families and
attribute-resolution quality. It is deliberately NOT a claim about what
percentage of all real-world parking has been discovered.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, Sequence


REGION_FILES = {
    "cork": ("cork_county_parking_snapshot.json", "parking_snapshot.json"),
    "kildare": ("kildare_parking_snapshot.json",),
    "dublin": ("dublin_parking_snapshot.json",),
    "wicklow": ("wicklow_parking_snapshot.json", "bray_parking_snapshot.json"),
}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def load_json(path: Path) -> Dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def first_value(record: Mapping[str, Any], keys: Sequence[str]) -> Any:
    for key in keys:
        value = record.get(key)
        if value not in (None, ""):
            return value
    return None


def stable_id(record: Mapping[str, Any], index: int) -> str:
    value = first_value(record, ("parking_id", "id", "identifier", "external_id"))
    if value not in (None, ""):
        return str(value)
    lat = first_value(record, ("latitude", "lat"))
    lng = first_value(record, ("longitude", "lng", "lon"))
    name = str(record.get("name") or "unnamed").strip().lower()
    return f"fallback:{name}:{lat}:{lng}:{index}"


def dedupe(records: Iterable[Mapping[str, Any]]) -> List[Dict[str, Any]]:
    output: List[Dict[str, Any]] = []
    seen = set()
    for index, raw in enumerate(records):
        record = dict(raw)
        key = stable_id(record, index)
        if key in seen:
            continue
        seen.add(key)
        output.append(record)
    return output


def snapshot_records(snapshot_dir: Path, region: str) -> tuple[List[Dict[str, Any]], List[str]]:
    records: List[Dict[str, Any]] = []
    loaded_files: List[str] = []
    for filename in REGION_FILES.get(region, ()):
        path = snapshot_dir / filename
        if not path.exists():
            continue
        snapshot = load_json(path)
        rows = snapshot.get("locations") or snapshot.get("records") or []
        if isinstance(rows, list):
            records.extend(row for row in rows if isinstance(row, dict))
            loaded_files.append(filename)
    return dedupe(records), loaded_files


def has_coordinates(record: Mapping[str, Any]) -> bool:
    try:
        lat = float(first_value(record, ("latitude", "lat")))
        lng = float(first_value(record, ("longitude", "lng", "lon")))
    except (TypeError, ValueError):
        return False
    return -90 <= lat <= 90 and -180 <= lng <= 180


def has_polygon(record: Mapping[str, Any]) -> bool:
    geometry = record.get("geometry") or record.get("footprint")
    if not isinstance(geometry, dict):
        return False
    return str(geometry.get("type") or "").lower() in {"polygon", "multipolygon"}


def known_access(record: Mapping[str, Any]) -> bool:
    value = first_value(record, ("access_type", "accessType", "access", "public_access_class"))
    if value is None:
        return False
    normalized = str(value).strip().lower().replace("-", "_").replace(" ", "_")
    return normalized not in {"", "unknown", "unverified", "designated", "none", "null"}


def known_capacity(record: Mapping[str, Any]) -> bool:
    value = first_value(record, ("capacity", "capacity_verified", "spaces", "total_spaces", "totalSpaces"))
    try:
        return value is not None and float(value) >= 0
    except (TypeError, ValueError):
        return False


def known_rules(record: Mapping[str, Any]) -> bool:
    return any(
        first_value(record, keys) not in (None, "")
        for keys in (
            ("maximum_stay_minutes", "maxStayMinutes", "max_stay_minutes"),
            ("opening_hours_raw", "openingHoursRaw", "opening_hours"),
            ("pricing_raw", "pricingRaw", "price"),
            ("restriction_raw", "restrictions", "rules"),
        )
    )


def has_accessible_evidence(record: Mapping[str, Any]) -> bool:
    value = first_value(record, ("accessible_spaces", "accessibleSpaces"))
    if value is not None:
        try:
            return float(value) > 0
        except (TypeError, ValueError):
            pass
    return record.get("accessible") is True or str(record.get("parking_type") or "").lower() == "accessible"


def has_ev_evidence(record: Mapping[str, Any]) -> bool:
    value = first_value(record, ("ev_spaces", "evSpaces"))
    if value is not None:
        try:
            return float(value) > 0
        except (TypeError, ValueError):
            pass
    return record.get("ev") is True


def asset_class(record: Mapping[str, Any]) -> str:
    raw = " ".join(
        str(first_value(record, keys) or "")
        for keys in (
            ("parking_type", "parkingType", "type"),
            ("access_type", "accessType", "access"),
            ("name",),
            ("area", "settlement"),
        )
    ).lower()

    if "park_and_ride" in raw or "park and ride" in raw or "park & ride" in raw:
        return "park_and_ride"
    if "station" in raw or "rail" in raw:
        return "station_transport"
    if "hospital" in raw:
        return "hospital"
    if "university" in raw or "college" in raw or "campus" in raw:
        return "university"
    if "airport" in raw:
        return "airport"
    if "accessible" in raw or "disabled" in raw or "blue badge" in raw:
        return "accessible"
    if "permit" in raw or "restricted" in raw:
        return "permit_restricted"
    if "customer" in raw or "supermarket" in raw or "shopping" in raw or "retail" in raw:
        return "retail_customer"
    if "private" in raw:
        return "private_shared"
    if "street" in raw or "lane" in raw or "kerb" in raw or "curb" in raw:
        return "on_street"
    return "public_off_street"


def candidate_state(record: Mapping[str, Any]) -> bool:
    values = [
        first_value(record, ("inventory_status", "inventoryStatus")),
        first_value(record, ("lifecycle_status", "lifecycleStatus")),
        first_value(record, ("truth_state", "truthState")),
    ]
    normalized = {str(value).strip().lower() for value in values if value not in (None, "")}
    return bool(normalized & {"candidate", "detected", "unverified", "physical_confirmed"})


def review_reasons(record: Mapping[str, Any]) -> List[str]:
    reasons: List[str] = []
    if not has_coordinates(record):
        reasons.append("missing_coordinates")
    if not known_access(record):
        reasons.append("unknown_access")
    if not known_rules(record):
        reasons.append("missing_rules")
    if not known_capacity(record):
        reasons.append("missing_capacity")
    if not has_polygon(record):
        reasons.append("missing_polygon")
    if candidate_state(record):
        reasons.append("candidate_state")
    return reasons


def review_priority(reasons: Sequence[str]) -> int:
    weights = {
        "missing_coordinates": 100,
        "unknown_access": 80,
        "candidate_state": 70,
        "missing_rules": 55,
        "missing_capacity": 30,
        "missing_polygon": 20,
    }
    return sum(weights.get(reason, 0) for reason in reasons)


def review_item(record: Mapping[str, Any], region: str, index: int) -> Dict[str, Any] | None:
    reasons = review_reasons(record)
    if not reasons:
        return None
    return {
        "parking_id": stable_id(record, index),
        "name": str(record.get("name") or "Unnamed parking"),
        "region": region,
        "area": first_value(record, ("area", "settlement", "local_authority", "localAuthority")),
        "latitude": first_value(record, ("latitude", "lat")),
        "longitude": first_value(record, ("longitude", "lng", "lon")),
        "asset_class": asset_class(record),
        "reasons": reasons,
        "priority": review_priority(reasons),
        "source_key": first_value(record, ("source_key", "sourceKey")),
    }


def percentage(count: int, total: int) -> float | None:
    if total <= 0:
        return None
    return round(100.0 * count / total, 1)


def source_family_status(config: Mapping[str, Any], region: str) -> Dict[str, str]:
    required = list(config.get("required_source_families") or [])
    region_cfg = (config.get("regions") or {}).get(region) or {}
    sources = config.get("sources") or {}
    integrated_keys = set(region_cfg.get("integrated_source_keys") or [])
    ready_keys = set(region_cfg.get("ready_to_integrate") or [])

    integrated_families = {
        sources[key].get("family")
        for key in integrated_keys
        if key in sources and sources[key].get("family")
    }
    ready_families = {
        sources[key].get("family")
        for key in ready_keys
        if key in sources and sources[key].get("family")
    }

    statuses: Dict[str, str] = {}
    for family in required:
        if family in integrated_families:
            statuses[family] = "integrated"
        elif family in ready_families:
            statuses[family] = "ready_to_integrate"
        else:
            statuses[family] = "gap"
    return statuses


def programme_readiness_score(
    total: int,
    access_pct: float | None,
    capacity_pct: float | None,
    rules_pct: float | None,
    polygon_pct: float | None,
    family_statuses: Mapping[str, str],
) -> float | None:
    if total <= 0:
        return None

    source_values = [
        1.0 if status == "integrated" else 0.5 if status == "ready_to_integrate" else 0.0
        for status in family_statuses.values()
    ]
    source_progress = 100.0 * sum(source_values) / max(len(source_values), 1)
    attribute_values = [access_pct or 0.0, capacity_pct or 0.0, rules_pct or 0.0, polygon_pct or 0.0]
    attribute_progress = sum(attribute_values) / len(attribute_values)

    # Progress indicator only: 55% source-family work, 45% field resolution.
    return round(0.55 * source_progress + 0.45 * attribute_progress, 1)


def region_report(config: Mapping[str, Any], snapshot_dir: Path, region: str) -> Dict[str, Any]:
    records, loaded_files = snapshot_records(snapshot_dir, region)
    total = len(records)
    access = sum(1 for row in records if known_access(row))
    capacity = sum(1 for row in records if known_capacity(row))
    rules = sum(1 for row in records if known_rules(row))
    coordinates = sum(1 for row in records if has_coordinates(row))
    polygons = sum(1 for row in records if has_polygon(row))
    accessible = sum(1 for row in records if has_accessible_evidence(row))
    ev = sum(1 for row in records if has_ev_evidence(row))
    candidate_count = sum(1 for row in records if candidate_state(row))
    review_items = [
        item
        for index, row in enumerate(records)
        if (item := review_item(row, region, index)) is not None
    ]
    review_items.sort(key=lambda item: (-int(item["priority"]), str(item["parking_id"])))

    classes: Dict[str, int] = {}
    for record in records:
        key = asset_class(record)
        classes[key] = classes.get(key, 0) + 1

    statuses = source_family_status(config, region)
    access_pct = percentage(access, total)
    capacity_pct = percentage(capacity, total)
    rules_pct = percentage(rules, total)
    polygon_pct = percentage(polygons, total)

    return {
        "label": ((config.get("regions") or {}).get(region) or {}).get("label", region.title()),
        "inventory_status": ((config.get("regions") or {}).get(region) or {}).get("status", "unknown"),
        "loaded_snapshot_files": loaded_files,
        "known_assets": total,
        "candidate_count": candidate_count,
        "candidate_scope_note": "Count is derived only from deployed source-backed records explicitly marked candidate/unverified; browser-local proposals remain excluded.",
        "review_queue": {
            "count": len(review_items),
            "unknown_access": sum(1 for item in review_items if "unknown_access" in item["reasons"]),
            "missing_rules": sum(1 for item in review_items if "missing_rules" in item["reasons"]),
            "missing_capacity": sum(1 for item in review_items if "missing_capacity" in item["reasons"]),
            "missing_polygon": sum(1 for item in review_items if "missing_polygon" in item["reasons"]),
        },
        "resolution": {
            "coordinates": {"count": coordinates, "percent": percentage(coordinates, total)},
            "polygon_geometry": {"count": polygons, "percent": polygon_pct},
            "access": {"count": access, "percent": access_pct},
            "capacity": {"count": capacity, "percent": capacity_pct},
            "rules_or_pricing": {"count": rules, "percent": rules_pct},
            "accessible_evidence": {"count": accessible, "percent": percentage(accessible, total)},
            "ev_evidence": {"count": ev, "percent": percentage(ev, total)},
        },
        "asset_class_counts": dict(sorted(classes.items())),
        "source_family_status": statuses,
        "source_family_summary": {
            "integrated": sum(1 for value in statuses.values() if value == "integrated"),
            "ready_to_integrate": sum(1 for value in statuses.values() if value == "ready_to_integrate"),
            "gaps": sum(1 for value in statuses.values() if value == "gap"),
            "total_required": len(statuses),
        },
        "programme_readiness_score": programme_readiness_score(
            total, access_pct, capacity_pct, rules_pct, polygon_pct, statuses
        ),
        "programme_readiness_note": "Progress indicator only; not a percentage of all real-world parking discovered.",
    }


def build_report(config_path: Path, snapshot_dir: Path) -> Dict[str, Any]:
    config = load_json(config_path)
    regions = {
        region: region_report(config, snapshot_dir, region)
        for region in (config.get("regions") or {})
    }

    known_assets = sum(region["known_assets"] for region in regions.values())
    integrated = sum(region["source_family_summary"]["integrated"] for region in regions.values())
    ready = sum(region["source_family_summary"]["ready_to_integrate"] for region in regions.values())
    gaps = sum(region["source_family_summary"]["gaps"] for region in regions.values())

    return {
        "schema_version": 1,
        "generated_at": utc_now(),
        "phase": "1.5",
        "title": "Parking Universe Coverage",
        "coverage_claim": config.get("coverage_claim"),
        "known_assets_across_deployed_snapshots": known_assets,
        "source_family_instances": {
            "integrated": integrated,
            "ready_to_integrate": ready,
            "gaps": gaps,
        },
        "regions": regions,
        "guardrail": "No score in this report should be interpreted as literal completeness of real-world parking supply.",
    }


def build_review_queue(config_path: Path, snapshot_dir: Path) -> Dict[str, Any]:
    config = load_json(config_path)
    regions: Dict[str, Any] = {}
    total = 0
    for region in (config.get("regions") or {}):
        records, loaded_files = snapshot_records(snapshot_dir, region)
        items = [
            item
            for index, row in enumerate(records)
            if (item := review_item(row, region, index)) is not None
        ]
        items.sort(key=lambda item: (-int(item["priority"]), str(item["parking_id"])))
        total += len(items)
        regions[region] = {
            "label": ((config.get("regions") or {}).get(region) or {}).get("label", region.title()),
            "loaded_snapshot_files": loaded_files,
            "review_count": len(items),
            "items": items,
        }

    return {
        "schema_version": 1,
        "generated_at": utc_now(),
        "phase": "1.5",
        "title": "Parking Universe Evidence Review Queue",
        "review_items": total,
        "regions": regions,
        "guardrail": "A review item is an evidence-resolution task, not proof that the parking asset is invalid or unusable.",
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build Phase 1.5 parking-universe coverage report.")
    parser.add_argument("--config", type=Path, default=Path("config/parking_universe_sources.json"))
    parser.add_argument("--snapshot-dir", type=Path, default=Path("web/data"))
    parser.add_argument("--output", type=Path, default=Path("web/data/parking_universe_coverage.json"))
    parser.add_argument("--review-output", type=Path, default=Path("web/data/parking_universe_review_queue.json"))
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    report = build_report(args.config, args.snapshot_dir)
    review_queue = build_review_queue(args.config, args.snapshot_dir)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    args.review_output.parent.mkdir(parents=True, exist_ok=True)
    args.review_output.write_text(json.dumps(review_queue, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "output": str(args.output),
        "review_output": str(args.review_output),
        "regions": len(report["regions"]),
        "known_assets": report["known_assets_across_deployed_snapshots"],
        "review_items": review_queue["review_items"],
        "source_family_instances": report["source_family_instances"],
    }))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
