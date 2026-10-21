# Validation / QA Log

## QA-20261003-001 — Bray implementation checks

- Date: 2026-10-03
- Static validation targets:
  - JSON snapshot parses successfully.
  - Bray adapter loads after api-adapter.js.
  - Cork API gate remains Cork-only.
  - Bray coverage gate is available to later UI layers.
  - duplicate Bray IDs are not introduced on repeated data-ready events.
  - unknown availability remains null and renders as unknown.
  - access_type=unknown is not converted to public.
- Functional checks pending after branch deployment:
  - search Bray Seafront;
  - verify seven mapped assets appear;
  - verify Cork results still work;
  - verify Ireland overview shows Bray;
  - verify mobile layout and map layers;
  - verify no console error if Bray snapshot fails.
- Status: static design checks completed; PR tests passed; deployment regression in progress.


## QA-20261003-002 — Main/deployment synchronization check

- Date: 2026-10-03
- Check: verify Bray implementation exists on the deployed source branch rather than only a feature branch.
- Result: PASS for repository synchronization.
- Evidence:
  - PR #31 tests completed successfully.
  - PR #31 merged into main.
  - main `web/index.html` references `./bray-adapter.js?v=20261003-1`.
  - main `web/bray-adapter.js` exists.
  - Pages workflow #181 is running from merge commit `b9269d82fd7d659a8843f861262f099403cc6b4a`.
- Remaining gate: workflow must complete the upload/deploy steps before the public Pages URL reflects the Bray build.
- Status: repository sync passed; public deployment pending completion.

## QA-20261003-003 — Cross-region imagery review integrity checks

- Date: 2026-10-03
- Reviewed records: 31; County Dublin, County Cork, County Kildare and Bray are all represented.
- Imagery artifact workflow: successful review artifact generated with per-record frames, metadata and region contact sheets.
- Review outcomes: 17 physical parking visible; 9 footprint ambiguous; 3 distinct footprint not confirmed; 2 visible only in older imagery.
- Data integrity: no imagery pixels committed; no available/occupied-space values created; no access-type values changed; no automatic geometry created.
- Negative evidence preserved: ambiguous/not-confirmed outcomes remain explicit.
- App regression: legacy runtime/test contracts preserved while adding four-region runtime wiring and imagery metadata.
- Status: evidence validation passed; final CI/deployment validation tracked on PR #32.

## QA-20261004-001 — Mobile map/alignment regression suite

- Date: 2026-10-04.
- PR: #33.
- Static contracts added/updated:
  - Street is the preferred/default basemap; Terrain is no longer auto-selected.
  - compact map toolbar contains a + menu for secondary map views/tools;
  - Ireland overview includes Bray and exposes locality drilldown functions;
  - Discover parking titles allow multi-line wrapping;
  - Dublin settlement/access evidence rows use responsive CSS classes rather than fixed-width inline columns;
  - cache-busted runtime references match the changed assets.
- Manual acceptance targets after deployment:
  - national map shows separated connected-region nodes with totals;
  - selecting Dublin exposes locality groups and a second click exposes individual parking points;
  - long Bray/Dublin location names remain readable beside/below state badges;
  - Evidence queues remain fully inside a 360–430 px viewport;
  - + menu opens/closes and all secondary map options still work.
- Status: feature-branch validation implemented; GitHub Actions and deployed-mobile checks pending.

## QA-20261018-001 — Regional count visibility regression checks

- Date: 2026-10-18.
- Automated contracts added/updated:
  - inventory cluster layer contains `coverageBrowseActive` and responds to `whiteblock:coverage-browse`;
  - Ireland overview supports snapshot-row/summary fallback via `snapshotRows` and `publishedLocationCount`;
  - overview markers use `wbOverviewPane`;
  - runtime cache keys reference the 2026-10-18 overview/inventory assets.
