#!/usr/bin/env python3
"""Compare two Phase 4 parking-detection batches and create a change-review report."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from math import asin, cos, radians, sin, sqrt
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple


def load(path: Path) -> Dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def numeric(value: Any) -> Optional[float]:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def flatten(value: Any) -> Iterable[Tuple[float, float]]:
    if not isinstance(value, list):
        return
    if len(value) >= 2 and numeric(value[0]) is not None and numeric(value[1]) is not None:
        yield float(value[0]), float(value[1])
        return
    for item in value:
        yield from flatten(item)


def centroid(feature: Dict[str, Any]) -> Optional[Tuple[float, float]]:
    points = list(flatten((feature.get("geometry") or {}).get("coordinates")))
    if not points:
        return None
    return (
        sum(point[1] for point in points) / len(points),
        sum(point[0] for point in points) / len(points),
    )


def haversine_m(a: Tuple[float, float], b: Tuple[float, float]) -> float:
    lat1, lon1 = a
    lat2, lon2 = b
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    x = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return 6371000 * 2 * asin(sqrt(min(1.0, x)))


def area_value(feature: Dict[str, Any]) -> Optional[float]:
    return numeric((feature.get("properties") or {}).get("surface_area_m2"))


def compare(
    previous: Dict[str, Any],
    current: Dict[str, Any],
    *,
    match_radius_m: float,
    area_change_ratio: float,
) -> List[Dict[str, Any]]:
    old = [(index, feature, centroid(feature)) for index, feature in enumerate(previous.get("features") or [])]
    new = [(index, feature, centroid(feature)) for index, feature in enumerate(current.get("features") or [])]
    old = [row for row in old if row[2] is not None]
    new = [row for row in new if row[2] is not None]

    used_old = set()
    changes: List[Dict[str, Any]] = []

    for new_index, new_feature, new_center in new:
        best = None
        for old_index, old_feature, old_center in old:
            if old_index in used_old:
                continue
            distance = haversine_m(new_center, old_center)
            if distance <= match_radius_m and (best is None or distance < best[0]):
                best = (distance, old_index, old_feature, old_center)

        if best is None:
            changes.append({
                "change_type": "appeared",
                "current_feature_index": new_index,
                "previous_feature_index": None,
                "centroid": {"latitude": new_center[0], "longitude": new_center[1]},
                "distance_m": None,
                "area_change_ratio": None,
                "verification_required": True,
            })
            continue

        distance, old_index, old_feature, _ = best
        used_old.add(old_index)
        old_area = area_value(old_feature)
        new_area = area_value(new_feature)
        change_type = "persisted"
        ratio = None
        if old_area and new_area and old_area > 0:
            ratio = (new_area - old_area) / old_area
            if ratio >= area_change_ratio:
                change_type = "expanded"
            elif ratio <= -area_change_ratio:
                change_type = "contracted"

        changes.append({
            "change_type": change_type,
            "current_feature_index": new_index,
            "previous_feature_index": old_index,
            "centroid": {"latitude": new_center[0], "longitude": new_center[1]},
            "distance_m": round(distance, 1),
            "area_change_ratio": round(ratio, 4) if ratio is not None else None,
            "verification_required": change_type != "persisted",
        })

    for old_index, old_feature, old_center in old:
        if old_index in used_old:
            continue
        changes.append({
            "change_type": "disappeared_or_obscured",
            "current_feature_index": None,
            "previous_feature_index": old_index,
            "centroid": {"latitude": old_center[0], "longitude": old_center[1]},
            "distance_m": None,
            "area_change_ratio": None,
            "verification_required": True,
        })
    return changes


def empty_report() -> Dict[str, Any]:
    return {
        "schema_version": "1.0",
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "status": "awaiting_versioned_detection_snapshots",
        "changes": [],
        "summary": {
            "appeared": 0,
            "expanded": 0,
            "contracted": 0,
            "disappeared_or_obscured": 0,
            "persisted": 0,
        },
        "guardrail": "No change is treated as a parking opening/closure until separately verified.",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Build WHITEBLOCK Phase 4 imagery-change candidates.")
    parser.add_argument("--previous", type=Path, default=None)
    parser.add_argument("--current", type=Path, default=None)
    parser.add_argument("--output", type=Path, default=Path("web/data/parking_supply_change_report.json"))
    parser.add_argument("--match-radius-m", type=float, default=45)
    parser.add_argument("--area-change-ratio", type=float, default=0.20)
    args = parser.parse_args()

    if not args.previous or not args.current or not args.previous.exists() or not args.current.exists():
        report = empty_report()
    else:
        previous = load(args.previous)
        current = load(args.current)
        changes = compare(
            previous,
            current,
            match_radius_m=args.match_radius_m,
            area_change_ratio=args.area_change_ratio,
        )
        summary = {key: 0 for key in ["appeared", "expanded", "contracted", "disappeared_or_obscured", "persisted"]}
        for row in changes:
            summary[row["change_type"]] += 1
        report = {
            "schema_version": "1.0",
            "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "status": "ready",
            "previous": {
                "source_key": previous.get("source_key"),
                "imagery_acquisition_date": previous.get("imagery_acquisition_date"),
                "model_version": previous.get("model_version"),
            },
            "current": {
                "source_key": current.get("source_key"),
                "imagery_acquisition_date": current.get("imagery_acquisition_date"),
                "model_version": current.get("model_version"),
            },
            "summary": summary,
            "changes": changes,
            "guardrail": "Appeared/disappeared/changed imagery detections are review candidates, not verified parking openings, closures or capacity changes.",
        }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("WHITEBLOCK Phase 4 change report:", report["status"], report["summary"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
