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
