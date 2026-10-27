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

## DATA-20261020-CL01 — Pure presentation clustering
- Data contracts unchanged: county snapshots, curated Bray records, published capacities, OSM sources, availability unknowns and provenance remain authoritative.
- Derivation: ephemeral screen-pixel groups of up to ten currently ranked destination records; group count is parking assets, never sum of capacity or open bays.
- Read/write: render-only browser transformation; zero mutations to canonical parking sources.

## DATA-20261020-MAP02 — New source-backed county integration
- Adapter contract: `state.regionInventories[regionKey]` contains normalized source asset rows, `state.regionSnapshots[regionKey]` contains validated nonempty source snapshot, followed by `whiteblock:region-inventory-ready`.
- Browser automatically builds county navigation where a new source-backed key is available; nested pilot aliases `bray` and `corkCounty` map to Wicklow and Cork.
- Stable IDs, original latitude/longitude, source access restrictions, unknown availability and provenance preserved; presentation clusters are transient.

## DATA-20261020-MAP03 — Map provider failover is not parking source failover
- Only basemap rendering changes: map tiles served by OpenFreeMap vector when available, OpenStreetMap/CARTO raster fallback if not.
- Source-backed parking inventory, availability unknowns, location coordinates, legal access and records stay unchanged.
- Rendered compatibility map does not imply real-time vacancies or complete county supply.

## DATA-20261020-COV04 — Coverage marker counts and county evidence
- Derive per-county mapped parking asset count from normalized `state.regionInventories` or snapshot fallback, with null/no-coordinate records excluded from geographic point layer and stable-ID dedupe.
- National counts remain based on `regionStats`; explicit reported vacant bays use only numeric source availability values, otherwise unverified.
- County source event `whiteblock:region-inventory-ready` redraws active county without losing user camera; if a source-backed county is still pending after a supplemental pilot loads, fit again when canonical county arrives.
- No write to parking source coordinates, capacity records, access restrictions or proof.

## DATA-20261020-MAP04 — No parking-data semantics changed by basemap repair

- Date: 2026-10-20.
- Scope: renderer/network resilience only.
- Unchanged: canonical parking IDs, coordinates, capacity, availability, access, regional snapshots, evidence provenance and recommendation eligibility.
- Important distinction: blank/partial map tiles are presentation/provider failures and must not alter source-backed parking counts or generate fallback parking records.
- Status: no data migration required.

## DATA-20261020-MAP05 — Administrative-boundary GeoJSON sidecar
- Date: 2026-10-20.
- New deployment artifact: `web/data/ireland_region_boundaries.geojson`.
- Feature key: `properties.region_key` matching `cork`, `kildare`, `dublin`, `wicklow`.
- Provenance fields: OSM relation ID, admin level, source, license and fetch timestamp.
- Scope: presentation geometry only; not merged into canonical `WB-PARK-*` records.
- Status: implemented.

## DATA-20261020-MAP06 — Marker semantic fields do not alter parking data
- Date: 2026-10-20.
- Added presentation-only GeoJSON properties for ranked-map rendering: `display_rank`, `caption`, `availability_label`, `stroke_colour`, `label_colour`.
- Source parking IDs, coordinates, access, capacity, live availability and recommendation scoring remain unchanged.
- Cluster counts are derived from distinct ranked result rows; availability is never summed into the cluster number.
- Status: no data migration required.

## DATA-20261020-MAP07 — Basemap-only change
- Date: 2026-10-20.
- No parking-source, asset-ID, access, capacity, availability, geometry, confidence or recommendation data was changed.
- Hybrid imagery/reference tiles are presentation dependencies only.
- Parking evidence continues to render in WHITEBLOCK-owned overlays above the basemap.
- Status: no migration required.

## DATA-20261021-001 — Preserve dense Kildare records while correcting null availability semantics

- Date: 2026-10-21.
- Data rule: no source-backed Kildare record is deleted or coordinate-shifted as part of the map fix.
- Rendering: temporary display coordinates exist only in the generated MapLibre feature collection.
- Availability correction: raw `null`/empty availability is checked before numeric conversion, preventing JavaScript `Number(null) === 0` from producing a false `0 FREE` label.
- Status: implemented.

## DATA-20261027-001 — Machine-readable Parking Universe source registry

- Date: 2026-10-27.
- Added: `config/parking_universe_sources.json`.
- Current connected regions: Cork, Kildare, Dublin, Wicklow.
- Source states: integrated, ready_to_integrate, gap.
- Initial Dublin ready queue includes official multistorey/live, accessible and meter/run datasets.
- Data rule: the registry records source opportunity/status only; it does not promote records into canonical inventory.
- Status: implemented.

## DATA-20261027-001 — Parking Universe state separation and shared review artifact

- Date: 2026-10-27.
- Migration: `006_parking_universe_states.sql`.
- Canonical additions: physical/recommendation/partnership/live-data states plus multi-valued coverage classes.
- Partnership data: `parking_partner_capability` links commercial capabilities to an existing canonical parking ID.
- Deployment artifact: `parking_universe_review_queue.json` contains source-backed records requiring evidence resolution.
- No data fabrication: missing fields remain unresolved; queue generation does not infer access, capacity, rules or public eligibility.
- Status: implemented.

## DATA-20261027-002 — No new pricing truth fields created for Phase 2

- Date: 2026-10-27.
- Data rule: `pricingRaw` remains the authoritative published tariff evidence.
- Runtime derivation: `sessionCost` is temporary decision context based on requested stay and is not written back to the canonical parking record.
- Freshness source order: observed timestamp → retrieved timestamp → unknown.
- Status: implemented.
