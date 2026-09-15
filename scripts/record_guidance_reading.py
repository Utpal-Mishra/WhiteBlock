#!/usr/bin/env python3
"""Record a roadside parking-guidance display reading and compare it with system data."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone

from db_common import connect


def parse_timestamp(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def agreement_score(displayed: int, system_value: int, capacity: int | None) -> float:
    difference = abs(displayed - system_value)
    if capacity and capacity > 0:
        return max(0.0, min(1.0, 1.0 - difference / capacity))
    return 1.0 if difference == 0 else max(0.0, 1.0 - difference / max(displayed, system_value, 1))


def record(args) -> tuple[int, dict | None]:
    observed_at = parse_timestamp(args.observed_at)
    insert_sql = """
      INSERT INTO parking_guidance_reading (
        display_id, observed_at, retrieved_at, target_key, parking_id, target_label,
        displayed_available_spaces, displayed_message, source_key, source_type,
        truth_state, confidence, raw_snapshot_ref, attributes
      )
      VALUES (
        %(display_id)s, %(observed_at)s, now(), %(target_key)s, %(parking_id)s,
        %(target_label)s, %(available)s, %(message)s, %(source_key)s, %(source_type)s,
        %(truth_state)s, %(confidence)s, %(raw_snapshot_ref)s, '{}'::jsonb
      )
      ON CONFLICT (display_id, observed_at, source_key, target_key)
      DO UPDATE SET
        parking_id = EXCLUDED.parking_id,
        target_label = EXCLUDED.target_label,
        displayed_available_spaces = EXCLUDED.displayed_available_spaces,
        displayed_message = EXCLUDED.displayed_message,
        source_type = EXCLUDED.source_type,
        truth_state = EXCLUDED.truth_state,
        confidence = EXCLUDED.confidence,
        raw_snapshot_ref = EXCLUDED.raw_snapshot_ref
      RETURNING reading_id
    """

    nearest_sql = """
      SELECT observation_id, observed_at, available_spaces, capacity_at_observation, source_key
      FROM parking_observation
      WHERE parking_id = %(parking_id)s
        AND available_spaces IS NOT NULL
        AND observed_at BETWEEN %(observed_at)s - interval '15 minutes'
                            AND %(observed_at)s + interval '15 minutes'
      ORDER BY abs(extract(epoch FROM (observed_at - %(observed_at)s))) ASC,
               observation_id DESC
      LIMIT 1
    """

    comparison_sql = """
      INSERT INTO parking_guidance_comparison (
        display_reading_id, parking_observation_id, variance_spaces,
        source_lag_seconds, agreement_score, notes
      )
      VALUES (%s, %s, %s, %s, %s, %s)
      ON CONFLICT (display_reading_id, parking_observation_id)
      DO UPDATE SET
        variance_spaces = EXCLUDED.variance_spaces,
        source_lag_seconds = EXCLUDED.source_lag_seconds,
        agreement_score = EXCLUDED.agreement_score,
        notes = EXCLUDED.notes
    """

    params = {
        "display_id": args.display_id,
        "observed_at": observed_at,
        "target_key": args.target_key,
        "parking_id": args.parking_id,
        "target_label": args.target_label,
        "available": args.available,
        "message": args.message,
        "source_key": args.source_key,
        "source_type": args.source_type,
        "truth_state": args.truth_state,
        "confidence": args.confidence,
        "raw_snapshot_ref": args.raw_snapshot_ref,
    }

    comparison = None
    with connect() as connection:
        with connection.cursor() as cursor:
            cursor.execute(insert_sql, params)
            reading_id = cursor.fetchone()[0]

            if args.parking_id and args.available is not None:
                cursor.execute(nearest_sql, {"parking_id": args.parking_id, "observed_at": observed_at})
                row = cursor.fetchone()
                if row:
                    observation_id, system_at, system_available, capacity, system_source = row
                    variance = args.available - system_available
                    lag_seconds = int((observed_at - system_at).total_seconds())
                    score = agreement_score(args.available, system_available, capacity)
                    note = f"Display source {args.source_key}; system source {system_source}"
                    cursor.execute(
                        comparison_sql,
                        (reading_id, observation_id, variance, lag_seconds, score, note),
                    )
                    comparison = {
                        "parking_observation_id": observation_id,
                        "system_available_spaces": system_available,
                        "variance_spaces": variance,
                        "source_lag_seconds": lag_seconds,
                        "agreement_score": round(score, 4),
                    }
        connection.commit()

    return reading_id, comparison


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--display-id", required=True)
    parser.add_argument("--observed-at", required=True, help="ISO-8601 timestamp")
    parser.add_argument("--available", type=int)
    parser.add_argument("--message")
    parser.add_argument("--target-key")
    parser.add_argument("--parking-id")
    parser.add_argument("--target-label")
    parser.add_argument("--source-key", required=True)
    parser.add_argument(
        "--source-type",
        choices=["system_feed", "operator_feed", "camera", "ocr", "manual", "unknown"],
        default="manual",
    )
    parser.add_argument(
        "--truth-state",
        choices=["observed", "inferred", "predicted", "unverified"],
        default="observed",
    )
    parser.add_argument("--confidence", type=float)
    parser.add_argument("--raw-snapshot-ref")
    args = parser.parse_args()

    if args.available is None and not args.message:
        parser.error("Provide --available, --message, or both")
    if args.available is not None and args.available < 0:
        parser.error("--available must be non-negative")
    if args.confidence is not None and not 0 <= args.confidence <= 1:
        parser.error("--confidence must be between 0 and 1")

    reading_id, comparison = record(args)
    print(f"Recorded guidance reading {reading_id}")
    if comparison:
        print(
            "Compared with parking observation "
            f"{comparison['parking_observation_id']}: variance={comparison['variance_spaces']} spaces, "
            f"lag={comparison['source_lag_seconds']}s, agreement={comparison['agreement_score']:.4f}"
        )
    else:
        print("No nearby linked parking observation was available for comparison")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
