#!/usr/bin/env python3
"""Build the Phase 4 WHITEBLOCK parking-supply discovery registry.

The pipeline accepts:
1. existing human-reviewed imagery conclusions; and
2. optional automated detection batches from explicitly licensed sources.

Every output remains a non-recommendable candidate until independent access/rule
verification promotes it through a separate governed decision.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from math import asin, cos, radians, sin, sqrt
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple


def load(path: Path) -> Dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def candidate_id(country: str, region: str, seed: str) -> str:
    token = hashlib.sha256(seed.encode("utf-8")).hexdigest()[:12].upper()
    safe_region = "".join(ch if ch.isalnum() else "_" for ch in region.upper()).strip("_") or "UNKNOWN"
    return f"WB-CAND-{country.upper()}-{safe_region}-{token}"


def numeric(value: Any) -> Optional[float]:
    if isinstance(value, bool):
        return None
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    return result


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return 6371000.0 * 2 * asin(sqrt(min(1.0, a)))


def flatten_coordinates(value: Any) -> Iterable[Tuple[float, float]]:
    if not isinstance(value, list):
        return
    if len(value) >= 2 and numeric(value[0]) is not None and numeric(value[1]) is not None:
        yield float(value[0]), float(value[1])
        return
    for item in value:
        yield from flatten_coordinates(item)


def geometry_centroid(geometry: Dict[str, Any]) -> Optional[Tuple[float, float]]:
    if not isinstance(geometry, dict):
        return None
    points = list(flatten_coordinates(geometry.get("coordinates")))
    if not points:
        return None
    lon = sum(point[0] for point in points) / len(points)
    lat = sum(point[1] for point in points) / len(points)
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        return None
    return lat, lon


def location_coordinates(item: Dict[str, Any]) -> Optional[Tuple[float, float]]:
    lat = numeric(item.get("latitude", item.get("lat")))
    lon = numeric(item.get("longitude", item.get("lng")))
    if lat is None or lon is None:
        location = item.get("location") or {}
        lat = numeric(location.get("latitude"))
        lon = numeric(location.get("longitude"))
    if lat is None or lon is None or not (-90 <= lat <= 90 and -180 <= lon <= 180):
        return None
    return float(lat), float(lon)


def load_known_assets(snapshot_dir: Path) -> List[Dict[str, Any]]:
    assets: Dict[str, Dict[str, Any]] = {}
    patterns = ("parking_snapshot.json", "*_parking_snapshot.json")
    for pattern in patterns:
        for path in sorted(snapshot_dir.glob(pattern)):
            try:
                payload = load(path)
            except (OSError, json.JSONDecodeError):
                continue
            for item in payload.get("locations") or []:
                parking_id = str(item.get("parking_id") or item.get("id") or "")
                coords = location_coordinates(item)
                if not parking_id or coords is None:
                    continue
                assets[parking_id] = {
                    "parking_id": parking_id,
                    "name": item.get("name"),
                    "latitude": coords[0],
                    "longitude": coords[1],
                    "region": payload.get("coverage", {}).get("region") or item.get("region") or item.get("area"),
                }
    return list(assets.values())


def nearest_asset(lat: float, lon: float, known_assets: List[Dict[str, Any]]) -> Tuple[Optional[Dict[str, Any]], Optional[float]]:
    best = None
    best_distance = None
    for asset in known_assets:
        distance = haversine_m(lat, lon, asset["latitude"], asset["longitude"])
        if best_distance is None or distance < best_distance:
            best = asset
            best_distance = distance
    return best, best_distance


def source_contract(sources: Dict[str, Any], source_key: str) -> Dict[str, Any]:
    row = (sources.get("sources") or {}).get(source_key)
    if not row:
        raise ValueError(f"Detection source {source_key!r} is not registered in the Phase 4 imagery-source contract")
    if row.get("machine_ingestion_allowed") is not True:
        raise ValueError(
            f"Detection source {source_key!r} is fail-closed: machine_ingestion_allowed is not true "
            f"(licence_status={row.get('licence_status')!r})"
        )
    if row.get("licence_status") not in {"approved", "verified_for_automated_analysis"}:
        raise ValueError(
            f"Detection source {source_key!r} has not recorded an approved machine-analysis licence status"
        )
    return row


def manual_candidates(
    evidence: Dict[str, Any],
    config: Dict[str, Any],
    known_assets: List[Dict[str, Any]],
    *,
    created_at: str,
) -> List[Dict[str, Any]]:
    actions = set(config.get("manual_followup_actions") or [])
    allowed_regions = {str(value).lower() for value in (config.get("manual_review_regions") or [config.get("pilot_region")]) if value}
    by_id = {item["parking_id"]: item for item in known_assets}
    country = str(config.get("candidate_country") or "IE")
    output = []

    for row in evidence.get("records") or []:
        action = str(row.get("geometry_action") or "")
        if action not in actions:
            continue
        if allowed_regions and str(row.get("region") or "").lower() not in allowed_regions:
            continue
        parking_id = str(row.get("parking_id") or "")
        known = by_id.get(parking_id)
        region = str(row.get("region") or known.get("region") if known else row.get("region") or config.get("pilot_region") or "UNKNOWN")
        coords = (known["latitude"], known["longitude"]) if known else None
        state = "needs_geometry_verification" if action == "candidate_polygon_allowed" else "needs_field_verification"
        ctype = "geometry_extension" if action == "candidate_polygon_allowed" else "field_verification"
        seed = f"manual|{evidence.get('review_id')}|{parking_id}|{action}"
        output.append({
            "candidate_id": candidate_id(country, region, seed),
            "candidate_type": ctype,
            "candidate_state": state,
            "region": region,
            "name": row.get("name") or (known or {}).get("name"),
            "centroid": {
                "latitude": coords[0],
                "longitude": coords[1],
            } if coords else None,
            "geometry": None,
            "estimated_capacity": None,
            "estimated_surface_area_m2": None,
            "truth_state": "inferred",
            "recommendation_eligible": False,
            "access_state": "verification_required",
            "public_access_verified": False,
            "match": {
                "parking_id": parking_id or None,
                "distance_m": 0 if known else None,
                "relation": "existing_asset_imagery_followup",
            },
            "evidence": [{
                "evidence_type": "human_imagery_review",
                "source_key": "esri_world_imagery_review",
                "imagery_acquisition_date": row.get("imagery_acquisition_date"),
                "model_name": None,
                "model_version": None,
                "confidence": numeric(row.get("confidence")),
                "review_id": evidence.get("review_id"),
                "review_result": row.get("review_result"),
                "geometry_action": action,
                "note": row.get("note"),
            }],
            "verification_required": [
                "geometry_or_field_review",
                "access_and_rules_evidence_before_recommendation",
            ],
            "created_at": created_at,
            "updated_at": created_at,
        })
    return output


def automated_candidates(
    batch: Dict[str, Any],
    config: Dict[str, Any],
    sources: Dict[str, Any],
    known_assets: List[Dict[str, Any]],
    *,
    created_at: str,
) -> List[Dict[str, Any]]:
    source_key = str(batch.get("source_key") or "")
    source_contract(sources, source_key)

    country = str(config.get("candidate_country") or "IE")
    region = str(batch.get("region") or config.get("pilot_region") or "UNKNOWN")
    pilot_region = str(config.get("pilot_region") or "")
    if (
        config.get("allow_non_pilot_detection_batches") is not True
        and pilot_region
        and region.lower() != pilot_region.lower()
    ):
        raise ValueError(
            f"Detection batch region {region!r} is outside the active Phase 4 pilot {pilot_region!r}"
        )
    minimum = float(config.get("minimum_detection_confidence") or 0.65)
    same_radius = float(config.get("same_location_radius_m") or 25)
    match_radius = float(config.get("known_asset_match_radius_m") or 75)
    output = []

    for index, feature in enumerate(batch.get("features") or []):
        geometry = feature.get("geometry") or {}
        centroid = geometry_centroid(geometry)
        props = feature.get("properties") or {}
        confidence = numeric(props.get("detection_confidence"))
        if centroid is None or confidence is None:
            continue
        lat, lon = centroid
        nearest, distance = nearest_asset(lat, lon, known_assets)
        matched = nearest if nearest is not None and distance is not None and distance <= match_radius else None

        if confidence < minimum:
            state = "low_confidence_quarantine"
            ctype = "new_supply"
            relation = "no_known_asset_within_match_radius" if not matched else "same_location_review"
        elif matched and distance is not None and distance <= same_radius:
            state = "matched_known_asset_review"
            ctype = "known_asset_match"
            relation = "same_location_review"
        elif matched:
            state = "possible_geometry_extension"
            ctype = "geometry_extension"
            relation = "possible_geometry_extension"
        else:
            state = "new_supply_candidate"
            ctype = "new_supply"
            relation = "no_known_asset_within_match_radius"

        seed = "|".join([
            "auto",
            source_key,
            str(batch.get("imagery_id") or ""),
            str(batch.get("imagery_acquisition_date") or ""),
            str(batch.get("model_version") or ""),
            str(index),
            f"{lat:.7f}",
            f"{lon:.7f}",
        ])
        estimated_capacity = props.get("estimated_capacity")
        if not isinstance(estimated_capacity, int):
            estimated_capacity = None

        output.append({
            "candidate_id": candidate_id(country, region, seed),
            "candidate_type": ctype,
            "candidate_state": state,
            "region": region,
            "name": props.get("name") or f"Detected parking candidate {index + 1}",
            "centroid": {"latitude": lat, "longitude": lon},
            "geometry": geometry,
            "estimated_capacity": estimated_capacity,
            "estimated_surface_area_m2": numeric(props.get("surface_area_m2")),
            "truth_state": "inferred",
            "recommendation_eligible": False,
            "access_state": "unknown",
            "public_access_verified": False,
            "match": {
                "parking_id": matched.get("parking_id") if matched else None,
                "distance_m": round(distance, 1) if distance is not None else None,
                "relation": relation,
            },
            "evidence": [{
                "evidence_type": "automated_imagery_detection",
                "source_key": source_key,
                "imagery_id": batch.get("imagery_id"),
                "imagery_acquisition_date": batch.get("imagery_acquisition_date"),
                "model_name": batch.get("model_name"),
                "model_version": batch.get("model_version"),
                "confidence": confidence,
                "detector_class": props.get("detector_class"),
            }],
            "verification_required": [
                "human_detection_review",
                "canonical_inventory_cross_check",
                "access_and_rules_evidence_before_recommendation",
            ],
            "created_at": created_at,
            "updated_at": created_at,
        })
    return output


def review_priority(candidate: Dict[str, Any]) -> int:
    state = candidate.get("candidate_state")
    confidence = numeric((candidate.get("evidence") or [{}])[0].get("confidence")) or 0
    base = {
        "new_supply_candidate": 100,
        "possible_geometry_extension": 85,
        "needs_geometry_verification": 75,
        "needs_field_verification": 70,
        "matched_known_asset_review": 50,
        "low_confidence_quarantine": 20,
    }.get(state, 40)
    return int(round(base + min(9, confidence * 9)))


def build_review_queue(candidates: List[Dict[str, Any]], generated_at: str) -> Dict[str, Any]:
    rows = []
    for candidate in candidates:
        rows.append({
            "candidate_id": candidate["candidate_id"],
            "candidate_state": candidate["candidate_state"],
            "candidate_type": candidate["candidate_type"],
            "region": candidate.get("region"),
            "name": candidate.get("name"),
            "priority": review_priority(candidate),
            "centroid": candidate.get("centroid"),
            "matched_parking_id": (candidate.get("match") or {}).get("parking_id"),
            "evidence_confidence": numeric((candidate.get("evidence") or [{}])[0].get("confidence")),
            "recommendation_eligible": False,
            "required_checks": candidate.get("verification_required") or [],
        })
    rows.sort(key=lambda item: (-item["priority"], item["candidate_id"]))
    return {
        "schema_version": "1.0",
        "generated_at": generated_at,
        "review_items": len(rows),
        "guardrail": "Review queue items are evidence candidates, not recommendable parking.",
        "items": rows,
    }


def build_report(
    config: Dict[str, Any],
    sources: Dict[str, Any],
    evidence: Dict[str, Any],
    known_assets: List[Dict[str, Any]],
    detection_batches: List[Dict[str, Any]],
    *,
    generated_at: str,
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    candidates = manual_candidates(evidence, config, known_assets, created_at=generated_at)
    automated_count = 0
    for batch in detection_batches:
        rows = automated_candidates(batch, config, sources, known_assets, created_at=generated_at)
        candidates.extend(rows)
        automated_count += len(rows)

    counts: Dict[str, int] = {}
    for candidate in candidates:
        state = str(candidate.get("candidate_state") or "unknown")
        counts[state] = counts.get(state, 0) + 1

    enabled_sources = [
        key for key, value in (sources.get("sources") or {}).items()
        if value.get("machine_ingestion_allowed") is True
    ]
    report = {
        "schema_version": "1.0",
        "generated_at": generated_at,
        "phase": "4",
        "status": "active_foundation",
        "pilot_region": config.get("pilot_region"),
        "known_assets_cross_matchable": len(known_assets),
        "candidate_count": len(candidates),
        "automated_detection_candidates": automated_count,
        "manual_imagery_followups": len(candidates) - automated_count,
        "candidate_states": dict(sorted(counts.items())),
        "automated_detection": {
            "adapter_ready": True,
            "enabled_source_keys": enabled_sources,
            "status": "enabled" if enabled_sources else "awaiting_explicitly_licensed_source",
        },
        "evaluation": {
            "precision_recall_status": "awaiting_labelled_cork_benchmark",
            "candidate_conversion_tracking": "enabled_by_candidate_id",
        },
        "guardrails": [
            "Imagery/detection evidence never establishes public or legal access.",
            "Candidates are recommendation_eligible=false until separately verified and promoted.",
            "Automated detection fails closed for unregistered or unapproved imagery sources.",
            "Estimated capacity never overwrites a source-verified capacity field.",
            "Historical imagery cannot be interpreted as live occupancy.",
        ],
        "candidates": candidates,
    }
    return report, build_review_queue(candidates, generated_at)


def write(path: Path, payload: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Build WHITEBLOCK Phase 4 parking-supply discovery artifacts.")
    parser.add_argument("--config", type=Path, default=Path("config/phase4_discovery.json"))
    parser.add_argument("--imagery-sources", type=Path, default=Path("config/phase4_imagery_sources.json"))
    parser.add_argument("--imagery-evidence", type=Path, default=Path("config/imagery_review_evidence.json"))
    parser.add_argument("--snapshot-dir", type=Path, default=Path("web/data"))
    parser.add_argument("--detections", type=Path, action="append", default=[])
    parser.add_argument("--output", type=Path, default=Path("web/data/parking_supply_discovery.json"))
    parser.add_argument("--review-output", type=Path, default=Path("web/data/parking_supply_review_queue.json"))
    args = parser.parse_args()

    config = load(args.config)
    sources = load(args.imagery_sources)
    evidence = load(args.imagery_evidence)
    known_assets = load_known_assets(args.snapshot_dir)
    batches = [load(path) for path in args.detections if path.exists()]
    generated_at = utc_now()
    report, review = build_report(config, sources, evidence, known_assets, batches, generated_at=generated_at)
    write(args.output, report)
    write(args.review_output, review)
    print(
        "WHITEBLOCK Phase 4 discovery:",
        report["candidate_count"], "candidates /",
        report["automated_detection_candidates"], "automated /",
        report["manual_imagery_followups"], "manual follow-ups /",
        report["automated_detection"]["status"],
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
