# Data & Integration Log

## DATA-20261003-001 — Bray evidence snapshot

- Date: 2026-10-03
- Dataset: web/data/bray_parking_snapshot.json
- Sources integrated:
  - Wicklow County Council parking rules;
  - OpenStreetMap-derived parking geometry;
  - current parking listings;
  - aerial/street imagery evidence;
  - event traffic-management evidence.
- Fields: canonical ID, coordinates, type, access, lifecycle, capacity where supported, maximum stay, pricing/rule text, truth state, confidence, source notes and evidence links.
- Null policy: unknown capacity/availability/EV/accessibility values remain null.
- Deduplication: aliases/near-identical coordinates are merged into one canonical record.
- Update mode: curated/manual at this stage.
- Future integration: stage source records into PostGIS reconciliation rather than maintain a browser-only regional snapshot.
- Status: implemented.

## DATA-20261003-002 — Imagery review metadata integration

- Date: 2026-10-03
- Source-of-truth file: config/imagery_review_evidence.json.
- Overlay: scripts/apply_imagery_review_evidence.py.
- Matched first-pass IDs: 31.
- Persisted fields include provider/product, acquisition date, resolution, review result, geometry action, confidence and caveats.
- Explicitly not persisted: imagery pixels, inferred live occupancy, inferred free spaces, automated polygon geometry.
- Regional application: Dublin, Cork, Kildare and Bray snapshots receive nested imagery_review metadata.
- Status: implemented.

## DATA-20261018-001 — Regional map totals use validated snapshot fallback

- Date: 2026-10-18.
- Integration change: Ireland overview may read `state.regionSnapshots[region].locations` / snapshot summary when the corresponding hydrated `state.regionInventories[region]` is not yet available.
- Priority: hydrated canonical inventory remains first choice; snapshot is a display-resilience fallback from the same deployed evidence pipeline.
- No fabrication: missing capacity/availability stays unknown; only explicit values in inventory/snapshot rows are aggregated.
- Current validated deployment reference: Cork 4,250 county locations; Kildare 128 partial evidence anchors; Dublin 9,336 locations; Bray 7 pilot assets.
- Status: implemented.
