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
