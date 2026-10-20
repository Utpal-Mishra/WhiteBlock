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

### DATA deployment refresh — 2026-10-18

- Latest Pages build refreshed County Cork to 4,251 mapped locations / 4,087 polygons.
- Kildare exact-boundary refresh timed out and correctly fell back to 128 explicitly partial evidence anchors.
- Dublin remained validated at 9,336 mapped locations.
- The national overview consumes these deployed values dynamically; no regional count is hard-coded in the UI.

## DATA-20261018-002 — Separate canonical asset identity from partnership metadata

- Date: 2026-10-18.
- Data-model direction: canonical `WB-PARK-*` identity persists independently of operator/partner relationship.
- Asset layer: geometry, physical existence, lifecycle, access class, rules, capacity evidence, accessibility/EV attributes, provenance and confidence.
- Partnership layer: partner/operator ID, verified relationship, booking/payment URL/API, live feed capability, commercial access/benefits and session-management support.
- Candidate policy: plausible physical parking remains representable even when access or partnership status is unresolved.
- Status: adopted for future schema/reconciliation work.

## DATA-20261019-WW01 — Wicklow mapped county ingestion
- Date: 2026-10-19; status: code added, first live source count not yet confirmed.
- Integration: OSM mapped parking via admin relation 282760 (ODbL) -> generated Wicklow JSON browser snapshot.
- Preserved fields: OSM ID/URL/type, coordinates, optionally valid polygon, settlement/provenance, source timestamp, explicit access/fee/capacity/opening hours.
- Null policy: available_spaces, occupancy and untagged capacity/rules remain null; OSM fee tags are textual, not verified monetary prices.
- Deduplication: OSM ID and exclusion of Bray pilot circle.

## DATA-20261020-WW01 — County-normalized Bray identity
- Date: 2026-10-20; status: branch.
- In-memory classification: Bray asset county='Wicklow', area='Bray'; underlying Bray source key/IDs/snapshot retained.
- Collection: Wicklow county summary combines Wicklow OSM records and independently curated Bray records; site-specific record values and null availability are unchanged.
