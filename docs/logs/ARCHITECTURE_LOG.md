# Architecture Log

## ARCH-20261003-001 — Regional adapter pattern

- Date: 2026-10-03
- Decision: introduce Bray through a regional adapter rather than modifying the Cork authoritative ingestion contract.
- Rationale: Cork is live-feed oriented; Bray currently has heterogeneous evidence and no equivalent authoritative live occupancy feed.
- Pattern:
  1. region evidence snapshot
  2. region adapter
  3. shared canonical browser inventory
  4. shared ranking/map/evidence UI
- Boundary: the PostGIS/API Cork gate is captured before the regional coverage gate is widened.
- Data semantics: stable asset facts and rule evidence can be added; live occupancy must remain separate and absent when unsupported.
- Future path: migrate Bray into the persistent reconciliation/PostGIS layer once an automated source pipeline is available.
- Status: accepted for evidence-pilot stage.

## ARCH-20261003-002 — Imagery evidence is a sidecar, not a replacement source of truth

- Date: 2026-10-03
- Decision: store human-reviewed conclusions as metadata sidecar evidence and overlay them onto regional snapshots at build time.
- Rationale: keeps imagery provenance separate from legal/access and live-observation domains; avoids copying provider imagery into the repository.
- Architecture: regional source → canonical asset → imagery-review sidecar → deployment overlay → UI evidence.
- Geometry policy: candidate_polygon_allowed creates a later digitisation task only; geometry remains null until independently digitised/reconciled.
- Status: accepted.

## ARCH-20261004-001 — Coverage map uses hierarchical aggregation, not a flat national marker layer

- Date: 2026-10-04.
- Decision: derive map drilldown groups at runtime from canonical regional inventories rather than introduce a second parking dataset for map navigation.
- Hierarchy: national regional node → subarea grouping using settlement/area/city/town/local-authority evidence → canonical parking points.
- Aggregation: location count is always derived from mapped records; capacity and live availability are summed only from records that explicitly publish those values.
- UI state: coverage browsing emits `whiteblock:coverage-browse` so stale destination/recommendation overlays can be cleared without mutating source data.
- Bray boundary: Bray participates as a regional evidence pilot with County Wicklow context; no whole-Wicklow inventory claim is made.
- Status: accepted and implemented in PR #33.

## ARCH-20261018-001 — National map has one authoritative browse layer at a time

- Date: 2026-10-18.
- Decision: national/region browsing and destination-level inventory clustering are mutually exclusive visible map states.
- Rationale: displaying both summary cards and thousands of clustered assets at the same time creates overlap, ambiguous counts and poor mobile legibility.
- Architecture:
  1. Ireland overview renders regional summary nodes from canonical inventories or validated snapshot fallback.
  2. Region focus renders locality groups.
  3. Locality focus renders individual points.
  4. Destination search may reactivate the full inventory cluster layer.
- Layer contract: `wbOverviewPane` is reserved for browse hierarchy markers.
- Status: accepted/implemented.

## ARCH-20261018-002 — Asset registry and partnership layer are independent

- Date: 2026-10-18.
- Decision: keep canonical parking identity/evidence separate from commercial integration state.
- Architecture:
  1. discovery/evidence sources create or reconcile a parking candidate/asset;
  2. verification resolves physical existence, access, rules and lifecycle;
  3. recommendation eligibility is derived from evidence/rules;
  4. partnership connectors enrich the same canonical asset with operational/commercial capabilities.
- Benefit: a partnership can be added/removed without deleting the underlying parking record or losing its history.
- Status: accepted.

## ARCH-20261019-WW01 — Administrative-boundary county ingestion
- Date: 2026-10-19; status: implementation branch.
- Flow: OSM exact County Wicklow admin-level-6 relation 282760 -> source-labelled snapshot -> browser regional adapter -> Ireland Overview / Find / Discover / Inventory Coverage.
- Boundary rule: exclude Bray pilot's 5 km coverage from new county snapshot to avoid duplicate totals.
- Separation: mapped supply != current driver eligibility != live occupancy != commercial partnership.

## ARCH-20261020-WW01 — Separate ingestion from presentation hierarchy
- Date: 2026-10-20; status: branch.
- Pattern: internal state.regionInventories.bray and .wicklow remain separate ingestion pools; presentation aggregates them as County Wicklow, de-duplicates stable IDs and derives locality from Bray metadata.
- Guardrail: county totals count source assets once; no inferred live occupancy or cross-pilot duplicate representation.
