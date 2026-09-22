# County Dublin Parking Network

Status: implementation baseline added 2026-09-22.

## Coverage definition

WHITEBLOCK uses **County Dublin / Dublin Region** as the geographic scope for this layer. The inventory is traversed through the four present-day local-authority boundaries rather than a rectangular bounding box:

| Local authority | OSM relation | Boundary role |
| --- | ---: | --- |
| Dublin City | 1109531 | exact admin-level-7 traversal |
| Fingal | 1114164 | exact admin-level-7 traversal |
| Dún Laoghaire–Rathdown | 1115720 | exact admin-level-7 traversal |
| South Dublin | 1117469 | exact admin-level-7 traversal |

Traditional County Dublin / Dublin Region boundary provenance: **OSM relation 282800**.

This provides complete **boundary traversal** of the four Dublin authorities. It does **not** mean every physical, privately controlled, temporarily available, informal or newly constructed parking space is necessarily represented in the source data.

## Geography hierarchy

The ingestion deliberately supports the requested hierarchy from city/town to suburb/village rather than storing all Dublin assets under one generic label.

For each mapped parking asset WHITEBLOCK records:

- `local_authority`
- `settlement`
- `settlement_type` (`city`, `town`, `village`, `suburb`, `neighbourhood` where evidenced)
- `settlement_assignment_method`
- `settlement_anchor_distance_km` when a nearby OSM place anchor was used

Assignment precedence:

1. explicit OSM address/place tags on the parking feature;
2. nearest named OSM city/town/village/suburb/neighbourhood within a conservative type-specific distance;
3. local-authority fallback when a defensible settlement cannot be assigned.

A fallback is intentionally visible in the data. WHITEBLOCK does not invent a suburb or village label simply to make coverage appear complete.

## Parking inventory source

The base county-wide inventory is OpenStreetMap parking geometry queried inside each exact local-authority relation. It includes:

- `amenity=parking`
- mapped `parking=street_side`
- mapped `parking=lane`

For ways, observed OSM geometry is retained as polygon geometry where possible. Relations are not collapsed into fabricated polygons.

OpenStreetMap inventory is licensed under ODbL.

## Official Dublin evidence layer

Council datasets are probed separately and retained as regulatory/evidence sources. A parking meter or sign is **not automatically promoted into a parking-area asset** merely because it exists in an official dataset.

Current evidence sources configured at implementation time:

| Authority | Evidence source | Source freshness recorded | WHITEBLOCK use |
| --- | --- | --- | --- |
| Dublin City Council | Parking meter locations | 2025-06-20 | regulation / meter evidence |
| Fingal County Council | Parking Meters FCC | 2026-07-30 | tariff, hours, max-stay and regulation evidence |
| South Dublin County Council | Parking Meters SDCC | 2026-05-18 | regulation / meter evidence |
| Dún Laoghaire–Rathdown County Council | Parking Tag Information | 2025-06-19 | tariff, restrictions and hours evidence |

Additional official datasets such as Dublin City multistorey availability, accessible parking and older DLR parking-run geometry can be reconciled into the evidence model without overwriting fresher or more precise facts.

## Precision rules

WHITEBLOCK follows these rules for Dublin:

1. **Mapped parking is not automatically public parking.** `access=private`, `customers`, `permit`, etc. are retained; missing access stays `unknown`.
2. **No fabricated live availability.** The county network snapshot uses `available_spaces: null` unless a separate observation source actually reports availability.
3. **No fabricated capacity.** Capacity is populated only when published/tagged by a source.
4. **No assumed free parking.** Absence of a fee tag does not mean free.
5. **No assumed maximum stay.** A max stay is parsed only when explicitly provided by the mapped source; council evidence is reconciled separately.
6. **Geometry provenance is explicit.** Observed mapped polygons are distinguished from point-only locations.
7. **Freshness affects confidence.** Old-but-valid mapped assets are not presented with the same confidence basis as recently observed records.
8. **Official regulatory evidence has higher authority for restrictions**, but a meter/sign point alone is not proof of a discrete parking area.

## Completeness interpretation

`coverage.scope = county_wide_network` means WHITEBLOCK attempted every configured Dublin local-authority boundary in the same build. The additional field:

`coverage.coverage_claim = complete_boundary_traversal_not_complete_real_world_inventory`

is mandatory to prevent an overstated claim of real-world exhaustiveness.

## Output

Generated browser snapshot:

`web/data/dublin_parking_snapshot.json`

Primary builder:

`scripts/ingest_dublin_county_parking.py`

The snapshot records counts by local authority so a successful county build cannot silently collapse to Dublin City Centre only.
