#!/usr/bin/env python3
"""Export the latest curated Cork parking data to a browser-safe WHITEBLOCK snapshot.

This is the bridge between the evidence-backed ingestion pipeline and the static
GitHub Pages application. It deliberately publishes only fields needed by the UI;
raw snapshots and internal provenance remain outside the web artifact.
"""

from __future__ import annotations

import argparse
import json
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def read_jsonl(path: Path) -> Iterable[Dict[str, Any]]:
    if not path.exists():
        return []
    records: List[Dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            records.append(json.loads(line))
    return records


def parse_timestamp(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def freshness_score(observed_at: Optional[str], generated_at: datetime) -> float:
    observed = parse_timestamp(observed_at)
    if observed is None:
        return 0.50
    age_minutes = max(0.0, (generated_at - observed).total_seconds() / 60.0)
    if age_minutes <= 15:
        return 1.00
    if age_minutes <= 30:
        return 0.96
    if age_minutes <= 60:
        return 0.90
    if age_minutes <= 180:
        return 0.80
    if age_minutes <= 720:
        return 0.68
    return 0.55


def completeness_score(asset: Dict[str, Any]) -> float:
    checks = [
        asset.get("capacity_verified") is not None,
        bool(asset.get("opening_hours_raw")),
        bool(asset.get("pricing_raw")),
        bool(asset.get("height_restriction_raw")),
        bool(asset.get("source_notes")),
    ]
    return sum(1 for check in checks if check) / len(checks)


def source_score(asset: Dict[str, Any], observation: Dict[str, Any]) -> float:
    provenance = asset.get("provenance") or []
    values = [float(item.get("confidence")) for item in provenance if item.get("confidence") is not None]
    if observation.get("confidence") is not None:
        values.append(float(observation["confidence"]))
    return sum(values) / len(values) if values else 0.70


def composite_confidence(asset: Dict[str, Any], observation: Dict[str, Any], generated_at: datetime) -> Dict[str, Any]:
    source = source_score(asset, observation)
    freshness = freshness_score(observation.get("observed_at"), generated_at)
    completeness = completeness_score(asset)
    score = 0.55 * source + 0.30 * freshness + 0.15 * completeness
    score = max(0.0, min(1.0, score))
    return {
        "score": round(score, 3),
        "basis": {
            "source": round(source, 3),
            "freshness": round(freshness, 3),
            "completeness": round(completeness, 3),
        },
    }


def latest_observations(records: Iterable[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    latest: Dict[str, Dict[str, Any]] = {}
    for record in records:
        parking_id = record.get("parking_id")
        if not parking_id:
            continue
        current = latest.get(parking_id)
        if current is None:
            latest[parking_id] = record
            continue
        current_ts = parse_timestamp(current.get("observed_at")) or datetime.min.replace(tzinfo=timezone.utc)
        record_ts = parse_timestamp(record.get("observed_at")) or datetime.min.replace(tzinfo=timezone.utc)
        if record_ts >= current_ts:
            latest[parking_id] = record
    return latest


def build_snapshot(input_dir: Path) -> Dict[str, Any]:
    curated = input_dir / "curated"
    inventory = read_json(curated / "parking_inventory.json")
    observations = latest_observations(read_jsonl(curated / "parking_observations.jsonl"))
    manifest = read_json(input_dir / "latest_run.json")
    generated_at = datetime.now(timezone.utc)

    locations: List[Dict[str, Any]] = []
    for asset in inventory:
        parking_id = asset.get("parking_id")
        observation = observations.get(parking_id, {})
        location = asset.get("location") or {}
        lat = location.get("latitude")
        lng = location.get("longitude")
        if lat is None or lng is None:
            continue

        confidence = composite_confidence(asset, observation, generated_at)
        capacity = observation.get("capacity_at_observation")
        if capacity is None:
            capacity = asset.get("capacity_verified")

        available = observation.get("available_spaces")
        occupied = observation.get("occupied_spaces")
        occupancy_ratio = observation.get("occupancy_ratio")
        if occupancy_ratio is None and capacity not in (None, 0) and occupied is not None:
            occupancy_ratio = occupied / capacity

        locations.append(
            {
                "parking_id": parking_id,
                "name": asset.get("name") or parking_id,
                "latitude": lat,
                "longitude": lng,
                "access_type": asset.get("access_type"),
                "status": asset.get("status"),
                "capacity": capacity,
                "available_spaces": available,
                "occupied_spaces": occupied,
                "occupancy_ratio": round(float(occupancy_ratio), 4) if occupancy_ratio is not None else None,
                "observed_at": observation.get("observed_at"),
                "retrieved_at": observation.get("retrieved_at"),
                "truth_state": observation.get("truth_state") or "observed",
                "confidence": confidence,
                "pricing_raw": asset.get("pricing_raw"),
                "opening_hours_raw": asset.get("opening_hours_raw"),
                "height_restriction_raw": asset.get("height_restriction_raw"),
                "accessible_spaces": asset.get("accessible_spaces"),
                "ev_spaces": asset.get("ev_spaces"),
                "source_key": observation.get("source_key") or manifest.get("source_key"),
            }
        )

    locations.sort(key=lambda item: item["parking_id"])
    available_values = [item["available_spaces"] for item in locations if isinstance(item.get("available_spaces"), int)]
    capacity_values = [item["capacity"] for item in locations if isinstance(item.get("capacity"), int)]

    return {
        "schema_version": "1.0",
        "generated_at": generated_at.isoformat().replace("+00:00", "Z"),
        "source": {
            "key": manifest.get("source_key"),
            "retrieved_at": manifest.get("retrieved_at"),
            "run_id": manifest.get("run_id"),
            "status": manifest.get("status"),
        },
        "coverage": {
            "country": "IE",
            "region": "Cork",
            "mode": "pilot",
        },
        "summary": {
            "locations": len(locations),
            "available_spaces": sum(available_values) if available_values else None,
            "capacity": sum(capacity_values) if capacity_values else None,
        },
        "locations": locations,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Export WHITEBLOCK browser parking snapshot")
    parser.add_argument("--input-dir", type=Path, default=Path("data/cork"))
    parser.add_argument("--output", type=Path, default=Path("web/data/parking_snapshot.json"))
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    snapshot = build_snapshot(args.input_dir)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(snapshot, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"WHITEBLOCK web snapshot: {len(snapshot['locations'])} locations -> {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
