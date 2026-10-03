#!/usr/bin/env python3
"""Resilient runner for the County Kildare parking snapshot.

The preferred query traverses the canonical traditional County Kildare relation
in one request. If a public Overpass endpoint times out, WHITEBLOCK falls back
to an exact-boundary tiled traversal: each small bbox is still intersected with
the same County Kildare area, so neighbouring-county leakage is not introduced.

Live occupancy is never fabricated.
"""

from __future__ import annotations

import json
import urllib.parse
from typing import Any, Dict, List, Tuple

import ingest_kildare_parking as base
import ingest_kildare_county_parking as kildare

KILDARE_TRADITIONAL_COUNTY_RELATION_ID = 285833
GRID_ROWS = 5
GRID_COLS = 5

base.OVERPASS_ENDPOINTS = [
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]


def exact_county_query(county_name: str = "Kildare") -> str:
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


def tiled_exact_query(south: float, west: float, north: float, east: float) -> str:
    bbox = f"{south:.7f},{west:.7f},{north:.7f},{east:.7f}"
    return f"""
[out:json][timeout:45];
rel({KILDARE_TRADITIONAL_COUNTY_RELATION_ID})->.boundary;
map_to_area.boundary->.searchArea;
(
  nwr["amenity"="parking"](area.searchArea)({bbox});
  nwr["parking"~"street_side|lane"](area.searchArea)({bbox});
);
out meta center geom;
""".strip()


def grid_cells() -> List[Tuple[float, float, float, float]]:
    bounds = base.KILDARE_BOUNDS
    south = float(bounds["south"])
    west = float(bounds["west"])
    north = float(bounds["north"])
    east = float(bounds["east"])
    lat_step = (north - south) / GRID_ROWS
    lon_step = (east - west) / GRID_COLS
    cells = []
    for row in range(GRID_ROWS):
        cell_s = south + row * lat_step
        cell_n = north if row == GRID_ROWS - 1 else south + (row + 1) * lat_step
        for col in range(GRID_COLS):
            cell_w = west + col * lon_step
            cell_e = east if col == GRID_COLS - 1 else west + (col + 1) * lon_step
            cells.append((cell_s, cell_w, cell_n, cell_e))
    return cells


def post_query(query: str, timeout: int) -> Tuple[Dict[str, Any], str]:
    encoded = urllib.parse.urlencode({"data": query}).encode("utf-8")
    errors: List[str] = []
    for endpoint in base.OVERPASS_ENDPOINTS:
        try:
            payload = base.fetch_json(endpoint, data=encoded, timeout=timeout)
            if payload.get("elements") is not None:
                return payload, endpoint
            errors.append(f"{endpoint}: response has no elements collection")
        except Exception as exc:
            errors.append(f"{endpoint}: {exc}")
    raise RuntimeError(" | ".join(errors[-len(base.OVERPASS_ENDPOINTS):]))


def resilient_fetch_overpass():
    try:
        payload, endpoint = post_query(exact_county_query(), 95)
        if payload.get("elements"):
            return payload, endpoint, "exact_county_boundary"
    except Exception as exc:
        whole_error = str(exc)
    else:
        whole_error = "whole-county query returned no parking"

    elements: Dict[Tuple[str, Any], Dict[str, Any]] = {}
    endpoints_used = set()
    failed_cells = []
    for index, (south, west, north, east) in enumerate(grid_cells(), start=1):
        try:
            payload, endpoint = post_query(tiled_exact_query(south, west, north, east), 55)
            endpoints_used.add(endpoint)
            for element in payload.get("elements", []):
                key = (str(element.get("type")), element.get("id"))
                elements[key] = element
        except Exception as exc:
            failed_cells.append({"cell": index, "error": str(exc)})

    if failed_cells:
        raise RuntimeError(
            "Kildare exact-boundary tiled traversal incomplete; "
            f"{len(failed_cells)}/{GRID_ROWS * GRID_COLS} cells failed. "
            f"Whole-query failure: {whole_error}. "
            f"First tile failure: {failed_cells[0]['error']}"
        )
    if not elements:
        raise RuntimeError(
            "Kildare exact-boundary tiled traversal returned no parking. "
            f"Whole-query failure: {whole_error}"
        )

    return (
        {"elements": list(elements.values())},
        "grid:" + ",".join(sorted(endpoints_used)),
        "exact_county_boundary_tiled",
    )


def osm_locations(now):
    payload, endpoint, query_mode = resilient_fetch_overpass()
    seen = set()
    output = []
    for element in payload.get("elements", []):
        key = (element.get("type"), element.get("id"))
        if key in seen:
            continue
        seen.add(key)
        record = base.osm_location(element, now)
        if record is not None:
            output.append(record)
    return output, {
        "count": len(output),
        "status": "ok",
        "query_mode": query_mode,
        "relation_id": base.KILDARE_OSM_RELATION_ID,
        "matched_area_name": "Kildare",
        "admin_level": 6,
        "endpoint": endpoint,
        "license": "ODbL",
        "partition": {
            "rows": GRID_ROWS,
            "columns": GRID_COLS,
            "used": query_mode == "exact_county_boundary_tiled",
        },
    }


kildare.overpass_query = exact_county_query
kildare.osm_locations = osm_locations


if __name__ == "__main__":
    raise SystemExit(kildare.main())
