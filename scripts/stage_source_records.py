#!/usr/bin/env python3
"""Stage normalized external parking records for WHITEBLOCK reconciliation.

Input is JSON or JSONL containing records with:
  external_id, name, latitude, longitude
Optional:
  capacity, access_hint, source_timestamp, retrieved_at, raw_snapshot_ref, payload

Example:
  python scripts/stage_source_records.py --source-key osm_parking --input data/osm.jsonl
"""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List

from db_common import connect


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def load_records(path: Path) -> List[Dict[str, Any]]:
    text = path.read_text(encoding="utf-8")
    if path.suffix.lower() == ".jsonl":
        return [json.loads(line) for line in text.splitlines() if line.strip()]
    data = json.loads(text)
    if isinstance(data, list):
        return data
    if isinstance(data, dict) and isinstance(data.get("records"), list):
        return data["records"]
    raise ValueError("Input must be a JSON array, {'records': [...]}, or JSONL file")


def validate(record: Dict[str, Any]) -> None:
    missing = [key for key in ("external_id", "name", "latitude", "longitude") if record.get(key) in (None, "")]
    if missing:
        raise ValueError(f"Missing required fields: {', '.join(missing)}")
    lat = float(record["latitude"])
    lon = float(record["longitude"])
    if not -90 <= lat <= 90 or not -180 <= lon <= 180:
        raise ValueError("Invalid coordinates")
    if record.get("capacity") is not None and int(record["capacity"]) < 0:
        raise ValueError("capacity must be non-negative")


def content_hash(record: Dict[str, Any]) -> str:
    canonical = json.dumps(record, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def stage(source_key: str, records: Iterable[Dict[str, Any]]) -> Dict[str, int]:
    stats = {"staged": 0, "skipped": 0, "invalid": 0}
    with connect() as conn:
        with conn.cursor() as cur:
            for record in records:
                try:
                    validate(record)
                except (ValueError, TypeError):
                    stats["invalid"] += 1
                    continue

                payload = record.get("payload") if isinstance(record.get("payload"), dict) else record
                retrieved_at = record.get("retrieved_at") or iso_now()
                digest = content_hash(record)
                cur.execute(
                    """
                    INSERT INTO source_record (
                      source_key, external_id, source_timestamp, retrieved_at, name, geom,
                      capacity, access_hint, payload, raw_snapshot_ref, content_hash,
                      reconciliation_status
                    ) VALUES (
                      %(source_key)s, %(external_id)s, %(source_timestamp)s, %(retrieved_at)s,
                      %(name)s, ST_SetSRID(ST_MakePoint(%(longitude)s, %(latitude)s), 4326),
                      %(capacity)s, %(access_hint)s, %(payload)s::jsonb,
                      %(raw_snapshot_ref)s, %(content_hash)s, 'pending'
                    )
                    ON CONFLICT DO NOTHING
                    RETURNING staging_id
                    """,
                    {
                        "source_key": source_key,
                        "external_id": str(record["external_id"]),
                        "source_timestamp": record.get("source_timestamp"),
                        "retrieved_at": retrieved_at,
                        "name": str(record["name"]),
                        "longitude": float(record["longitude"]),
                        "latitude": float(record["latitude"]),
                        "capacity": int(record["capacity"]) if record.get("capacity") is not None else None,
                        "access_hint": record.get("access_hint"),
                        "payload": json.dumps(payload),
                        "raw_snapshot_ref": record.get("raw_snapshot_ref"),
                        "content_hash": digest,
                    },
                )
                if cur.fetchone():
                    stats["staged"] += 1
                else:
                    stats["skipped"] += 1
        conn.commit()
    return stats


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Stage normalized parking source records.")
    parser.add_argument("--source-key", required=True)
    parser.add_argument("--input", type=Path, required=True)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    records = load_records(args.input)
    print(json.dumps(stage(args.source_key, records)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
