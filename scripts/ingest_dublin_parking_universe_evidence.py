#!/usr/bin/env python3
"""Fetch official Dublin Phase 1.5 parking-universe evidence.

This ingestion intentionally keeps evidence anchors separate from canonical
recommendable parking:
- accessible bays are real source-reported parking spaces, but require the
  appropriate parking-card entitlement and can move/change;
- parking meters indicate controlled on-street parking context, but one meter
  is not one canonical parking asset or bay.

The output is therefore an evidence/candidate sidecar. Reconciliation and
access/rule verification can promote records later without weakening the
driver recommendation boundary.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, Sequence


DCC_ACCESSIBLE_GEOJSON = (
    "https://data.smartdublin.ie/dataset/4e9df410-cd4d-40bd-851f-9b38a7d48070/"
    "resource/efb5d349-8640-42f5-8496-d29cc718ed6d/download/"
    "disabled-parking-bays-gen-2021-wgs84.geojson"
)
DCC_METERS_CSV = (
    "https://data.smartdublin.ie/dataset/58969481-417e-4f5a-b8ea-18b56419d0ed/"
    "resource/4fef8cc9-5233-42f5-9670-0fea23639317/download/"
    "dublin_terminals_coordinates_19062025.csv"
)
USER_AGENT = "WHITEBLOCK/1.0 parking-universe-evidence"


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def fetch_bytes(url: str, timeout: int = 40) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read()


def normalized_key(value: Any) -> str:
    return " ".join(str(value or "").strip().lower().split())


def first_property(properties: Mapping[str, Any], keys: Sequence[str]) -> Any:
    lowered = {normalized_key(key).replace(" ", "_"): value for key, value in properties.items()}
    for key in keys:
        value = lowered.get(normalized_key(key).replace(" ", "_"))
        if value not in (None, ""):
            return value
    return None


def evidence_id(prefix: str, parts: Iterable[Any]) -> str:
    payload = "|".join(normalized_key(part) for part in parts)
    digest = hashlib.sha1(payload.encode("utf-8")).hexdigest()[:12].upper()
    return f"WB-EVID-IE-DUB-{prefix}-{digest}"


def valid_coordinates(lat: Any, lng: Any) -> tuple[float, float] | None:
    try:
        latitude = float(lat)
        longitude = float(lng)
    except (TypeError, ValueError):
        return None
    if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        return None
    return latitude, longitude


def accessible_records(payload: Mapping[str, Any]) -> List[Dict[str, Any]]:
    output: List[Dict[str, Any]] = []
    for feature in payload.get("features") or []:
        if not isinstance(feature, dict):
            continue
        geometry = feature.get("geometry") or {}
        coordinates = geometry.get("coordinates") if isinstance(geometry, dict) else None
        if not isinstance(coordinates, list) or len(coordinates) < 2:
            continue
        point = valid_coordinates(coordinates[1], coordinates[0])
        if point is None:
            continue
        lat, lng = point
        properties = feature.get("properties") or {}
        if not isinstance(properties, dict):
            properties = {}

        street = first_property(properties, ("street_name", "street name", "street", "road"))
        location = first_property(properties, ("location", "description", "address"))
        side = first_property(properties, ("side_of_road", "side of road"))
        label = ", ".join(str(value).strip() for value in (location, street) if value not in (None, ""))
        if not label:
            label = "Dublin accessible parking bay"

        output.append({
            "evidence_id": evidence_id("ACCESS", (street, location, side, lat, lng)),
            "region": "Dublin",
            "local_authority": "Dublin City Council",
            "name": label,
            "latitude": lat,
            "longitude": lng,
            "evidence_class": "accessible_parking_space",
            "asset_class": "accessible",
            "physical_parking_reported": True,
            "represents_exact_parking_space": True,
            "access_type": "disabled_parking_card",
            "recommendation_eligible": False,
            "recommendation_exclusion_reason": (
                "Accessible-space evidence is retained in the parking universe, "
                "but normal recommendation requires entitlement/access handling."
            ),
            "source_key": "dublin_city_accessible_parking",
            "source_publisher": "Dublin City Council",
            "source_url": DCC_ACCESSIBLE_GEOJSON,
            "source_licence": "CC BY 4.0",
            "source_data_period": "2021",
            "source_freshness_note": (
                "Living dataset; locations may be suspended or relocated due to "
                "road works, development projects or events."
            ),
            "street_name": street,
            "location_description": location,
            "side_of_road": side,
            "raw_properties": properties,
        })
    return output


def meter_records(text: str) -> List[Dict[str, Any]]:
    output: List[Dict[str, Any]] = []
    reader = csv.DictReader(io.StringIO(text.lstrip("\ufeff")))
    for row in reader:
        if not isinstance(row, dict):
            continue
        normal = {normalized_key(key).replace(" ", "_"): value for key, value in row.items()}
        terminal = normal.get("terminal_code") or normal.get("terminal")
        zone = normal.get("zone_desc") or normal.get("zone")
        address = normal.get("address") or normal.get("location")
        point = valid_coordinates(normal.get("latitude"), normal.get("longitude"))
        if point is None:
            continue
        lat, lng = point
        label = str(address or f"Dublin parking meter {terminal or ''}").strip()

        output.append({
            "evidence_id": evidence_id("METER", (terminal, address, lat, lng)),
            "region": "Dublin",
            "local_authority": "Dublin City Council",
            "name": label,
            "latitude": lat,
            "longitude": lng,
            "evidence_class": "on_street_parking_meter_anchor",
            "asset_class": "on_street",
            "physical_parking_reported": None,
            "represents_exact_parking_space": False,
            "access_type": "unknown",
            "recommendation_eligible": False,
            "recommendation_exclusion_reason": (
                "A parking meter is evidence of a controlled-parking context, "
                "not a one-to-one parking bay or canonical parking asset."
            ),
            "source_key": "dublin_city_parking_meters",
            "source_publisher": "Dublin City Council",
            "source_url": DCC_METERS_CSV,
            "source_licence": "CC BY 4.0",
            "source_data_updated": "2025-06-20",
            "terminal_code": terminal,
            "zone_description": zone,
            "address": address,
            "raw_properties": row,
        })
    return output


def dedupe(records: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen = set()
    output = []
    for record in records:
        key = record.get("evidence_id")
        if not key or key in seen:
            continue
        seen.add(key)
        output.append(record)
    return output


def build(accessible_payload: Mapping[str, Any], meters_text: str) -> Dict[str, Any]:
    accessible = accessible_records(accessible_payload)
    meters = meter_records(meters_text)
    records = dedupe([*accessible, *meters])
    return {
        "schema_version": 1,
        "generated_at": utc_now(),
        "region": "Dublin",
        "purpose": "phase_1_5_parking_universe_evidence_not_driver_inventory",
        "recommendation_policy": "all_records_excluded_until_reconciled_and_access_rules_allow",
        "sources": {
            "dublin_city_accessible_parking": {
                "publisher": "Dublin City Council",
                "licence": "CC BY 4.0",
                "url": DCC_ACCESSIBLE_GEOJSON,
                "count": len(accessible),
                "semantics": "source-reported accessible parking spaces; entitlement required",
            },
            "dublin_city_parking_meters": {
                "publisher": "Dublin City Council",
                "licence": "CC BY 4.0",
                "url": DCC_METERS_CSV,
                "count": len(meters),
                "semantics": "controlled-parking evidence anchors; not one meter = one bay",
            },
        },
        "summary": {
            "evidence_records": len(records),
            "accessible_parking_spaces": len(accessible),
            "parking_meter_anchors": len(meters),
            "recommendation_eligible": 0,
        },
        "records": records,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build official Dublin Phase 1.5 parking-universe evidence.")
    parser.add_argument("--output", type=Path, default=Path("web/data/dublin_parking_universe_evidence.json"))
    parser.add_argument("--accessible-file", type=Path)
    parser.add_argument("--meters-file", type=Path)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.accessible_file:
        accessible_payload = json.loads(args.accessible_file.read_text(encoding="utf-8"))
    else:
        accessible_payload = json.loads(fetch_bytes(DCC_ACCESSIBLE_GEOJSON).decode("utf-8-sig"))

    if args.meters_file:
        meters_text = args.meters_file.read_text(encoding="utf-8-sig")
    else:
        meters_text = fetch_bytes(DCC_METERS_CSV).decode("utf-8-sig")

    payload = build(accessible_payload, meters_text)
    if not payload["records"]:
        raise SystemExit("Official Dublin universe evidence produced no valid records")
    if payload["summary"]["accessible_parking_spaces"] <= 0:
        raise SystemExit("Dublin accessible parking source produced no valid coordinates")
    if payload["summary"]["parking_meter_anchors"] <= 0:
        raise SystemExit("Dublin parking-meter source produced no valid coordinates")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "output": str(args.output),
        **payload["summary"],
    }))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
