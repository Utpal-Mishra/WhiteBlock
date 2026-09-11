#!/usr/bin/env python3
"""Load curated Cork parking assets and observations into PostGIS.

Run the Cork ingestion first:
    python scripts/ingest_cork_parking.py

Then:
    python scripts/load_cork_to_postgis.py

The loader is idempotent for canonical assets, exact source links, and observations.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any, Dict, Iterable, List

from db_common import connect

SOURCE_KEY = "cork_city_parking_live"
SOURCE_TYPE = "local_authority_open_data"
SOURCE_URL = "https://data.corkcity.ie/datastore/dump/f4677dac-bb30-412e-95a8-d3c22134e3c0"


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def read_jsonl(path: Path) -> List[Dict[str, Any]]:
    if not path.exists():
        return []
    records: List[Dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            records.append(json.loads(line))
    return records


def stable_hash(value: Dict[str, Any]) -> str:
    payload = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def load_assets(cur, assets: Iterable[Dict[str, Any]]) -> int:
    count = 0
    for asset in assets:
        location = asset["location"]
        provenance = asset.get("provenance") or []
        primary_provenance = provenance[0] if provenance else {}
        source_ids = asset.get("source_ids") or {}
        external_id = source_ids.get("cork_city")

        cur.execute(
            """
            INSERT INTO parking_location (
              parking_id, name, geom, parking_type, access_type, lifecycle_status,
              operator_name, capacity_verified, capacity_estimated, accessible_spaces,
              ev_spaces, opening_hours_raw, height_restriction_raw, pricing_raw,
              maximum_stay_minutes, source_notes, field_confidence, attributes,
              last_verified_at
            ) VALUES (
              %(parking_id)s, %(name)s,
              ST_SetSRID(ST_MakePoint(%(longitude)s, %(latitude)s), 4326),
              %(parking_type)s, %(access_type)s, %(status)s,
              %(operator)s, %(capacity_verified)s, %(capacity_estimated)s,
              %(accessible_spaces)s, %(ev_spaces)s, %(opening_hours_raw)s,
              %(height_restriction_raw)s, %(pricing_raw)s, %(maximum_stay_minutes)s,
              %(source_notes)s, %(field_confidence)s::jsonb, %(attributes)s::jsonb,
              %(last_verified_at)s
            )
            ON CONFLICT (parking_id) DO UPDATE SET
              name = EXCLUDED.name,
              geom = EXCLUDED.geom,
              parking_type = EXCLUDED.parking_type,
              access_type = EXCLUDED.access_type,
              lifecycle_status = EXCLUDED.lifecycle_status,
              operator_name = EXCLUDED.operator_name,
              capacity_verified = EXCLUDED.capacity_verified,
              capacity_estimated = EXCLUDED.capacity_estimated,
              accessible_spaces = EXCLUDED.accessible_spaces,
              ev_spaces = EXCLUDED.ev_spaces,
              opening_hours_raw = EXCLUDED.opening_hours_raw,
              height_restriction_raw = EXCLUDED.height_restriction_raw,
              pricing_raw = EXCLUDED.pricing_raw,
              maximum_stay_minutes = EXCLUDED.maximum_stay_minutes,
              source_notes = EXCLUDED.source_notes,
              field_confidence = EXCLUDED.field_confidence,
              attributes = parking_location.attributes || EXCLUDED.attributes,
              last_verified_at = GREATEST(parking_location.last_verified_at, EXCLUDED.last_verified_at)
            """,
            {
                **asset,
                "longitude": location["longitude"],
                "latitude": location["latitude"],
                "status": asset.get("status", "verified"),
                "field_confidence": json.dumps(asset.get("field_confidence") or {}),
                "attributes": json.dumps({"source_ids": source_ids}),
                "last_verified_at": primary_provenance.get("source_timestamp"),
            },
        )

        if external_id is not None:
            staged_payload = {
                "parking_id": asset["parking_id"],
                "name": asset["name"],
                "source_ids": source_ids,
                "capacity_verified": asset.get("capacity_verified"),
                "location": location,
            }
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
                  %(raw_snapshot_ref)s, %(content_hash)s, 'linked'
                )
                ON CONFLICT DO NOTHING
                RETURNING staging_id
                """,
                {
                    "source_key": SOURCE_KEY,
                    "external_id": str(external_id),
                    "source_timestamp": primary_provenance.get("source_timestamp"),
                    "retrieved_at": primary_provenance.get("retrieved_at"),
                    "name": asset["name"],
                    "longitude": location["longitude"],
                    "latitude": location["latitude"],
                    "capacity": asset.get("capacity_verified"),
                    "access_hint": asset.get("access_type"),
                    "payload": json.dumps(staged_payload),
                    "raw_snapshot_ref": None,
                    "content_hash": stable_hash(staged_payload),
                },
            )

            cur.execute(
                """
                INSERT INTO parking_source_link (
                  source_key, external_id, parking_id, match_method, match_score, metadata
                ) VALUES (%s, %s, %s, 'exact_authoritative_id', 1.0, %s::jsonb)
                ON CONFLICT (source_key, external_id) DO UPDATE SET
                  parking_id = EXCLUDED.parking_id,
                  match_method = EXCLUDED.match_method,
                  match_score = EXCLUDED.match_score,
                  last_seen_at = now(),
                  metadata = parking_source_link.metadata || EXCLUDED.metadata
                """,
                (
                    SOURCE_KEY,
                    str(external_id),
                    asset["parking_id"],
                    json.dumps({"authoritative": True}),
                ),
            )

        for evidence in provenance:
            cur.execute(
                """
                INSERT INTO parking_evidence (
                  parking_id, field_name, source_type, source_key, source_url,
                  source_timestamp, retrieved_at, truth_state, confidence, evidence_payload
                ) VALUES (
                  %(parking_id)s, NULL, %(source_type)s, %(source_key)s, %(source_url)s,
                  %(source_timestamp)s, %(retrieved_at)s, %(truth_state)s,
                  %(confidence)s, %(payload)s::jsonb
                )
                """,
                {
                    "parking_id": asset["parking_id"],
                    "source_type": evidence.get("source_type", SOURCE_TYPE),
                    "source_key": evidence.get("source_key", SOURCE_KEY),
                    "source_url": evidence.get("source_url", SOURCE_URL),
                    "source_timestamp": evidence.get("source_timestamp"),
                    "retrieved_at": evidence.get("retrieved_at"),
                    "truth_state": evidence.get("truth_state", "observed"),
                    "confidence": evidence.get("confidence"),
                    "payload": json.dumps({"asset_snapshot_hash": stable_hash(asset)}),
                },
            )
        count += 1
    return count


