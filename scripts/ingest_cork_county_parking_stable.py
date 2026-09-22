#!/usr/bin/env python3
"""Resilient runner for the existing County Cork parking snapshot.

This wrapper preserves the County Cork evidence model while replacing brittle
Overpass discovery configuration with the canonical traditional County Cork
relation and current public Overpass instances. It exists so upstream Cork
inventory failures cannot prevent independent County Dublin validation.
"""

from __future__ import annotations

import ingest_cork_county_parking as cork

CORK_TRADITIONAL_COUNTY_RELATION_ID = 332631

cork.OVERPASS_ENDPOINTS = [
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.osm.jp/api/interpreter",
]


def exact_county_query(county_name: str = "Cork") -> str:
    # county_name is retained for compatibility with the core fetch loop. The
    # actual geographic authority is the canonical relation id, avoiding name
    # lookup ambiguity and keeping the query inside the traditional county.
    return f"""
[out:json][timeout:90];
rel({CORK_TRADITIONAL_COUNTY_RELATION_ID})->.boundary;
map_to_area.boundary->.searchArea;
(
  nwr["amenity"="parking"](area.searchArea);
  nwr["parking"~"street_side|lane"](area.searchArea);
);
out meta center geom;
""".strip()


cork.overpass_query = exact_county_query


if __name__ == "__main__":
    raise SystemExit(cork.main())
