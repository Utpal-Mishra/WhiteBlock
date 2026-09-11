#!/usr/bin/env python3
"""Resolve an ambiguous WHITEBLOCK entity match.

Confirmation creates the durable source link and evidence record. Rejection only
rejects that candidate; it does not automatically create a new parking asset.
"""

from __future__ import annotations

import argparse
import json

from db_common import connect


def confirm(cur, staging_id: int, parking_id: str) -> None:
    cur.execute(
        """
        SELECT source_key, external_id, source_timestamp, retrieved_at
        FROM source_record
        WHERE staging_id = %s
        """,
        (staging_id,),
    )
    source = cur.fetchone()
    if not source:
        raise ValueError(f"Unknown staging_id: {staging_id}")
    source_key, external_id, source_timestamp, retrieved_at = source
    if not external_id:
        raise ValueError("Cannot confirm a durable source link without external_id")

    cur.execute(
        """
        SELECT match_score FROM entity_match_candidate
        WHERE staging_id = %s AND parking_id = %s
        """,
        (staging_id, parking_id),
    )
    match = cur.fetchone()
    if not match:
        raise ValueError("The requested parking_id is not a candidate for this staging record")
    score = float(match[0])

    cur.execute(
        """
        INSERT INTO parking_source_link (
          source_key, external_id, parking_id, match_method, match_score, metadata
        ) VALUES (%s, %s, %s, 'manual_confirmation', %s, %s::jsonb)
        ON CONFLICT (source_key, external_id) DO UPDATE SET
          parking_id = EXCLUDED.parking_id,
          match_method = EXCLUDED.match_method,
          match_score = EXCLUDED.match_score,
          last_seen_at = now(),
          metadata = EXCLUDED.metadata
        """,
        (source_key, external_id, parking_id, score, json.dumps({"staging_id": staging_id})),
    )
    cur.execute(
        """
        UPDATE entity_match_candidate
        SET decision = CASE WHEN parking_id = %s THEN 'confirmed' ELSE 'rejected' END,
            decision_reason = CASE WHEN parking_id = %s THEN 'manual_confirmation' ELSE 'manual_alternative_rejected' END,
            decided_at = now()
        WHERE staging_id = %s
        """,
        (parking_id, parking_id, staging_id),
    )
    cur.execute(
        "UPDATE source_record SET reconciliation_status = 'linked' WHERE staging_id = %s",
        (staging_id,),
    )
    cur.execute(
        """
        INSERT INTO parking_evidence (
          parking_id, staging_id, source_type, source_key, source_timestamp,
          retrieved_at, truth_state, confidence, evidence_payload
        ) VALUES (%s, %s, 'reconciled_source', %s, %s, %s, 'observed', %s, %s::jsonb)
        """,
        (
            parking_id,
            staging_id,
            source_key,
            source_timestamp,
            retrieved_at,
            score,
            json.dumps({"external_id": external_id, "match_method": "manual_confirmation"}),
        ),
    )


def reject(cur, staging_id: int, parking_id: str) -> None:
    cur.execute(
        """
        UPDATE entity_match_candidate
        SET decision = 'rejected', decision_reason = 'manual_rejection', decided_at = now()
        WHERE staging_id = %s AND parking_id = %s
        RETURNING parking_id
        """,
        (staging_id, parking_id),
    )
    if not cur.fetchone():
        raise ValueError("Candidate not found")
    cur.execute(
        """
        UPDATE source_record
        SET reconciliation_status = 'review'
        WHERE staging_id = %s
        """,
        (staging_id,),
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Confirm or reject a WHITEBLOCK entity match.")
    parser.add_argument("action", choices=("confirm", "reject"))
    parser.add_argument("--staging-id", type=int, required=True)
    parser.add_argument("--parking-id", required=True)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    with connect() as conn:
        with conn.cursor() as cur:
            if args.action == "confirm":
                confirm(cur, args.staging_id, args.parking_id)
            else:
                reject(cur, args.staging_id, args.parking_id)
        conn.commit()
    print(json.dumps({"action": args.action, "staging_id": args.staging_id, "parking_id": args.parking_id}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
