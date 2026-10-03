#!/usr/bin/env python3
"""Build a deterministic imagery-review queue from WHITEBLOCK regional snapshots.

The queue targets records whose physical parking geometry is still not verified.
It does not promote imagery to legal/public parking and it does not infer live
occupancy. Restricted/private/customer-only assets are excluded from the default
review batch because the current task is to investigate generally usable/open
parking supply.
"""

from __future__ import annotations

import argparse
import json
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List

REGIONS = {
    "Dublin": "dublin_parking_snapshot.json",
    "Cork": "cork_county_parking_snapshot.json",
    "Kildare": "kildare_parking_snapshot.json",
    "Bray": "bray_parking_snapshot.json",
}
RESTRICTED = {"private", "permit", "restricted", "emergency", "customer", "customers", "destination"}
UNDERGROUND = {"underground", "multi-storey", "multistorey"}


def now_z() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def numeric(value: Any) -> float | None:
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    return result if math.isfinite(result) else None


def has_observed_geometry(item: Dict[str, Any]) -> bool:
    geometry = item.get("geometry")
    return bool(geometry) and (item.get("geometry_truth_state") in (None, "observed"))


def access_group(item: Dict[str, Any]) -> str:
    return str(item.get("access_type") or item.get("access_raw") or "unknown").strip().lower()


def is_surface_candidate(item: Dict[str, Any]) -> bool:
    kind = str(item.get("parking_type") or "").lower()
    return not any(token in kind for token in UNDERGROUND)


def is_open_review_target(item: Dict[str, Any]) -> bool:
    lat = numeric(item.get("latitude"))
    lng = numeric(item.get("longitude"))
    if lat is None or lng is None:
        return False
    if has_observed_geometry(item):
        return False
    if access_group(item) in RESTRICTED:
        return False
    if not is_surface_candidate(item):
        return False
    if str(item.get("network_role") or "").lower() == "accessible_space":
        return False
    return True


def score(item: Dict[str, Any]) -> float:
    value = 0.0
    access = access_group(item)
    if access in {"public", "yes", "public_or_bylaw_designated", "permissive"}:
        value += 6.0
    elif access == "unknown":
        value += 2.0
    name = str(item.get("name") or "").strip().lower()
    if name and name not in {"parking parking", "surface parking", "car park", "parking"}:
        value += 2.0
    if item.get("capacity") is not None:
        value += 1.5
    if item.get("accessible_spaces") not in (None, 0):
        value += 0.5
    if item.get("ev_spaces") not in (None, 0):
        value += 0.5
    confidence = item.get("confidence")
    if isinstance(confidence, dict):
        value += float(confidence.get("score") or 0)
    return round(value, 3)


def fallback_kildare() -> List[Dict[str, Any]]:
    # Combine the maintained high-confidence Kildare anchors with current Kildare
    # County Council accessible-parking points. Accessible-bay points are used as
    # spatial review anchors for the surrounding parking footprint; the imagery
    # review does not claim that one accessible-bay point defines a whole car park.
    rows: List[Dict[str, Any]] = []
    try:
        from enrich_kildare_snapshot import critical_anchors
        rows.extend(critical_anchors(now_z()))
    except Exception:
        pass
    try:
        from ingest_kildare_parking import kcc_accessible_locations, utc_now
        accessible, _ = kcc_accessible_locations(utc_now())
        for item in accessible:
            copy = dict(item)
            copy["network_role"] = "parking_context_anchor"
            copy["parking_type"] = "accessible_bay_context"
            copy["evidence_note"] = "Official accessible-bay point used only to inspect surrounding parking supply in imagery."
            rows.append(copy)
    except Exception:
        pass
    unique = {}
    for item in rows:
        unique[str(item.get("parking_id"))] = item
    return list(unique.values())


def load_locations(input_dir: Path, region: str, filename: str) -> List[Dict[str, Any]]:
    path = input_dir / filename
    if path.exists():
        payload = json.loads(path.read_text(encoding="utf-8"))
        return list(payload.get("locations") or [])
    if region == "Kildare":
        return fallback_kildare()
    return []


def distance_m(a: Dict[str, Any], b: Dict[str, Any]) -> float:
    lat1, lon1 = math.radians(float(a["latitude"])), math.radians(float(a["longitude"]))
    lat2, lon2 = math.radians(float(b["latitude"])), math.radians(float(b["longitude"]))
    dlat, dlon = lat2 - lat1, lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 6371008.8 * 2 * math.asin(math.sqrt(h))


def select_spread(items: Iterable[Dict[str, Any]], limit: int) -> List[Dict[str, Any]]:
    ranked = sorted(items, key=lambda item: (-score(item), str(item.get("parking_id") or "")))
    if limit <= 0:
        return ranked
    selected: List[Dict[str, Any]] = []
    deferred: List[Dict[str, Any]] = []
    for item in ranked:
        if all(distance_m(item, other) >= 90 for other in selected):
            selected.append(item)
        else:
            deferred.append(item)
        if len(selected) >= limit:
            return selected
    for item in deferred:
        if len(selected) >= limit:
            break
        selected.append(item)
    return selected


def target_record(region: str, item: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "region": region,
        "parking_id": item.get("parking_id"),
        "name": item.get("name") or item.get("parking_id"),
        "area": item.get("area") or item.get("settlement") or region,
        "latitude": numeric(item.get("latitude")),
        "longitude": numeric(item.get("longitude")),
        "parking_type": item.get("parking_type"),
        "access_type": item.get("access_type") or item.get("access_raw") or "unknown",
        "capacity": item.get("capacity"),
        "source_key": item.get("source_key"),
        "source_url": item.get("source_url"),
        "existing_truth_state": item.get("truth_state"),
        "existing_geometry_truth_state": item.get("geometry_truth_state"),
        "priority_score": score(item),
        "review_question": "Is a surface parking footprint physically visible around this mapped point, and is its extent distinguishable enough to justify an imagery-derived candidate polygon?",
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-dir", type=Path, default=Path("web/data"))
    parser.add_argument("--output", type=Path, default=Path("imagery-review/targets.json"))
    parser.add_argument("--max-per-region", type=int, default=20)
    args = parser.parse_args()

    summary: Dict[str, Any] = {}
    targets: List[Dict[str, Any]] = []
    for region, filename in REGIONS.items():
        locations = load_locations(args.input_dir, region, filename)
        open_items = [item for item in locations if is_open_review_target(item)]
        selected = select_spread(open_items, args.max_per_region)
        targets.extend(target_record(region, item) for item in selected)
        summary[region] = {
            "inventory_locations": len(locations),
            "open_geometry_targets": len(open_items),
            "selected_for_imagery_review": len(selected),
            "snapshot": filename if (args.input_dir / filename).exists() else "fallback evidence anchors",
        }

    payload = {
        "schema_version": "1.0",
        "generated_at": now_z(),
        "purpose": "Internal imagery review queue; not legal-access proof and not live occupancy.",
        "selection_policy": {
            "geometry": "missing or unverified geometry",
            "excluded_access": sorted(RESTRICTED),
            "excluded_parking_types": sorted(UNDERGROUND),
            "minimum_spacing_m": 90,
            "max_per_region": args.max_per_region,
        },
        "summary": summary,
        "targets": targets,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