def load_observations(cur, observations: Iterable[Dict[str, Any]]) -> int:
    count = 0
    for obs in observations:
        cur.execute(
            """
            INSERT INTO parking_observation (
              parking_id, observed_at, retrieved_at, available_spaces, occupied_spaces,
              capacity_at_observation, occupancy_ratio, source_key, source_record_id,
              truth_state, confidence, model_version, raw_snapshot_ref, quality_flags
            ) VALUES (
              %(parking_id)s, %(observed_at)s, %(retrieved_at)s, %(available_spaces)s,
              %(occupied_spaces)s, %(capacity_at_observation)s, %(occupancy_ratio)s,
              %(source_key)s, %(source_record_id)s, %(truth_state)s, %(confidence)s,
              %(model_version)s, %(raw_snapshot_ref)s, %(quality_flags)s::jsonb
            )
            ON CONFLICT (parking_id, observed_at, source_key) DO UPDATE SET
              retrieved_at = GREATEST(parking_observation.retrieved_at, EXCLUDED.retrieved_at),
              available_spaces = EXCLUDED.available_spaces,
              occupied_spaces = EXCLUDED.occupied_spaces,
              capacity_at_observation = EXCLUDED.capacity_at_observation,
              occupancy_ratio = EXCLUDED.occupancy_ratio,
              confidence = EXCLUDED.confidence,
              raw_snapshot_ref = EXCLUDED.raw_snapshot_ref,
              quality_flags = EXCLUDED.quality_flags
            """,
            {**obs, "source_record_id": str(obs.get("source_record_id")) if obs.get("source_record_id") is not None else None,
             "quality_flags": json.dumps(obs.get("quality_flags") or [])},
        )
        count += 1
    return count


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Load WHITEBLOCK Cork curated data into PostGIS.")
    parser.add_argument("--inventory", type=Path, default=Path("data/cork/curated/parking_inventory.json"))
    parser.add_argument("--observations", type=Path, default=Path("data/cork/curated/parking_observations.jsonl"))
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    assets = read_json(args.inventory)
    observations = read_jsonl(args.observations)

    with connect() as conn:
        with conn.cursor() as cur:
            asset_count = load_assets(cur, assets)
            observation_count = load_observations(cur, observations)
        conn.commit()

    print(json.dumps({"assets_loaded": asset_count, "observations_loaded": observation_count}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
