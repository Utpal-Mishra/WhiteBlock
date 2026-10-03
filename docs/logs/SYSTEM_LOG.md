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
