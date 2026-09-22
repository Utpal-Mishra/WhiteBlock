#!/usr/bin/env python3
"""Stable runner for the County Dublin parking snapshot.

The core Dublin model lives in ingest_dublin_county_parking.py. This runner uses
current public Overpass endpoints and a deliberately narrower parking-area query
so a dense Dublin City response does not time out while requesting unrelated
road-side parking tags. Regulated on-street parking remains covered by the
separate council evidence sources in the core snapshot.
"""

from __future__ import annotations

import ingest_dublin_county_parking as dublin

# Current public global instances documented by the OpenStreetMap Overpass wiki.
# Private.coffee is the successor/front-end for the former kumi.systems instance.
dublin.OVERPASS_ENDPOINTS = (
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.osm.jp/api/interpreter",
)


def parking_area_query(relation_id: int) -> str:
    """Retrieve parking areas plus settlement anchors inside one exact LA boundary.

    `amenity=parking` is intentionally the asset criterion for this county layer.
    Street regulations, meters and parking-tag zones are evidence sources and are
    not converted into car-park polygons without geometry proving that they are
    parking assets.
    """
    return f"""
[out:json][timeout:75];
rel({relation_id})->.boundary;
map_to_area.boundary->.searchArea;
(
  nwr["amenity"="parking"](area.searchArea);
  node["place"~"city|town|village|suburb|neighbourhood"](area.searchArea);
);
out meta center geom;
""".strip()


dublin.overpass_query = parking_area_query


if __name__ == "__main__":
    raise SystemExit(dublin.main())
