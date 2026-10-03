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
