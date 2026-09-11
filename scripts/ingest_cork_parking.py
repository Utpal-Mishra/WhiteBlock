#!/usr/bin/env python3
"""Ingest Cork City Council parking data into WHITEBLOCK pilot outputs.

Standard-library only. The script:
1. downloads the authoritative Cork CSV;
2. saves an immutable raw snapshot;
3. validates the expected source schema;
4. splits stable parking assets from time-varying observations;
5. writes canonical inventory, observations, quarantine records and a run manifest.

This is a pilot ingestion path, not yet a production scheduler or database loader.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple
from urllib.request import Request, urlopen

SOURCE_URL = "https://data.corkcity.ie/datastore/dump/f4677dac-bb30-412e-95a8-d3c22134e3c0"
SOURCE_KEY = "cork_city_parking_live"
EXPECTED_FIELDS = {
    "identifier",
    "name",
    "spaces",
    "free_spaces",
    "opening_times",
    "height_restrictions",
    "price",
    "notes",
    "latitude",
    "longitude",
    "date",
}


@dataclass
class RunStats:
    source_records: int = 0
    inventory_records: int = 0
    observations: int = 0
    quarantined: int = 0


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso_utc(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def fetch_bytes(url: str, timeout: int = 30) -> bytes:
    request = Request(url, headers={"User-Agent": "WHITEBLOCK-Cork-Pilot/0.1"})
    with urlopen(request, timeout=timeout) as response:  # nosec B310 - fixed/explicit HTTPS source
        return response.read()


def decode_csv(payload: bytes) -> Tuple[List[Dict[str, str]], List[str]]:
    text = payload.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    fields = reader.fieldnames or []
    missing = sorted(EXPECTED_FIELDS.difference(fields))
    if missing:
        raise ValueError(f"Source schema missing expected fields: {', '.join(missing)}")
    return list(reader), fields


def parse_int(value: Any) -> Optional[int]:
    if value is None or str(value).strip() == "":
        return None
    return int(float(str(value).strip()))


def parse_float(value: Any) -> Optional[float]:
    if value is None or str(value).strip() == "":
        return None
    return float(str(value).strip())


def normalise_timestamp(value: str) -> Optional[str]:
    raw = (value or "").strip()
    if not raw:
        return None
    candidate = raw.replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(candidate)
    except ValueError:
        # Source timestamps can vary. Keep parsing deliberately conservative.
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S"):
            try:
                dt = datetime.strptime(raw, fmt)
                break
            except ValueError:
                continue
        else:
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return iso_utc(dt)


def canonical_id(source_identifier: str) -> str:
    """Map the official integer identifier to a stable WHITEBLOCK pilot ID."""
    try:
        source_id = int(str(source_identifier).strip())
    except (TypeError, ValueError) as exc:
        raise ValueError("Cork source identifier must be numeric for the pilot mapping") from exc
    if source_id < 0 or source_id > 999999:
        raise ValueError("Cork source identifier is outside the 6-digit pilot ID range")
    return f"WB-PARK-IE-CORK-{source_id:06d}"


def validate_row(row: Dict[str, str]) -> List[str]:
    errors: List[str] = []

    try:
        lat = parse_float(row.get("latitude"))
        lon = parse_float(row.get("longitude"))
    except ValueError:
        lat, lon = None, None
    if lat is None or lon is None or not (-90 <= lat <= 90) or not (-180 <= lon <= 180):
        errors.append("invalid_coordinates")

    try:
        capacity = parse_int(row.get("spaces"))
        free_spaces = parse_int(row.get("free_spaces"))
    except ValueError:
        capacity, free_spaces = None, None
        errors.append("invalid_capacity_value")

    if capacity is not None and capacity < 0:
        errors.append("negative_capacity")
    if free_spaces is not None and free_spaces < 0:
        errors.append("negative_free_spaces")
    if capacity is not None and free_spaces is not None and free_spaces > capacity:
        errors.append("free_spaces_exceeds_capacity")

    if normalise_timestamp(row.get("date", "")) is None:
        errors.append("missing_or_invalid_source_timestamp")

    try:
        canonical_id(row.get("identifier", ""))
    except ValueError:
        errors.append("invalid_source_identifier")

    return errors


def build_records(
    row: Dict[str, str],
    retrieved_at: str,
    raw_snapshot_ref: str,
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    parking_id = canonical_id(row["identifier"])
    capacity = parse_int(row.get("spaces"))
    free_spaces = parse_int(row.get("free_spaces"))
    lat = parse_float(row.get("latitude"))
    lon = parse_float(row.get("longitude"))
    observed_at = normalise_timestamp(row.get("date", ""))

    inventory = {
        "parking_id": parking_id,
        "name": (row.get("name") or "").strip(),
        "source_ids": {"cork_city": parse_int(row.get("identifier"))},
        "location": {
            "latitude": lat,
            "longitude": lon,
            "geometry": None,
            "entrance_geometry": None,
        },
        "parking_type": "unknown",
        "access_type": "public",
        "status": "verified",
        "operator": None,
        "capacity_verified": capacity,
        "capacity_estimated": None,
        "accessible_spaces": None,
        "ev_spaces": None,
        "opening_hours_raw": (row.get("opening_times") or "").strip() or None,
        "height_restriction_raw": (row.get("height_restrictions") or "").strip() or None,
        "pricing_raw": (row.get("price") or "").strip() or None,
        "maximum_stay_minutes": None,
        "source_notes": (row.get("notes") or "").strip() or None,
        "field_confidence": {
            "location": 0.98,
            "capacity_verified": 0.98,
            "public_access": 0.95,
        },
        "provenance": [
            {
                "source_type": "local_authority_open_data",
                "source_key": SOURCE_KEY,
                "source_url": SOURCE_URL,
                "source_timestamp": observed_at,
                "retrieved_at": retrieved_at,
                "truth_state": "observed",
                "confidence": 0.98,
            }
        ],
    }

    occupied = None
    occupancy_ratio = None
    if capacity is not None and free_spaces is not None:
        occupied = capacity - free_spaces
        if capacity > 0:
            occupancy_ratio = occupied / capacity

    observation = {
        "parking_id": parking_id,
        "observed_at": observed_at,
        "retrieved_at": retrieved_at,
        "available_spaces": free_spaces,
        "occupied_spaces": occupied,
        "capacity_at_observation": capacity,
        "occupancy_ratio": occupancy_ratio,
        "source_key": SOURCE_KEY,
        "source_record_id": parse_int(row.get("identifier")),
        "truth_state": "observed",
        "confidence": 0.98,
        "model_version": None,
        "raw_snapshot_ref": raw_snapshot_ref,
        "quality_flags": [],
    }
    return inventory, observation


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def write_jsonl(path: Path, records: Iterable[Dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for record in records:
            handle.write(json.dumps(record, ensure_ascii=False) + "\n")


def run(source_url: str, output_dir: Path) -> RunStats:
    started = utc_now()
    retrieved_at = iso_utc(started)
    run_id = started.strftime("%Y%m%dT%H%M%SZ")

    payload = fetch_bytes(source_url)
    digest = hashlib.sha256(payload).hexdigest()

    raw_dir = output_dir / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)
    raw_path = raw_dir / f"cork_parking_{run_id}.csv"
    raw_path.write_bytes(payload)
    raw_snapshot_ref = str(raw_path.as_posix())

    rows, source_fields = decode_csv(payload)
    stats = RunStats(source_records=len(rows))
    inventory: List[Dict[str, Any]] = []
    observations: List[Dict[str, Any]] = []
    quarantine: List[Dict[str, Any]] = []

    seen_ids = set()
    for row in rows:
        errors = validate_row(row)
        if errors:
            quarantine.append({"errors": errors, "source_record": row})
            continue

        asset, observation = build_records(row, retrieved_at, raw_snapshot_ref)
        if asset["parking_id"] in seen_ids:
            quarantine.append({"errors": ["duplicate_parking_id_in_source"], "source_record": row})
            continue
        seen_ids.add(asset["parking_id"])
        inventory.append(asset)
        observations.append(observation)

    stats.inventory_records = len(inventory)
    stats.observations = len(observations)
    stats.quarantined = len(quarantine)

    curated_dir = output_dir / "curated"
    write_json(curated_dir / "parking_inventory.json", inventory)
    write_jsonl(curated_dir / "parking_observations.jsonl", observations)
    write_jsonl(curated_dir / "quarantine.jsonl", quarantine)

    manifest = {
        "run_id": run_id,
        "source_key": SOURCE_KEY,
        "source_url": source_url,
        "retrieved_at": retrieved_at,
        "raw_snapshot": raw_snapshot_ref,
        "raw_sha256": digest,
        "source_fields": source_fields,
        "expected_fields": sorted(EXPECTED_FIELDS),
        "stats": stats.__dict__,
        "status": "success" if not quarantine else "success_with_quarantine",
    }
    write_json(output_dir / "manifests" / f"run_{run_id}.json", manifest)
    write_json(output_dir / "latest_run.json", manifest)
    return stats


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Ingest the Cork City Council parking feed for WHITEBLOCK.")
    parser.add_argument("--source-url", default=SOURCE_URL)
    parser.add_argument("--output-dir", type=Path, default=Path("data/cork"))
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        stats = run(args.source_url, args.output_dir)
    except Exception as exc:  # top-level CLI boundary
        print(f"WHITEBLOCK ingestion failed: {exc}", file=sys.stderr)
        return 1

    print(
        "WHITEBLOCK Cork ingestion complete: "
        f"source={stats.source_records}, inventory={stats.inventory_records}, "
        f"observations={stats.observations}, quarantined={stats.quarantined}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
