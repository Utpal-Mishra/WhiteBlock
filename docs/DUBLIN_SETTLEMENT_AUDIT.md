# County Dublin Settlement-by-Settlement Parking Audit

Status: active precision audit started 2026-09-22.

This document is the human-readable audit log for the requested County Dublin expansion from city/town level down through suburbs, villages and neighbourhoods. It complements `DUBLIN_COVERAGE_LOG.md` and the generated machine-readable evidence artifacts.

## Audit principle

WHITEBLOCK separates **boundary traversal**, **mapped-source inventory**, **regulatory evidence**, and **real-world legal usability**. None of these is treated as interchangeable.

A mapped `amenity=parking` feature is retained as a mapped parking asset, but missing access remains `unknown`. A council meter, parking tag or sign is regulatory evidence and is not automatically converted into a parking-area polygon. A named settlement with no mapped parking in the current snapshot is added to the research queue; it is not labelled as having no parking.

## 2026-09-22 — Baseline exact-boundary build

Independent GitHub Actions validation completed successfully on the County Dublin model.

Verified build totals:

| Local authority | Mapped parking assets |
| --- | ---: |
| Dublin City | 2,523 |
| Fingal | 2,123 |
| Dún Laoghaire–Rathdown | 1,854 |
| South Dublin | 2,505 |
| **County Dublin total** | **9,005** |

Additional build diagnostics:

- 8,552 assets retain mapped polygon geometry.
- 9,005 / 9,005 assets have a settlement label.
- 162 settlement rows currently contain mapped inventory.
- 0 parking assets required a local-authority fallback settlement assignment.
- 4,442 parking assets currently have `access_type=unknown`; these are **not** promoted to public parking.

These totals describe the current evidence snapshot, not every real-world parking space in County Dublin.

## Settlement audit implementation

Added `scripts/build_dublin_settlement_audit.py`.

The audit independently traverses the exact four Dublin local-authority relations for currently mapped named OSM anchors of type:

- city
- town
- village
- suburb
- neighbourhood

It then reconciles those named anchors against the validated parking snapshot. This deliberately exposes named settlements with zero matched parking inventory as a research queue instead of allowing them to disappear from a parking-only ledger.

For each named settlement the audit records:

- local authority and exact relation provenance;
- settlement name and mapped place type(s);
- OSM anchor IDs and duplicate-name count;
- mapped parking-asset count;
- mapped polygon count;
- known-capacity record count;
- unknown-access count and observed access states;
- coverage state.

A zero asset count is labelled `named_settlement_no_mapped_inventory_in_snapshot`, not `no_parking`.

## Current regulatory evidence rules

Current official/open evidence is kept separate from physical parking geometry.

- Dublin City Council meter/location/tariff data is used as regulation and meter evidence.
- Fingal pay-and-display and meter datasets are used as regulation/tariff evidence. Dataset disclaimers are preserved because a published meter/zone point may not equal the exact geometry of a parking area.
- South Dublin parking-meter evidence is used as regulatory evidence rather than automatic parking-area geometry.
- Dún Laoghaire–Rathdown Parking Tag Information is retained with its actual resource-data date of 2021-04-15. The later catalogue refresh is not treated as newer parking evidence.
- Older DLR parking-run/sign survey data is considered historical corroboration only where the publisher warns that later changes/upgrades may not be represented.

## Precision queue

The next evidence work is prioritised by uncertainty rather than by raw record count:

1. Named settlements with zero mapped parking inventory in the settlement audit.
2. Assets with `access_type=unknown`, starting with the highest-volume settlements.
3. Customer-only/private/permit-controlled parking, including supermarket and retail parking, with maximum-stay/opening-hour restrictions kept explicit.
4. Official public car parks and regulated on-street areas that can be spatially reconciled to geometry without inventing polygons from meter/sign points.
5. Capacity, accessible-bay, EV, tariff, maximum-stay and opening-hours enrichment where a factual source exists.
6. Satellite/aerial candidate discovery only as a candidate layer; imagery alone cannot prove public/legal access.

## Publication gate

County Dublin may be described as **complete exact-boundary traversal of the configured mapped sources** only when all four local-authority traversals succeed in the same validated build.

It must not be described as complete real-world parking inventory. The mandatory machine-readable claim remains:

`complete_boundary_traversal_not_complete_real_world_inventory`

## GitHub evidence

Relevant implementation commits for this audit phase:

- `f0d1dcaf15cf303f72ec00ddfcbb5b6b105daf56` — add named-settlement audit builder.
- `dddfac950085757f6c5bc015ce2699482bf5ea74` — run and validate settlement audit in the independent Dublin workflow.

The workflow artifact contains the generated parking snapshot, mapped-inventory coverage ledger and settlement audit so each validated run has inspectable evidence.