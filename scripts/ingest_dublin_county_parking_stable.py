#!/usr/bin/env python3
"""Stable runner for the County Dublin parking snapshot.

The core Dublin model lives in ingest_dublin_county_parking.py. This runner uses
current public Overpass endpoints and a deliberately narrower parking-area query
so a dense Dublin City response does not time out while requesting unrelated
road-side parking tags. Regulated on-street parking remains covered by the
separate council evidence sources in the core snapshot.

The stable runner also preserves the named city/town/village/suburb/
neighbourhood anchors returned in the exact-boundary traversal. Publishing those
anchors makes the settlement audit and browser search use the same geographic
evidence as the parking snapshot instead of issuing a second, potentially
different place query.
"""

from __future__ import annotations

from collections import Counter
from typing import Any, Dict, List

import ingest_dublin_county_parking as dublin

# Current public global instances listed by the OpenStreetMap Overpass wiki.
dublin.OVERPASS_ENDPOINTS = (
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
)

# Smart Dublin's DLR dataset catalogue page was refreshed in 2025, but the
# downloadable Parking Tag CSV reports its actual data/resource last-update as
# 2021-04-15. Confidence/freshness must follow the resource data, not catalogue
# metadata.
for source in dublin.OFFICIAL_EVIDENCE_SOURCES:
    if source.get("key") == "dlr_parking_tag_information":
        source["published_freshness"] = "2021-04-15"
        source["catalogue_metadata_last_updated"] = "2025-06-19"


def parking_area_query(relation_id: int) -> str:
    """Retrieve parking areas plus settlement anchors inside one exact LA boundary.

    `amenity=parking` is intentionally the asset criterion for this county layer.
    Street regulations, meters and parking-tag zones are evidence sources and are
    not converted into car-park polygons without geometry proving that they are
    parking assets.
    """
    return f"""
[out:json][timeout:90];
rel({relation_id});
map_to_area -> .searchArea;
(
  nwr["amenity"="parking"](area.searchArea);
  node["place"~"city|town|village|suburb|neighbourhood"](area.searchArea);
);
out meta geom;
""".strip()


dublin.overpass_query = parking_area_query

# Capture the exact place anchors already returned while building each authority.
# This avoids a second place-only fetch for the normal deployment path and keeps
# parking assignment, settlement audit and browser search aligned to one traversal.
_original_authority_inventory = dublin.authority_inventory
_original_build_snapshot = dublin.build_snapshot
_collected_anchors: Dict[str, List[Dict[str, Any]]] = {}


def authority_inventory_with_anchor_capture(authority: Dict[str, Any], now):
    records, anchors, meta = _original_authority_inventory(authority, now)
    _collected_anchors[authority["name"]] = [dict(anchor) for anchor in anchors]
    return records, anchors, meta


def build_snapshot_with_settlement_anchors() -> Dict[str, Any]:
    _collected_anchors.clear()
    snapshot = _original_build_snapshot()

    anchors: List[Dict[str, Any]] = []
    seen = set()
    for authority in dublin.LOCAL_AUTHORITIES:
        for anchor in _collected_anchors.get(authority["name"], []):
            key = (authority["name"], anchor.get("osm_id"), anchor.get("name"), anchor.get("place_type"))
            if key in seen:
                continue
            seen.add(key)
            anchors.append(
                {
                    "name": anchor.get("name"),
                    "place_type": anchor.get("place_type"),
                    "latitude": anchor.get("lat"),
                    "longitude": anchor.get("lng"),
                    "local_authority": authority["name"],
                    "local_authority_relation_id": authority["relation_id"],
                    "osm_id": anchor.get("osm_id"),
                    "truth_state": "observed",
                    "source_key": f"openstreetmap_{authority['key']}_place_anchor",
                }
            )

    anchors.sort(
        key=lambda item: (
            str(item.get("local_authority") or ""),
            str(item.get("place_type") or ""),
            str(item.get("name") or "").casefold(),
            int(item.get("osm_id") or 0),
        )
    )
    type_counts = Counter(str(item.get("place_type") or "unknown") for item in anchors)

    snapshot["schema_version"] = "1.3"
    snapshot["settlement_anchors"] = anchors
    snapshot.setdefault("summary", {})["settlement_anchor_records"] = len(anchors)
    snapshot["summary"]["settlement_anchor_types"] = dict(sorted(type_counts.items()))
    snapshot.setdefault("coverage", {})["settlement_anchor_source"] = "same_exact_boundary_osm_traversal_as_parking_inventory"
    return snapshot


dublin.authority_inventory = authority_inventory_with_anchor_capture
dublin.build_snapshot = build_snapshot_with_settlement_anchors


if __name__ == "__main__":
    raise SystemExit(dublin.main())