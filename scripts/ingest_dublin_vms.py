#!/usr/bin/env python3
"""Ingest the official Dublin City Council VMS location registry into PostGIS.

This source describes sign locations only. It does not expose live messages or parking
counts. WHITEBLOCK therefore persists these records as guidance-display assets without
creating parking_guidance_reading rows.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from urllib.request import Request, urlopen

from db_common import connect

SOURCE_KEY = "dublin_vms_locations"
SOURCE_URL = (
    "https://data.smartdublin.ie/dataset/79851619-f51d-4799-99b3-6e5d20d26aa3/"
    "resource/ad0ca283-8780-42b3-959e-f92a13d564a9/download/"
    "dcc_variable_message_signs_4326.geojson"
)
DATASET_URL = "https://data.gov.ie/dataset/dublin-city-council-variable-message-signs"


def _normalise_properties(properties: dict) -> dict:
    return {str(key).strip().lower().replace(" ", "_"): value for key, value in properties.items()}


def _first(properties: dict, *keys: str):
    for key in keys:
        value = properties.get(key)
        if value not in (None, ""):
            return value
    return None


def feature_to_display(feature: dict, ordinal: int) -> dict:
    geometry = feature.get("geometry") or {}
    coordinates = geometry.get("coordinates") or []
    if geometry.get("type") != "Point" or len(coordinates) < 2:
        raise ValueError("VMS feature must contain Point geometry")

    longitude, latitude = float(coordinates[0]), float(coordinates[1])
    properties = _normalise_properties(feature.get("properties") or {})

    external_id = _first(
        properties,
        "equipment_id",
        "equipmentid",
        "equip_id",
        "equipid",
        "vms_id",
        "objectid",
        "id",
    )
    if external_id is None:
        external_id = str(ordinal)
    external_id = str(external_id).strip()

    name = _first(
        properties,
        "location_name",
        "locationname",
        "location",
        "name",
        "road_name",
        "road",
    ) or f"Dublin VMS {external_id}"

    road_name = _first(properties, "road_name", "road", "street", "location_name", "location")
    direction = _first(properties, "direction_of_travel", "direction", "travel_direction")

    return {
        "display_id": f"WB-VMS-IE-DUB-{external_id}",
        "external_id": external_id,
        "name": str(name).strip(),
        "latitude": latitude,
        "longitude": longitude,
        "road_name": None if road_name is None else str(road_name).strip(),
        "direction_of_travel": None if direction is None else str(direction).strip(),
        "attributes": feature.get("properties") or {},
    }


def parse_geojson(payload: dict) -> list[dict]:
    if payload.get("type") != "FeatureCollection":
        raise ValueError("Expected GeoJSON FeatureCollection")

    displays = []
    for ordinal, feature in enumerate(payload.get("features") or [], start=1):
        try:
            displays.append(feature_to_display(feature, ordinal))
        except (TypeError, ValueError, KeyError):
            continue
    return displays


def load_payload(input_path: Path | None) -> dict:
    if input_path:
        return json.loads(input_path.read_text(encoding="utf-8"))

    request = Request(SOURCE_URL, headers={"User-Agent": "WHITEBLOCK/0.1 parking-guidance-ingestion"})
    with urlopen(request, timeout=30) as response:  # noqa: S310 - fixed official HTTPS URL
        return json.load(response)


def upsert_displays(displays: list[dict]) -> int:
    sql = """
        INSERT INTO parking_guidance_display (
          display_id, source_key, external_id, name, geom, road_name,
          direction_of_travel, operator_name, sign_type, lifecycle_status,
          source_url, retrieved_at, last_verified_at, attributes
        )
        VALUES (
          %(display_id)s, %(source_key)s, %(external_id)s, %(name)s,
          ST_SetSRID(ST_MakePoint(%(longitude)s, %(latitude)s), 4326),
          %(road_name)s, %(direction_of_travel)s, 'Dublin City Council',
          'vms', 'verified', %(source_url)s, now(), now(), %(attributes)s::jsonb
        )
        ON CONFLICT (display_id) DO UPDATE SET
          external_id = EXCLUDED.external_id,
          name = EXCLUDED.name,
          geom = EXCLUDED.geom,
          road_name = EXCLUDED.road_name,
          direction_of_travel = EXCLUDED.direction_of_travel,
          operator_name = EXCLUDED.operator_name,
          source_url = EXCLUDED.source_url,
          retrieved_at = EXCLUDED.retrieved_at,
          last_verified_at = EXCLUDED.last_verified_at,
          attributes = EXCLUDED.attributes,
          lifecycle_status = 'verified'
    """

    with connect() as connection:
        with connection.cursor() as cursor:
            for display in displays:
                cursor.execute(
                    sql,
                    {
                        **display,
                        "source_key": SOURCE_KEY,
                        "source_url": DATASET_URL,
                        "attributes": json.dumps(display["attributes"], ensure_ascii=False),
                    },
                )
        connection.commit()
    return len(displays)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, help="Optional local GeoJSON file for repeatable/offline ingestion")
    parser.add_argument("--dry-run", action="store_true", help="Parse and validate without writing to PostGIS")
    args = parser.parse_args()

    payload = load_payload(args.input)
    displays = parse_geojson(payload)
    if not displays:
        raise RuntimeError("No valid VMS Point features were found")

    if args.dry_run:
        print(json.dumps({"source": SOURCE_KEY, "valid_displays": len(displays), "sample": displays[:2]}, indent=2))
        return 0

    count = upsert_displays(displays)
    print(f"Upserted {count} Dublin VMS display locations into parking_guidance_display")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
