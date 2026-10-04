# System Log

## SYS-20261003-001 — Add a region-specific evidence layer for Bray

- Date: 2026-10-03
- Change: added web/data/bray_parking_snapshot.json and web/bray-adapter.js.
- System behaviour: Bray records are merged into the shared browser inventory; distance/ranking/map rendering reuse the existing WHITEBLOCK UI.
- Safety rule: Bray has no fabricated live availability. available_spaces remains null unless a live source exists.
- Coverage: 5 km regional gate centred on Bray seafront; Cork API request gate remains Cork-only because the Bray adapter loads after api-adapter.js captures the original Cork predicate.
- Failure behaviour: Bray snapshot failure is isolated to Bray regional status and does not replace Cork evidence with demo data.
- Dependencies: Leaflet, existing ranking functions, live-data adapter, access semantics.
- Status: implemented on feature branch; pending merge/production validation.

## SYS-20261003-002 — Cross-region imagery evidence overlay

- Date: 2026-10-03
- Change: introduced config/imagery_review_evidence.json plus scripts/apply_imagery_review_evidence.py.
- Behaviour: reviewed imagery metadata is overlaid onto Dublin, Cork, Kildare and Bray snapshots during Pages deployment.
- Integrity rules: no access change, no capacity inference, no availability/occupancy inference and no automatic polygon creation.
- UI: regional inventory objects expose imageryReview; Find cards, Discover and Evidence can surface the review state.
- Status: implemented on PR #32.

## SYS-20261004-001 — Coverage browse state and responsive map controls

- Date: 2026-10-04.
- System change: Ireland overview now derives locality clusters from `state.regionInventories` and can render individual canonical parking points without manufacturing a destination.
- Event contract: `whiteblock:coverage-browse` clears stale Map Engine destination/parking footprint overlays when entering national or regional browse mode.
- Map startup: persistent Street vector basemap remains active unless the user explicitly selects another layer from +.
- Region accounting: connected-region KPI is derived from the configured region set rather than hard-coded to three; Bray load status participates in readiness tracking.
- Failure semantics: unknown capacity/availability remains unknown; absent subarea metadata falls back to the regional label rather than fabricating a locality.
- Status: implemented in PR #33.
