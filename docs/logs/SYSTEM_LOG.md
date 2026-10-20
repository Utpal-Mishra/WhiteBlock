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

## SYS-20261018-001 — Separate regional-summary browsing from full inventory clustering

- Date: 2026-10-18.
- Change: `inventory-map-layer.js` now recognises national/region coverage-browse state and removes/hides the full clustered inventory layer in that state.
- Event contract: existing `whiteblock:coverage-browse` event is now consumed by the inventory layer as an explicit suppression signal.
- Count resilience: Ireland overview reads snapshot data when a regional adapter has not yet populated `state.regionInventories`.
- Layering: regional/locality browse markers use dedicated `wbOverviewPane` above ordinary inventory markers.
- Bray isolation: loading Bray evidence no longer changes `parkingData` unless the active destination is actually in Bray coverage.
- Status: implemented.

## SYS-20261019-WW01 — Wicklow regional loader
- Date: 2026-10-19; status: implemented in feature branch, production validation pending.
- Change: independent browser adapter hydrates Wicklow JSON inventory on demand and renders destination markers/KPIs without invented occupancy.
- Isolation: preserves Bray's existing curated 5 km pilot; keeps Cork/Kildare/Dublin regions unchanged.
- Recovery: source outage surfaces a missing-inventory state rather than substitute records.

## SYS-20261020-WW01 — County-level UI reconciliation
- Date: 2026-10-20; status: branch.
- Changed: Ireland region switcher/county markers, Discover filters and Inventory Coverage. Kept existing Bray destination adapter/parking listings.
- User correction: do not expose a seafront evidence pilot as a top-level administrative region.

## SYS-20261020-CL01 — Ranked map display and browse-mode isolation
- Trigger: mobile map screenshots showed seven 01–07 Cork recommendation markers overlapping in Ireland overview after zoom changes.
- Cause: MapLibre ranked-results layer ignored national/region browse state; the separate all-inventory Leaflet layer already clusters its supply.
- Change: empty ranked source on county/national browse, cancel stale geometry-response writes and recompute ranked marker groups on zoom.
- Status: PR #38 awaiting integration; no change to source inventory or reported parking availability.

## SYS-20261020-MAP02 — Region-independent marker update
- Status: PR #39 pending release; implemented universal grouping module and hooked inventory, ranked GL and county locality layers into it.
- Affected: all currently connected counties (Cork, Kildare, Dublin, Wicklow) and future validated county datasets; Bray remains nested in Wicklow.
- Behaviour: grouped map markers collapse at low zoom and separate when geographically distinguishable; no stale ranked results on national/county browsing.

## SYS-20261020-MAP03 — Preserve a geographical map on renderer failure
- Evidence: Android Cork screenshot displayed only the optional dark Parking Layout while Street was selected.
- Root cause: `web/map-engine-v2.js` automatically clicked Parking Layout when MapLibre initialisation failed or its 4.5-second street style watchdog expired.
- Change: replace forced schematic with Leaflet raster street basemap, keep map overlays, preserve toolbar operation, and offer alternate raster street provider after repeated tile errors.
- Status: PR #40 / release verification pending.

## SYS-20261020-COV04 — Ireland-to-county all-parking map
- System transition: national overview -> selected county full inventory -> zoom-adaptive parking site clusters/individual points.
- Parent: `web/ireland-overview.js` owns national/county map presentation; region adapters provide source-backed inventories. County mode never manufactures a destination.
- New county direct renderer `renderCountyParkingMarkers` reuses existing marker clustering and per-site tooltips.
- Optional Parking Layout is dismissed on all national/county selection events so the geographic street map is visible.

## SYS-20261020-MAP04 — Single basemap owner and bounded raster recovery

- Date: 2026-10-20.
- System owner: `map-engine-v2.js` (v3 runtime) is now the sole persistent basemap renderer after startup.
- Startup: `app.js` provides an immediate real Leaflet street map; `map-fix.js` provides controls/context only; v3 replaces the initial layer with the persistent renderer.
- Recovery: WebGL/vector failure -> OSM raster Street -> CARTO raster Street when the visible tile grid errors or stalls.
- Geometry repair: Leaflet size invalidation and MapLibre resize are run together after responsive resize, orientation/visibility changes, browse transitions, data-ready events and parking focus.
- Status: implemented; CI/deployed mobile confirmation pending.

## SYS-20261020-MAP05 — Selected-region administrative boundary overlay
- Date: 2026-10-20.
- System change: county focus now loads a dedicated GeoJSON administrative-boundary layer and renders it beneath parking markers but above the basemap.
- State: `state.regionBoundaryLayer` is independent from parking, coverage and recommendation layers.
- Transition rules: Ireland overview clears the selected boundary; selecting Cork/Kildare/Dublin/Wicklow clears the previous outline and draws the newly selected county; destination selection clears the county outline.
- Camera: county parking points still fit immediately, then the exact county boundary may refine the frame when available.
- Failure mode: if boundary GeoJSON is unavailable, parking inventory remains usable and the existing county parking fit is retained.
- Status: implemented on feature branch.

## SYS-20261020-MAP06 — Semantic marker states
- Date: 2026-10-20.
- Ranked destination overlay now carries independent fields for ordinal rank, cluster quantity and live availability.
- Browse mode uses a separate LOCATIONS cluster component and keeps individual browse markers number-free.
- Leaflet fallback mirrors the same semantics so WebGL/raster degradation does not change meaning.
- Status: implemented on feature branch.

## SYS-20261020-MAP07 — Hybrid is the default basemap state
- Date: 2026-10-20.
- Default state: aerial imagery + transparent road/place reference overlay.
- First paint: `app.js` renders Hybrid immediately.
- Persistent owner: map-engine v3 starts directly with Hybrid and retains the existing parking overlay stack.
- Menu contract: only Hybrid remains permanently visible; Street, Terrain, Satellite, Street View and Parking Layout are under `+`.
- Recovery: MapLibre Hybrid -> Leaflet Hybrid -> Street raster -> alternate Street raster.
- Status: implemented on feature branch.
