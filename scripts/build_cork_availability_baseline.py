#!/usr/bin/env python3
"""Build WHITEBLOCK Phase 3 historical availability baselines for Cork.

This script turns repeated official parking observations into a bounded,
deduplicated history and a transparent naive forecast baseline.

It deliberately does not train an opaque model and does not alter recommendation
eligibility. The output is suitable for evaluation and UI display before any
forecast is allowed to influence ranking.
"""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from statistics import mean
from typing import Any, Dict, Iterable, List, Optional, Tuple
from zoneinfo import ZoneInfo

LOCAL_TIMEZONE = ZoneInfo("Europe/Dublin")
MODEL_NAME = "hierarchical_historical_mean"
MODEL_VERSION = "phase3-naive-v1"
MIN_SAMPLES = {
    "weekday_hour": 2,
    "hour": 5,
    "overall": 12,
}


def parse_timestamp(value: Any) -> Optional[datetime]:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def iso_utc(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def read_jsonl(path: Optional[Path]) -> List[Dict[str, Any]]:
    if path is None or not path.exists():
        return []
    rows: List[Dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            rows.append(json.loads(line))
    return rows


def observation_key(record: Dict[str, Any]) -> Tuple[str, str, str]:
    return (
        str(record.get("parking_id") or ""),
        str(record.get("observed_at") or ""),
        str(record.get("source_key") or ""),
    )


def valid_history_record(record: Dict[str, Any]) -> bool:
    if record.get("truth_state") != "observed":
        return False
    if not record.get("parking_id") or not record.get("source_key"):
        return False
    if parse_timestamp(record.get("observed_at")) is None:
        return False

    available = record.get("available_spaces")
    capacity = record.get("capacity_at_observation")
    if not isinstance(available, int) or not isinstance(capacity, int):
        return False
    if available < 0 or capacity <= 0 or available > capacity:
        return False
    return True


def merge_history(
    previous: Iterable[Dict[str, Any]],
    current: Iterable[Dict[str, Any]],
    *,
    as_of: datetime,
    retention_days: int = 90,
) -> List[Dict[str, Any]]:
    cutoff = as_of.astimezone(timezone.utc) - timedelta(days=max(1, retention_days))
    merged: Dict[Tuple[str, str, str], Dict[str, Any]] = {}

    for record in [*previous, *current]:
        if not valid_history_record(record):
            continue
        observed = parse_timestamp(record.get("observed_at"))
        if observed is None or observed < cutoff:
            continue
        merged[observation_key(record)] = record

    return sorted(
        merged.values(),
        key=lambda row: (
            parse_timestamp(row.get("observed_at")) or datetime.min.replace(tzinfo=timezone.utc),
            str(row.get("parking_id") or ""),
        ),
    )


def _stats(records: List[Dict[str, Any]]) -> Dict[str, Any]:
    available = [int(row["available_spaces"]) for row in records]
    occupancy = []
    for row in records:
        ratio = row.get("occupancy_ratio")
        if isinstance(ratio, (int, float)):
            occupancy.append(float(ratio))
        else:
            capacity = int(row["capacity_at_observation"])
            occupancy.append((capacity - int(row["available_spaces"])) / capacity)

    observed_times = [
        parse_timestamp(row.get("observed_at"))
        for row in records
        if parse_timestamp(row.get("observed_at")) is not None
    ]
    capacities = [int(row["capacity_at_observation"]) for row in records]

    return {
        "samples": len(records),
        "mean_available_spaces": round(mean(available), 2),
        "mean_occupancy_ratio": round(mean(occupancy), 4),
        "probability_any_space": round(sum(1 for value in available if value > 0) / len(available), 4),
        "mean_capacity": round(mean(capacities), 2),
        "first_observed_at": iso_utc(min(observed_times)),
        "last_observed_at": iso_utc(max(observed_times)),
    }


def build_baseline(history: Iterable[Dict[str, Any]], *, generated_at: datetime) -> Dict[str, Any]:
    valid = [record for record in history if valid_history_record(record)]
    by_asset: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for record in valid:
        by_asset[str(record["parking_id"])].append(record)

    locations: Dict[str, Any] = {}
    for parking_id, records in sorted(by_asset.items()):
        by_hour: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        by_weekday_hour: Dict[str, List[Dict[str, Any]]] = defaultdict(list)

        for record in records:
            observed = parse_timestamp(record.get("observed_at"))
            assert observed is not None
            local = observed.astimezone(LOCAL_TIMEZONE)
            hour_key = f"{local.hour:02d}"
            weekday_hour_key = f"{local.weekday()}-{local.hour:02d}"
            by_hour[hour_key].append(record)
            by_weekday_hour[weekday_hour_key].append(record)

        locations[parking_id] = {
            "overall": _stats(records),
            "hour": {key: _stats(rows) for key, rows in sorted(by_hour.items())},
            "weekday_hour": {key: _stats(rows) for key, rows in sorted(by_weekday_hour.items())},
        }

    observed_times = [
        parse_timestamp(row.get("observed_at"))
        for row in valid
        if parse_timestamp(row.get("observed_at")) is not None
    ]
    ready_locations = sum(
        1 for payload in locations.values()
        if payload["overall"]["samples"] >= MIN_SAMPLES["overall"]
    )

    return {
        "schema_version": "1.0",
        "generated_at": iso_utc(generated_at),
        "truth_state": "predicted",
        "timezone": "Europe/Dublin",
        "model": {
            "name": MODEL_NAME,
            "version": MODEL_VERSION,
            "type": "naive_baseline",
            "selection_order": ["weekday_hour", "hour", "overall"],
            "minimum_samples": MIN_SAMPLES,
            "ranking_enabled": False,
            "note": (
                "Experimental historical baseline. Predictions are descriptive historical means "
                "and are not used in WHITEBLOCK recommendation ranking until evaluated."
            ),
        },
        "coverage": {
            "locations_with_history": len(locations),
            "forecast_ready_locations": ready_locations,
            "eligible_observations": len(valid),
            "history_first_observed_at": iso_utc(min(observed_times)) if observed_times else None,
            "history_last_observed_at": iso_utc(max(observed_times)) if observed_times else None,
        },
        "locations": locations,
    }


def write_jsonl(path: Path, records: Iterable[Dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for record in records:
            handle.write(json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n")


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def run(
    current_path: Path,
    previous_path: Optional[Path],
    history_output: Path,
    baseline_output: Path,
    *,
    retention_days: int,
    now: Optional[datetime] = None,
) -> Dict[str, Any]:
    generated_at = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    previous = read_jsonl(previous_path)
    current = read_jsonl(current_path)
    history = merge_history(previous, current, as_of=generated_at, retention_days=retention_days)
    baseline = build_baseline(history, generated_at=generated_at)
    write_jsonl(history_output, history)
    write_json(baseline_output, baseline)
    return baseline


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build WHITEBLOCK Phase 3 Cork availability history and baseline.")
    parser.add_argument("--current", type=Path, required=True, help="Current official parking observations JSONL.")
    parser.add_argument("--previous", type=Path, default=None, help="Previously published history JSONL, when available.")
    parser.add_argument("--history-output", type=Path, required=True)
    parser.add_argument("--baseline-output", type=Path, required=True)
    parser.add_argument("--retention-days", type=int, default=90)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    baseline = run(
        args.current,
        args.previous,
        args.history_output,
        args.baseline_output,
        retention_days=args.retention_days,
    )
    coverage = baseline["coverage"]
    print(
        "WHITEBLOCK Phase 3 baseline built: "
        f"observations={coverage['eligible_observations']}, "
        f"locations={coverage['locations_with_history']}, "
        f"forecast_ready={coverage['forecast_ready_locations']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