- Expected deployed data from the latest validated Pages build before this fix:
  - County Cork snapshot: 4,250 mapped locations;
  - County Kildare fallback: 128 evidence anchors, explicitly partial;
  - County Dublin snapshot: 9,336 mapped locations;
  - Bray pilot: 7 evidence-backed assets.
- Manual acceptance:
  - Ireland default view visibly shows Cork and Kildare numeric cards;
  - no stray seven-item/other inventory cluster obscures Dublin-region summary;
  - selecting a region still drills into locality groups;
  - destination search still restores exact inventory markers/clustering.
- Status: branch implementation complete; CI and live mobile verification pending.

### QA deployment result — 2026-10-18

- PR #34 test run: PASS.
- Main deployment run #254: PASS, including snapshot build, imagery overlay, regional validation, artifact upload and GitHub Pages publication.
- Deployed source counts: Cork 4,251 locations; Kildare 128 partial evidence anchors; Dublin 9,336 locations.
- Status: automated deployment validation passed; user-facing mobile visual confirmation remains the final observational check.

## QA-20261019-WW01 — Wicklow safeguards
- Date: 2026-10-19; status: offline tests authored, CI and production smoke tests pending.
- Assertions: exact County Wicklow relation 282760; no Bray overlap; no generated available_spaces; correct null capacity/access semantics; never create polygon from non-closed way.
- Post-build gate: nonempty source-backed snapshot, non-exhaustive flag, correct boundary metadata, no duplicated Bray records.
- Manual test queue: Wicklow Town, Greystones, Arklow, Blessington and Glendalough map/search/locality.

## QA-20261020-WW01 — Four counties with Bray inside Wicklow
- Date: 2026-10-20; status: CI tests prepared.
- Assertions: no Bray county-level filter; no separate Bray national card; retained Bray inventory loading and navigation; Wicklow county totals and town grouping include Bray; provenance and unknown availability unchanged.
- Deployment: review counts and click Wicklow -> Bray locality -> individual locations before closing QA.

## QA-20261020-WW02 — Prevent legacy Bray fifth-region regression
- Date: 2026-10-20; test added to `tests/test_ireland_overview.py`.
- Asserts: no Bray root-level map coverage marker, no Bray top-level Discover or Ireland switcher option, Wicklow filter present, Bray-to-Wicklow Discover normalization preserved, pilot source remains associated with Wicklow, and Bray Seafront remains searchable.
- Requires: GitHub Actions green + post-deployment manual review of Ireland -> Wicklow -> Bray -> parking locations and fresh cache on mobile.
- Status: awaiting CI and UI smoke test.

## QA-20261020-CL01 — Overlapping ranked markers
- Automated: Node MapLibre/Leaflet test covers overview empty, 7→1 at low zoom, tap zoom, 1→7 at zoom 17, and county/browse clearing with preserved rank strings.
- Manual queue: mobile Ireland → Cork → select a destination with nearby parking → pinch outward until a count badge replaces overlapping ranks → zoom in until all numbered real sites return.
- Also test: switch Street/Terrain/Satellite, return to Ireland while fetch pending, verify no stale 01–07 and no change to inventory/live occupancy numbers.
- CI follow-up: older asset-version assertion updated in `tests/test_parking_geometry_layer.py`.
- Status: awaiting CI and device-level visual confirmation.

## QA-20261020-MAP02 — Shared marker all-county release
- Automated: 7→1→7 tests for Cork, Kildare, Dublin, Wicklow, Galway and Donegal synthetic site fixtures; nested Bray and duplicate Cork source handling; ranked browse isolation.
- Manual: Android zoom tests national→county→locality→individual in all four connected regions plus Bray, plugin failure, fast pan, basemap switching and label/capacity distinctions.
- Caveat: future Galway/Donegal tests are synthetic. They do not prove physical source coverage or live vacancy there.
- Status: CI/publishing and device verification outstanding.

