from __future__ import annotations

import os
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Iterator, Optional

import psycopg
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from psycopg.rows import dict_row
from pydantic import BaseModel, Field


APP_VERSION = "0.1.0"
DEFAULT_CORS_ORIGINS = [
    "https://utpal-mishra.github.io",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]


def _cors_origins() -> list[str]:
    configured = os.getenv("WHITEBLOCK_CORS_ORIGINS", "").strip()
    if not configured:
        return DEFAULT_CORS_ORIGINS
    return [origin.strip().rstrip("/") for origin in configured.split(",") if origin.strip()]


app = FastAPI(
    title="WHITEBLOCK API",
    version=APP_VERSION,
    description="Read-only spatial parking intelligence API backed by the WHITEBLOCK PostGIS core.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)


@contextmanager
def db_connection() -> Iterator[psycopg.Connection[Any]]:
    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        raise RuntimeError("DATABASE_URL is not configured")
    with psycopg.connect(database_url, row_factory=dict_row) as connection:
        yield connection


class ConfidenceBasis(BaseModel):
    source: float = Field(ge=0, le=1)
    freshness: float = Field(ge=0, le=1)
    completeness: float = Field(ge=0, le=1)


class Confidence(BaseModel):
    score: float = Field(ge=0, le=1)
    basis: ConfidenceBasis


class ParkingResult(BaseModel):
    parking_id: str
    name: str
    latitude: float
    longitude: float
    distance_m: float
    parking_type: str
    access_type: str
    lifecycle_status: str
    capacity: Optional[int] = None
    available_spaces: Optional[int] = None
    occupied_spaces: Optional[int] = None
    occupancy_ratio: Optional[float] = None
    observed_at: Optional[datetime] = None
    retrieved_at: Optional[datetime] = None
    truth_state: str
    confidence: Confidence
    pricing_raw: Optional[str] = None
    opening_hours_raw: Optional[str] = None
    height_restriction_raw: Optional[str] = None
    accessible_spaces: Optional[int] = None
    ev_spaces: Optional[int] = None
    source_key: Optional[str] = None
    evidence_count: int = 0


class NearbyResponse(BaseModel):
    schema_version: str = "1.0"
    generated_at: datetime
    origin: dict[str, float]
    radius_km: float
    count: int
    source_mode: str = "postgis"
    locations: list[ParkingResult]


class EvidenceRecord(BaseModel):
    evidence_id: int
    field_name: Optional[str] = None
    source_type: str
    source_key: str
    source_url: Optional[str] = None
    source_timestamp: Optional[datetime] = None
    retrieved_at: Optional[datetime] = None
    truth_state: str
    confidence: Optional[float] = None
    evidence_payload: dict[str, Any]


class EvidenceResponse(BaseModel):
    parking_id: str
    count: int
    evidence: list[EvidenceRecord]


def _as_utc(value: Optional[datetime]) -> Optional[datetime]:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def freshness_score(observed_at: Optional[datetime], now: datetime) -> float:
    observed = _as_utc(observed_at)
    if observed is None:
        return 0.50
    age_minutes = max(0.0, (now - observed).total_seconds() / 60.0)
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


def completeness_score(row: dict[str, Any]) -> float:
    checks = [
        row.get("capacity") is not None,
        bool(row.get("opening_hours_raw")),
        bool(row.get("pricing_raw")),
        bool(row.get("height_restriction_raw")),
        row.get("access_type") not in (None, "unknown"),
    ]
    return sum(1 for check in checks if check) / len(checks)


def composite_confidence(row: dict[str, Any], now: datetime) -> Confidence:
    source_values = [
        float(value)
        for value in (row.get("observation_confidence"), row.get("evidence_confidence"))
        if value is not None
    ]
    source = sum(source_values) / len(source_values) if source_values else 0.70
    freshness = freshness_score(row.get("observed_at"), now)
    completeness = completeness_score(row)
    score = max(0.0, min(1.0, 0.55 * source + 0.30 * freshness + 0.15 * completeness))
    return Confidence(
        score=round(score, 3),
        basis=ConfidenceBasis(
            source=round(source, 3),
            freshness=round(freshness, 3),
            completeness=round(completeness, 3),
        ),
    )


def row_to_parking_result(row: dict[str, Any], now: datetime) -> ParkingResult:
    occupancy_ratio = row.get("occupancy_ratio")
    return ParkingResult(
        parking_id=row["parking_id"],
        name=row["name"],
        latitude=float(row["latitude"]),
        longitude=float(row["longitude"]),
        distance_m=round(float(row["distance_m"]), 1),
        parking_type=row.get("parking_type") or "unknown",
        access_type=row.get("access_type") or "unknown",
        lifecycle_status=row.get("lifecycle_status") or "verified",
        capacity=row.get("capacity"),
        available_spaces=row.get("available_spaces"),
        occupied_spaces=row.get("occupied_spaces"),
        occupancy_ratio=float(occupancy_ratio) if occupancy_ratio is not None else None,
        observed_at=row.get("observed_at"),
        retrieved_at=row.get("retrieved_at"),
        truth_state=row.get("truth_state") or "observed",
        confidence=composite_confidence(row, now),
        pricing_raw=row.get("pricing_raw"),
        opening_hours_raw=row.get("opening_hours_raw"),
        height_restriction_raw=row.get("height_restriction_raw"),
        accessible_spaces=row.get("accessible_spaces"),
        ev_spaces=row.get("ev_spaces"),
        source_key=row.get("source_key"),
        evidence_count=int(row.get("evidence_count") or 0),
    )


NEARBY_SQL = """
WITH origin AS (
  SELECT ST_SetSRID(ST_MakePoint(%(lng)s, %(lat)s), 4326)::geography AS geog
)
SELECT
  p.parking_id,
  p.name,
  ST_Y(p.geom)::double precision AS latitude,
  ST_X(p.geom)::double precision AS longitude,
  p.parking_type,
  p.access_type,
  p.lifecycle_status,
  COALESCE(o.capacity_at_observation, p.capacity_verified, p.capacity_estimated) AS capacity,
  o.available_spaces,
  o.occupied_spaces,
  o.occupancy_ratio,
  o.observed_at,
  o.retrieved_at,
  o.truth_state,
  o.confidence::double precision AS observation_confidence,
  o.source_key,
  p.pricing_raw,
  p.opening_hours_raw,
  p.height_restriction_raw,
  p.accessible_spaces,
  p.ev_spaces,
  ST_Distance(p.geom::geography, origin.geog)::double precision AS distance_m,
  ev.evidence_confidence,
  ev.evidence_count
FROM parking_location p
CROSS JOIN origin
LEFT JOIN latest_parking_observation o ON o.parking_id = p.parking_id
LEFT JOIN LATERAL (
  SELECT
    AVG(e.confidence)::double precision AS evidence_confidence,
    COUNT(*)::integer AS evidence_count
  FROM parking_evidence e
  WHERE e.parking_id = p.parking_id
) ev ON TRUE
WHERE p.lifecycle_status IN ('verified', 'published')
  AND (%(include_restricted)s OR p.access_type IN ('public', 'unknown'))
  AND ST_DWithin(p.geom::geography, origin.geog, %(radius_m)s)
ORDER BY distance_m ASC, p.parking_id ASC
LIMIT %(limit)s
"""


@app.get("/health")
def health() -> dict[str, Any]:
    database_configured = bool(os.getenv("DATABASE_URL", "").strip())
    database_ok = False
    if database_configured:
        try:
            with db_connection() as connection:
                with connection.cursor() as cursor:
                    cursor.execute("SELECT 1 AS ok")
                    database_ok = cursor.fetchone()["ok"] == 1
        except Exception:
            database_ok = False

    return {
        "status": "ok" if database_ok else "degraded",
        "version": APP_VERSION,
        "database_configured": database_configured,
        "database_ok": database_ok,
    }


@app.get("/v1/parking/nearby", response_model=NearbyResponse)
def nearby_parking(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(5.0, ge=0.1, le=25.0),
    limit: int = Query(8, ge=1, le=50),
    include_restricted: bool = Query(False),
) -> NearbyResponse:
    now = datetime.now(timezone.utc)
    params = {
        "lat": lat,
        "lng": lng,
        "radius_m": radius_km * 1000.0,
        "limit": limit,
        "include_restricted": include_restricted,
    }

    try:
        with db_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(NEARBY_SQL, params)
                rows = cursor.fetchall()
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except psycopg.Error as exc:
        raise HTTPException(status_code=503, detail="Parking database is temporarily unavailable") from exc

    locations = [row_to_parking_result(dict(row), now) for row in rows]
    return NearbyResponse(
        generated_at=now,
        origin={"latitude": lat, "longitude": lng},
        radius_km=radius_km,
        count=len(locations),
        locations=locations,
    )


@app.get("/v1/parking/{parking_id}/evidence", response_model=EvidenceResponse)
def parking_evidence(parking_id: str) -> EvidenceResponse:
    sql = """
    SELECT
      evidence_id,
      field_name,
      source_type,
      source_key,
      source_url,
      source_timestamp,
      retrieved_at,
      truth_state,
      confidence::double precision AS confidence,
      evidence_payload
    FROM parking_evidence
    WHERE parking_id = %(parking_id)s
    ORDER BY COALESCE(source_timestamp, retrieved_at, created_at) DESC, evidence_id DESC
    """

    try:
        with db_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1 FROM parking_location WHERE parking_id = %s", (parking_id,))
                if cursor.fetchone() is None:
                    raise HTTPException(status_code=404, detail="Parking asset not found")
                cursor.execute(sql, {"parking_id": parking_id})
                rows = cursor.fetchall()
    except HTTPException:
        raise
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except psycopg.Error as exc:
        raise HTTPException(status_code=503, detail="Parking database is temporarily unavailable") from exc

    evidence = [EvidenceRecord(**dict(row)) for row in rows]
    return EvidenceResponse(parking_id=parking_id, count=len(evidence), evidence=evidence)
