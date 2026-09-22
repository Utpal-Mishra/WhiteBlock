#!/usr/bin/env python3
"""Resilient runner for the existing County Kildare parking snapshot.

Preserves the Kildare evidence model while pinning the canonical traditional
County Kildare relation and using current public Overpass endpoints.
"""

from __future__ import annotations

import ingest_kildare_parking as base
import ingest_kildare_county_parking as kildare

KILDARE_TRADITIONAL_COUNTY_RELATION_ID = 285833

base.OVERPASS_ENDPOINTS = [
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.osm.jp/api/interpreter",
]


def exact_county_query(county_name: str = "Kildare") -> str:
    # county_name stays in the signature because the core fetcher uses it for
    # diagnostics, but geographic selection is pinned to the canonical relation.
    return f"""
[out:json][timeout:90];
rel({KILDARE_TRADITIONAL_COUNTY_RELATION_ID})->.boundary;
map_to_area.boundary->.searchArea;
(
  nwr["amenity"="parking"](area.searchArea);
  nwr["parking"~"street_side|lane"](area.searchArea);
);
out meta center geom;
""".strip()


kildare.overpass_query = exact_county_query


if __name__ == "__main__":
    raise SystemExit(kildare.main())