### Renderer duplication gate — 2026-10-20
- `map-engine-v2.js` stops drawing duplicate ranked Leaflet circles/polygons when the native GL overlay is live; GL readiness releases any provisional fallback.
- Universal regression test enforces the ownership event and fallback clustering. Manual verify Android switch from provisional to GL never leaves two icons per location.

## QA reconciliation — universal marker implementation merged
- Date: 2026-10-20; PR #39 feature CI run `39459853465` concluded SUCCESS.
- Assertions include regional coverage and code integrations: Cork/Kildare/Dublin/Wicklow + synthetic Galway/Donegal; Bray nested within Wicklow; ranked/inventory/legacy renderer isolation.
- Source-backed future registration follows `docs/UNIVERSAL_MARKER_POLICY.md`; synthetic fixture success is not live-site validation.
- Outstanding: main deployment run `39459997110` and in-browser Android map zoom, cluster tap and visual checks. Do not mark visual QA passed until observed.

## QA-20261020-MAP03 — Real map vs Parking Layout
- Evidence: Android screenshot, Cork City, Street selected but Parking Layout covering streets.
- New `tests/test_geographic_map_fallback.js`: MapLibre throws, style watchdog expires, preserve Leaflet fallback on layeradd cleanup, OSM tile failures switch to CARTO street tiles, no automatic schematic.
- Retained national marker aggregation tests, updated loader/cache-contract assertions.
- Manual: open Cork destination, Street should show streets; explicitly choose Parking Layout from +; Back to map restores; change Satellite/Terrain; test mobile weak network. Not yet confirmed by visual screenshot.

## QA-20261020-MAP03 merge evidence
- PR #40 tests: PASS (GitHub Actions `39467188332`); real raster fallback and compatibility state passed mocked recovery checks.
- Main branch and Pages rebuild triggered for commit `8cc276f4302a798042eb8b62610c3bc6fb48067d`.
- Not yet validated in an Android graphical browser: new Street default, ability to select Parking Layout voluntarily, Back to map control, and recover under actual weak mobile network conditions.

## QA-20261020-COV04 — Ireland coverage and full county map
- Automated: simulated national geographic camera has 4 source-connected county badges, with matched mapped-location counts; Cork 7 and Dublin 10 sample assets fit direct bounds and split into per-asset markers at zoom 17; Wicklow 5+Bray 1 on delayed county load; no repeated Ireland camera fit on refresh.
- Production test queue: select Ireland, verify all-island basemap and actual live county counts; tap/filter Cork, Kildare, Dublin and Wicklow, confirm full parking asset extent and count clusters, pinch zoom/click location, Bray within Wicklow.
- Negative QA: no fake vacant-bay count where live data absent; no forced schematic overlay; no marker or source duplication; map not resetting while user pans.
- Status: pending CI and live device check.

## QA-20261020-COV04 — Automated checks passed; mobile gate open
- PR #41 branch suite `39472300266`: PASS. Main suite `39472445119`: PASS.
- Regression asserts source-dependent national badges, Cork and Dublin direct all-site map bounds, detailed marker expansion, full-county Wicklow fit after Bray-only loading, Ireland reset and non-invented live vacancy.
- Pending: GitHub Pages `39472445106` completion; manual Android check of visible actual street tiles, touch interactions, mobile count labels and four connected county views.

## QA-20261020-MAP04 — Checkerboard map regression gate

- Date: 2026-10-20.
- Automated assertions:
  - MapLibre failure still leaves a real geographic raster map;
  - raster fallback has a bounded incomplete-grid watchdog;
  - a stalled OSM grid switches to CARTO even without `tileerror`;
  - responsive engine contains `ResizeObserver` and Leaflet `invalidateSize`;
  - legacy map adapter no longer calls `activateStreetVector()` at startup;
  - Parking Layout is never activated automatically.
- Manual device checks after Pages deploy:
  - Ireland default fills the entire map card;
  - Cork/Kildare/Dublin/Wicklow county switches keep a continuous basemap;
  - rotate portrait/landscape and return to portrait;
  - background/foreground browser tab;
  - weak-network fallback does not leave checkerboard tiles.
