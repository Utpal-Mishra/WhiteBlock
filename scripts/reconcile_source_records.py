#!/usr/bin/env python3
"""Reconcile staged parking records against canonical WHITEBLOCK assets.

The matcher is intentionally conservative. It auto-links only when:
- the best match score is high;
- name similarity is high;
- distance is small; and
- the best candidate is clearly better than the second-best candidate.

Everything else remains reviewable.
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Sequence, Tuple

from db_common import connect

DEFAULT_RADIUS_M = 150.0
AUTO_SCORE = 0.92
AUTO_NAME_SIMILARITY = 0.88
AUTO_DISTANCE_M = 30.0
AUTO_MARGIN = 0.08
REVIEW_SCORE = 0.68


@dataclass(frozen=True)
class MatchCandidate:
    parking_id: str
    distance_m: float
    name_similarity: float
    canonical_capacity: Optional[int]
    score: float
    capacity_similarity: Optional[float]


def capacity_similarity(source_capacity: Optional[int], canonical_capacity: Optional[int]) -> Optional[float]:
    if source_capacity is None or canonical_capacity is None:
        return None
    denominator = max(source_capacity, canonical_capacity, 1)
    return max(0.0, 1.0 - abs(source_capacity - canonical_capacity) / denominator)


def match_score(
    distance_m: float,
    name_similarity: float,
    source_capacity: Optional[int],
    canonical_capacity: Optional[int],
    radius_m: float = DEFAULT_RADIUS_M,
) -> Tuple[float, Optional[float]]:
    distance_component = max(0.0, 1.0 - distance_m / max(radius_m, 1.0))
    cap_component = capacity_similarity(source_capacity, canonical_capacity)

    weighted = 0.60 * max(0.0, min(1.0, name_similarity)) + 0.35 * distance_component
    total_weight = 0.95
    if cap_component is not None:
        weighted += 0.05 * cap_component
        total_weight += 0.05
    return weighted / total_weight, cap_component


def classify(best: Optional[MatchCandidate], second: Optional[MatchCandidate]) -> Tuple[str, str]:
    if best is None:
        return "review", "no_candidate_within_radius"
    margin = best.score - second.score if second else best.score
    if (
        best.score >= AUTO_SCORE
        and best.name_similarity >= AUTO_NAME_SIMILARITY
        and best.distance_m <= AUTO_DISTANCE_M
        and margin >= AUTO_MARGIN
    ):
        return "auto_linked", "high_score_clear_margin"
    if best.score >= REVIEW_SCORE:
        return "review", "plausible_match_requires_review"
    return "review", "weak_match_or_possible_new_asset"


def fetch_candidates(cur, staging_id: int, radius_m: float) -> List[Dict[str, Any]]:
    cur.execute(
        """
        SELECT
          p.parking_id,
          ST_Distance(p.geom::geography, sr.geom::geography) AS distance_m,
          similarity(p.normalized_name, sr.normalized_name) AS name_similarity,
          p.capacity_verified AS canonical_capacity,
          sr.capacity AS source_capacity
        FROM source_record sr
        JOIN parking_location p
          ON sr.staging_id = %s
         AND sr.geom IS NOT NULL
         AND ST_DWithin(p.geom::geography, sr.geom::geography, %s)
         AND p.lifecycle_status <> 'retired'
        ORDER BY ST_Distance(p.geom::geography, sr.geom::geography) ASC
        LIMIT 20
        """,
        (staging_id, radius_m),
    )
    columns = [desc.name for desc in cur.description]
    return [dict(zip(columns, row)) for row in cur.fetchall()]


def reconcile_one(cur, source: Dict[str, Any], radius_m: float) -> Tuple[str, Optional[str]]:
    # Existing exact source link always wins over fuzzy matching.
    if source.get("external_id"):
        cur.execute(
            "SELECT parking_id FROM parking_source_link WHERE source_key = %s AND external_id = %s",
            (source["source_key"], source["external_id"]),
        )
        existing = cur.fetchone()
        if existing:
            cur.execute(
                "UPDATE source_record SET reconciliation_status = 'linked' WHERE staging_id = %s",
                (source["staging_id"],),
            )
            return "linked", existing[0]

    raw_candidates = fetch_candidates(cur, source["staging_id"], radius_m)
    candidates: List[MatchCandidate] = []
    for row in raw_candidates:
        score, cap_sim = match_score(
            float(row["distance_m"]),
            float(row["name_similarity"] or 0.0),
            source.get("capacity"),
            row.get("canonical_capacity"),
            radius_m,
        )
        candidates.append(
            MatchCandidate(
                parking_id=row["parking_id"],
                distance_m=float(row["distance_m"]),
                name_similarity=float(row["name_similarity"] or 0.0),
                canonical_capacity=row.get("canonical_capacity"),
                score=score,
                capacity_similarity=cap_sim,
            )
        )
    candidates.sort(key=lambda item: item.score, reverse=True)

    best = candidates[0] if candidates else None
    second = candidates[1] if len(candidates) > 1 else None
    decision, reason = classify(best, second)

    for index, candidate in enumerate(candidates):
        candidate_decision = decision if index == 0 else "rejected"
        candidate_reason = reason if index == 0 else "lower_ranked_candidate"
        cur.execute(
            """
            INSERT INTO entity_match_candidate (
              staging_id, parking_id, distance_m, name_similarity, capacity_similarity,
              match_score, score_components, decision, decision_reason, decided_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s,
                      CASE WHEN %s IN ('auto_linked','rejected') THEN now() ELSE NULL END)
            ON CONFLICT (staging_id, parking_id) DO UPDATE SET
              distance_m = EXCLUDED.distance_m,
              name_similarity = EXCLUDED.name_similarity,
              capacity_similarity = EXCLUDED.capacity_similarity,
              match_score = EXCLUDED.match_score,
              score_components = EXCLUDED.score_components,
              decision = EXCLUDED.decision,
              decision_reason = EXCLUDED.decision_reason,
              decided_at = EXCLUDED.decided_at
            """,
            (
                source["staging_id"],
                candidate.parking_id,
                candidate.distance_m,
                candidate.name_similarity,
                candidate.capacity_similarity,
                candidate.score,
                json.dumps({
                    "weights": {"name": 0.60, "distance": 0.35, "capacity": 0.05},
                    "radius_m": radius_m,
                    "source_capacity": source.get("capacity"),
                    "canonical_capacity": candidate.canonical_capacity,
                }),
                candidate_decision,
                candidate_reason,
                candidate_decision,
            ),
        )

    if decision == "auto_linked" and best and source.get("external_id"):
        cur.execute(
            """
            INSERT INTO parking_source_link (
              source_key, external_id, parking_id, match_method, match_score, metadata
            ) VALUES (%s, %s, %s, 'spatial_name_reconciliation', %s, %s::jsonb)
            ON CONFLICT (source_key, external_id) DO UPDATE SET
              parking_id = EXCLUDED.parking_id,
              match_method = EXCLUDED.match_method,
              match_score = EXCLUDED.match_score,
              last_seen_at = now(),
              metadata = EXCLUDED.metadata
            """,
            (
                source["source_key"],
                source["external_id"],
                best.parking_id,
                best.score,
                json.dumps({"staging_id": source["staging_id"], "decision_reason": reason}),
            ),
        )
        cur.execute(
            """
            INSERT INTO parking_evidence (
              parking_id, staging_id, source_type, source_key, source_timestamp,
              retrieved_at, truth_state, confidence, evidence_payload
            ) VALUES (%s, %s, 'reconciled_source', %s, %s, %s, 'observed', %s, %s::jsonb)
            """,
            (
                best.parking_id,
                source["staging_id"],
                source["source_key"],
                source.get("source_timestamp"),
                source.get("retrieved_at"),
                best.score,
                json.dumps({"external_id": source.get("external_id"), "match_method": "spatial_name_reconciliation"}),
            ),
        )
        cur.execute(
            "UPDATE source_record SET reconciliation_status = 'linked' WHERE staging_id = %s",
            (source["staging_id"],),
        )
        return "auto_linked", best.parking_id

    cur.execute(
        "UPDATE source_record SET reconciliation_status = 'review' WHERE staging_id = %s",
        (source["staging_id"],),
    )
    return "review", best.parking_id if best else None


def run(source_key: Optional[str], radius_m: float, limit: int) -> Dict[str, int]:
    stats = {"processed": 0, "linked": 0, "auto_linked": 0, "review": 0}
    with connect() as conn:
        with conn.cursor() as cur:
            if source_key:
                cur.execute(
                    """
                    SELECT staging_id, source_key, external_id, source_timestamp, retrieved_at, name, capacity
                    FROM source_record
                    WHERE reconciliation_status = 'pending' AND source_key = %s
                    ORDER BY staging_id LIMIT %s
                    """,
                    (source_key, limit),
                )
            else:
                cur.execute(
                    """
                    SELECT staging_id, source_key, external_id, source_timestamp, retrieved_at, name, capacity
                    FROM source_record
                    WHERE reconciliation_status = 'pending'
                    ORDER BY staging_id LIMIT %s
                    """,
                    (limit,),
                )
            columns = [desc.name for desc in cur.description]
            sources = [dict(zip(columns, row)) for row in cur.fetchall()]

            for source in sources:
                outcome, _ = reconcile_one(cur, source, radius_m)
                stats["processed"] += 1
                stats[outcome] = stats.get(outcome, 0) + 1
        conn.commit()
    return stats


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Reconcile staged parking source records.")
    parser.add_argument("--source-key")
    parser.add_argument("--radius-m", type=float, default=DEFAULT_RADIUS_M)
    parser.add_argument("--limit", type=int, default=1000)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    print(json.dumps(run(args.source_key, args.radius_m, args.limit)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
