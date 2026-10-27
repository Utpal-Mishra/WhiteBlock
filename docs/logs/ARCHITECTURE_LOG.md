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

## ARCH-20261020-CL01 — View-state-aware, pixel-distance ranked clusters
- Model: national county totals → county locality totals → destination-level ranked individual locations.
- Ranked overlay: groups real location coordinates by 56px projected-screen proximity at zoom below 17, displays one count marker per group and individual numbered markers at zoom 17+; no altered stored positions.
- Geometry: only show matched/estimated footprint polygons at zoom 14+ and only for non-clustered point groups. County/national browsing renders no destination-rank overlay.
- Existing Leaflet all-inventory markerCluster layer remains separate; no additional source of parking location counts.

## ARCH-20261020-MAP02 — Shared cluster policy and dynamic county onboarding
- `web/parking-marker-policy.js` centralises pixel clustering, detailed zoom thresholds, browsable-state gating, source pool identity deduplication and canonical parent county for local pilots.
- `web/ireland-overview.js` groups locality cards and on-demand individual places, registers new source-backed county snapshots into navigation automatically.
- `web/inventory-map-layer.js` uses Leaflet.markercluster or an internal no-CDN clustering fallback; ranked MapLibre layer applies identical source-independent policy.
- Constraint: never update true spatial source coordinates or interpret group counts as confirmed vacant bays.

## ARCH-20261020-MAP03 — Vector primary, geographic raster fallback, schematic opt-in
- Basemap chain: MapLibre OpenFreeMap vector Street → Leaflet OpenStreetMap street tile fallback → CARTO street tile backup if OSM requests fail repeatedly.
- Terrain/Satellite: retain geographic tile fallbacks and return to Street if imagery tiles fail; never silently replace geography with a schematic diagram.
- Renderer ownership: rasterFallbackLayer is preserved from layeradd cleanup; failed MapLibre layer removed, stale style watchdog generations invalidated.
- Parking Layout remains a user-invoked optional presentation layer with a dedicated exit button.

## ARCH-20261020-COV04 — Two-level navigation with progressive detail
- Ireland overview: four source-connected county markers (future source-backed counties auto-register) with `regionStats` mapped-location totals; authoritative Ireland-wide bounds and no background interval camera reset.
- Region focus: derive stable-ID-deduplicated full county parking asset rows; fit geographical bounds to real coordinates, cap auto zoom, render clusters using `WHITEBLOCK_MARKER_POLICY` and reveal actual site coordinates at detail zoom.
- Wicklow includes Bray locality asset records without creating a fifth national region; late county source triggers pending all-county fit.
- Preservation: zoom/pan by user is retained during asynchronous count/data refresh, except pending first full-county source fit when a prior pilot-only preview was shown.

## ARCH-20261020-MAP04 — One renderer owns the basemap

- Date: 2026-10-20.
- Decision: only the persistent map engine may own the long-lived basemap. The legacy map adapter must not create a second MapLibre layer.
- Rationale: two renderer lifecycles can race during Android startup/removal and leave stale/partial map surfaces.
- Resilience chain: vector Street -> geographic raster Street provider A -> geographic raster Street provider B; Parking Layout remains explicit opt-in only.
- Responsive contract: map-container geometry changes require Leaflet `invalidateSize` and MapLibre `resize` as one atomic repair action.
- Status: accepted/implemented.

## ARCH-20261020-MAP05 — Administrative boundary is a separate presentation layer
- Date: 2026-10-20.
- Decision: do not infer county borders from parking points, bounding boxes or convex hulls.
- Boundary source: published OpenStreetMap admin-level-6 county relations, materialized to browser-safe GeoJSON during Pages deployment.
- Rendering: dedicated `wbRegionBoundaryPane` at z-index 438; parking footprints/points remain above it.
- Styling: strong lime outline, very light green fill, no pointer interaction.
- Separation: boundary geometry has no effect on parking identity, capacity, access, availability or recommendation eligibility.
- Status: accepted/implemented.

## ARCH-20261020-MAP06 — Separate quantity, ordinal and availability channels
- Date: 2026-10-20.
- Decision: map marker payloads must encode three distinct concepts rather than overloading one numeric label.
- Ranked GeoJSON properties: `display_rank`, `caption`, `availability_label`, plus existing evidence/status fields.
- Rendering: cluster quantity is drawn with a dark stacked/ring visual; ordinal rank is prefixed with `#`; availability is rendered as a secondary label below an individual recommendation.
- Status: accepted/implemented.

## ARCH-20261020-MAP07 — Hybrid is a layered basemap, not a screenshot-style asset
- Date: 2026-10-20.
- Hybrid composition: Esri World Imagery as the raster base plus a transparent World Hybrid reference overlay carrying roads/place context.
- Pure Satellite remains a separate imagery-only mode.
- Parking markers, recommendation ranks, county boundaries and footprints remain independent layers above the basemap.
- Runtime does not use Google Maps tiles or copy Google map styling/data.
- Status: accepted/implemented.

## ARCH-20261021-001 — Canonical coordinates remain immutable; display coordinates may fan out

- Date: 2026-10-21.
- Decision: resolve dense marker collisions in the presentation layer rather than mutating canonical parking coordinates or deleting source-backed assets.
- Architecture: true asset coordinates remain in the canonical inventory and footprints; at detailed zoom a temporary display coordinate may be derived in screen space and connected back to the true point with a line.
- Rationale: supports complete evidence retention while keeping the mobile map legible.
- Status: accepted.

## ARCH-20261027-001 — Parking Universe is a source-family + canonical-asset layer

- Date: 2026-10-27.
- Decision: Phase 1.5 operates above heterogeneous source snapshots and below partnership features.
- Architecture: source registry → regional source ingestion/staging → canonical reconciliation → evidence/access/rules resolution → recommendation eligibility → partnership enrichment.
- Deployment report is derived from current source-backed snapshots and never creates parking records.
- Status: accepted/implemented.

## ARCH-20261027-001 — Parking Universe is a source-family + canonical-asset layer

- Date: 2026-10-27.
- Decision: Phase 1.5 operates above heterogeneous source snapshots and below partnership features.
- Architecture: source registry → regional source ingestion/staging → canonical reconciliation → evidence/access/rules resolution → recommendation eligibility → partnership enrichment.
- Deployment report is derived from current source-backed snapshots and never creates parking records.
- Status: accepted/implemented.

## ARCH-20261027-001 — Parking Universe identity is independent from recommendation and partnership

- Date: 2026-10-27.
- Decision: `WB-PARK-*` remains the durable asset identity regardless of whether an asset is currently recommendable or partnered.
- Added state dimensions: `physical_status`, `recommendation_status`, `partnership_status`, `live_data_status`, `coverage_classes`.
- Added relationship table: `parking_partner_capability` enriches an existing canonical parking record with booking/payment/live/session capabilities.
- Consequence: partnership creation/removal cannot create/delete the underlying parking identity.
- Status: accepted and implemented.