- Status: pending CI and live mobile confirmation.

## QA-20261020-MAP05 — Selected county outline
- Date: 2026-10-20.
- Automated contracts:
  - boundary config contains canonical Cork/Kildare/Dublin/Wicklow OSM relation IDs;
  - builder stitches relation members into Polygon/MultiPolygon GeoJSON;
  - overview loads the boundary sidecar, renders with `L.geoJSON`, uses `wbRegionBoundaryPane`, and cache-busted assets;
  - county parking fit remains immediate and boundary fit refines focus when geometry is available.
- Manual mobile checks:
  - select each county and verify the correct outline;
  - ensure the previous county outline disappears instantly when switching;
  - Ireland reset removes all selected-region fill/border;
  - parking clusters/labels remain above the boundary;
  - boundary survives Street/Terrain/Satellite changes and map resize/orientation.
- Status: pending CI/deployed visual check.

### MAP05 automated result — 2026-10-20
- PR #43 branch tests: PASS (run #330).
- Main tests after merge: PASS (run #331).
- Pages boundary-generation/validation step in run #274: PASS.
- Remaining gate: completion of the full Pages deployment and on-device visual confirmation of Cork/Kildare/Dublin/Wicklow outlines.

## QA-20261020-MAP06 — Marker semantic regression gate
- Date: 2026-10-20.
- Automated contracts:
  - destination cluster carries `OPTIONS`;
  - individual ranked marker carries explicit `#` rank;
  - availability is a separate property/layer;
  - inventory cluster says `locations`;
  - county browse cluster says `LOCATIONS`;
  - Leaflet fallback mirrors MapLibre semantics;
  - cache-busted assets load the new renderers.
- Manual checks after deploy:
  - search with 3 close results: one `3 OPTIONS` cluster;
  - zoom in: `#1`, `#2`, `#3`;
  - live-space count, when present, is below its individual marker and never inside cluster count;
  - county browse shows `N LOCATIONS`, not `N OPTIONS`.
- Status: pending CI and live review.

## QA-20261020-MAP07 — Hybrid default regression gate
- Date: 2026-10-20.
- Automated expectations:
  - first paint contains World Imagery + Hybrid reference overlay;
  - persistent engine starts with `styleFor("hybrid")`;
  - toolbar primary control is Hybrid;
  - + menu includes Street, Terrain and Satellite;
  - Parking Layout preserves Hybrid as the selected default;
  - MapLibre failure retains geographic Hybrid, then Street fallback if Hybrid stalls.
- Manual checks after deploy:
  - reload on desktop/mobile and confirm Hybrid appears before interaction;
  - + menu switches to Street/Terrain/Satellite and back to Hybrid;
  - county outlines, parking clusters and #rank markers remain legible;
  - orientation/background/foreground recovery retains selected basemap.
- Status: pending CI and live review.

### MAP07 automated result — 2026-10-20
- Feature-branch regression suite: PASS (run #348).
- Main regression suite after merge: PASS (run #349).
- Verified contracts include Hybrid first-paint/default state, + menu secondary modes, Hybrid-to-Street degradation, existing clustering/count semantics and county-map regressions.
- Remaining gate: Pages run #277 completion plus visual mobile confirmation.

## QA-20261021-001 — Dense ranked-marker regression coverage

- Date: 2026-10-21.
- Automated checks added:
  - close detailed markers produce spider connector lines;
  - all ranked options remain present after fan-out;
  - detailed fan-out contains no residual cluster;
  - null availability produces no `0 FREE` label;
  - refreshed JS/CSS cache keys are present;
  - mobile map heights are 460px/480px at the intended breakpoints.
- Existing checks retained: national/county browse isolation, low-zoom clustering and rank order.
- Status: tests updated; CI pending.
