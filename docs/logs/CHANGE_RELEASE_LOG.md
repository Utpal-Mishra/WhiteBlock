# Change / Release Log

## CHANGE-20261003-001 — Bray seafront evidence pilot

- Date: 2026-10-03
- Branch: feature/bray-seafront-expansion-2026-10-03
- Added:
  - web/data/bray_parking_snapshot.json
  - web/bray-adapter.js
  - docs/logs/*
- Changed:
  - web/app.js
  - web/index.html
  - README.md
- Behavioural change: Bray becomes a supported evidence-pilot region in the static application.
- Data integrity rule: no live free-space values are introduced.
- Release state: merged to main as commit `b9269d82fd7d659a8843f861262f099403cc6b4a`; GitHub Pages deployment run #181 started from that commit.


## CHANGE-20261003-002 — Bray live-app sync correction

- Date: 2026-10-03
- Trigger: Bray implementation was present in PR #31 but not yet merged, so the deployed GitHub Pages app continued serving the previous main branch.
- Correction: PR #31 was merged after its tests completed successfully.
- Main commit: `b9269d82fd7d659a8843f861262f099403cc6b4a`.
- Deployment: GitHub Pages workflow run #181 was triggered from the merged commit.
- Current deployment state at log time: in progress; Cork City refresh and Dublin evidence acquisition completed successfully, County Cork snapshot build in progress.
- Integrity check: main now contains `web/bray-adapter.js` and the Bray script reference in `web/index.html`.
- Status: code synchronized to main; production Pages publication in progress.

## CHANGE-20261003-003 — Cross-region aerial evidence integration

- Date: 2026-10-03
- PR: #32.
- Added: imagery review target builder, temporary imagery review workflow, permanent imagery evidence sidecar, snapshot overlay script, imagery runbook and Kildare partial fallback builder.
- Changed: Pages deployment, Cork/Kildare/Dublin/Bray regional adapters, Discover, access/evidence UI and regional runtime wiring.
- Data change: 31 reviewed records receive imagery-review metadata at deployment; Bray stores the reviewed metadata directly as well.
- Release gates: tests + imagery workflow + merge + Pages deployment + deployed-artifact verification.
- Release state: feature branch pending final CI at entry time.

## CHANGE-20261004-001 — Mobile map hierarchy and layout correction

- Date: 2026-10-04.
- Branch: `fix/mobile-map-drilldown-layout-2026-10-04`.
- PR: #33.
- Changed: Ireland overview, map toolbar, parking-layout integration, Discover card CSS, Dublin evidence queue layout, runtime cache keys and regression tests.
- Behavioural change: the Ireland map now exposes regional/county totals, then locality clusters, then individual parking points; Street remains the startup basemap and secondary views are opened from a compact + menu.
- Coverage change: Bray is counted as a connected evidence pilot while remaining explicitly labelled as a Bray/County Wicklow pilot rather than whole-county coverage.
- Release state: implementation complete on feature branch; CI and Pages deployment gates pending.

## CHANGE-20261018-001 — Restore Cork/Kildare regional figures on national map

- Date: 2026-10-18.
- Branch: `fix/overview-region-counts-2026-10-18`.
- Changed: `ireland-overview.js/css`, `inventory-map-layer.js`, `bray-adapter.js`, runtime/index cache keys, tests and audit logs.
- Behavioural change:
  - national coverage view prioritises one regional summary card per connected region;
  - Cork/Kildare counts remain available even while adapter hydration is catching up by using the validated regional snapshot as fallback;
  - clustered individual parking markers are hidden during national/region browsing and return after a destination is committed.
- Release state: implementation complete on feature branch; PR/CI/Pages gates pending.

### Deployment update — 2026-10-18

- PR #34 merged to `main` as `a65e74ac6ca139fcdebc3fdc89c8c15a329b9fa5`.
- Feature-branch CI: PASS.
- GitHub Pages deployment run #254: PASS.
- Latest deployed regional evidence:
  - County Cork: 4,251 mapped locations / 4,087 mapped polygons;
  - County Kildare: 128 partial evidence anchors / 0 polygons;
  - County Dublin: 9,336 mapped locations.
- Release state: deployed successfully.

## RELEASE-20261019-WW01 — Wicklow county network feature
- Date: 2026-10-19; status: feature branch pending review/deployment.
- Change scope: exact-county builder, browser adapter, national map, Discover, Inventory Coverage, Pages generation and validation, unit tests, public source notes.
- Rollback: disable Wicklow script include / snapshot build if QA identifies wrongly promoted access, duplicates or broken regional navigation.

## RELEASE-20261020-WW01 — Wicklow/Bray coverage UI correction
- Date: 2026-10-20; status: branch, pending merge and Pages verification.
- Change: combine county coverage presentation while retaining two separate sourcing/adapters; remove duplicate filter across overview and Discover surfaces.
- Rollback: revert this commit if county aggregation omits Bray or doubles inventory values.

## RELEASE-20261020-WW02 — Legacy Bray map taxonomy cleanup
- Date: 2026-10-20; status: feature branch, pending tests and merge.
- Change: remove standalone Bray coverage marker in the base map, adjust Ireland status copy to 4 county networks, version-bump `app.js` to help invalidate prior client cache.
- Invariant: the Bray dataset stays independently ingested; Wicklow includes it for national summaries; country/region filters contain no fifth Bray option.
- Rollback: revert this targeted patch if regional navigation or Bray destination lookup is affected.

## RELEASE-20261020-CL01 — Zoomable recommendation clusters
- Change files: `web/parking-gl-overlay.js`, `web/runtime-config.js`, `tests/test_ranked_gl_clustering.js`, `.github/workflows/test.yml` plus logs.
- User-visible: national/region map no longer polluted by stale 01–07 labels; ranked parking locations aggregate and split according to zoom.
- Rollback: revert PR #38 if cluster click or source-overlay reset breaks destination selection.
- Status: awaiting PR checks and Pages deployment.

## RELEASE-20261020-MAP02 — All-region marker framework
- Change scope: shared marker policy, MapLibre ranked and Leaflet inventory overlays, county/locality browse, runtime imports, Node/CI tests and future-county onboarding documentation.
- QA gates: Cork/Kildare/Dublin/Wicklow incl. Bray and synthetic future counties share collapse/expand contract; fallback clustering works if plugin unavailable.
- Rollback: revert PR #39 if county navigation, source layer ownership or site zoom regress.
- Status: PR #39 pending merge and deployment.

### Scope extension — renderer ownership — 2026-10-20
- Changed Leaflet `map-engine-v2.js` ranked marker fallback and GL readiness handshake to prevent duplicate physical parking markers during loading and zoom changes. This is included in PR #39.

## RELEASE-20261020-MAP02 reconciliation — merged
- PR #39 merged to `main` on 2026-10-20, merge SHA `1f42ba2db19bb7ccddeaf9b78e78a1cd5af13562`.
- Branch CI `39459853465`: success, including Python suite, Node all-region/future-region policy test, ranked GL tests and JavaScript syntax.
- Main Pages deployment: `39459997110` started; production publication/device visual verification still pending at reconciliation time.
- Older releases #37/#38 were merged and their respective CI passed. This entry supersedes historical in-progress status notes without erasing them.

## RELEASE-20261020-MAP03 — Geographic map on WebGL/MapLibre failure
- Scope: global WHITEBLOCK map; `web/map-engine-v2.js` falls back to geographic Leaflet raster Street tiles (OSM then CARTO) rather than schematic, preserving markers.
- `web/parking-layout.js` requires explicit toggle, has Back to map and closes on Street/Terrain/Satellite selection.
- Asset version bumps, new mock Node failure and timeout test, updated map/layout Python contracts.
- PR #40: pending CI/Pages; manual Android confirmation still needed.

## RELEASE-20261020-MAP03 merged implementation
- PR #40 merged to `main`, commit `8cc276f4302a798042eb8b62610c3bc6fb48067d`.
- Branch CI `39467188332`: SUCCESS with simulated MapLibre initialization failure, style timeout and street tile backup regression, plus existing Python/unit tests.
- Main branch test run: `39467328613`; Pages publishing run: `39467328592`, both triggered at merge. Production/mobile smoke verification not yet completed.
- Previous “pending CI” notes reflect their original timestamps; this entry is the updated audit record.

## RELEASE-20261020-COV04 — Ireland-first all-parking regional drilldown
- PR #41: `web/ireland-overview.js` national county badges and count labels, county auto-fit/all parking clusters, late regional source handling, no repeated Ireland camera resets.
- `web/parking-layout.js`: optional schematic closes on coverage switch; asset version bumps for both modules.
- Tests: browser-free Ireland/county integration regression plus updated Python contracts and CI.
- Status: feature branch awaiting test/merge/publication and Android visual QA.

## RELEASE-20261020-COV04 — Merge and CI result
- PR #41 merged to `main` at `bf4e53b223e5435bcb16b49bd3cdfa68f05c4032` on 2026-10-20.
- Feature branch test run `39472300266`: SUCCESS. Main branch test run `39472445119`: SUCCESS.
- Pages deployment run `39472445106` launched at merge; actual live phone visual QA must be checked when publishing completes.
- All 15+ granular project logs were updated with architecture, data, UX, evidence, risks, test coverage and expansion rules.

## RELEASE-20261020-MAP04 — Mobile Street tile-integrity repair

- Date: 2026-10-20.
- Branch: `fix/mobile-map-tile-integrity-2026-10-20`.
- Code: `web/map-fix.js`, `web/map-engine-v2.js`, runtime/index cache keys and map regression tests.
- Behaviour: eliminates duplicate startup basemap creation; repairs map geometry on responsive/state changes; fails over stalled/partial raster grids automatically.
- Data: no inventory/evidence changes.
- Status: fix branch implemented; PR/CI/Pages/device validation pending.

## RELEASE-20261020-MAP05 — Selected-region border focus
- Date: 2026-10-20.
- Branch: `feat/region-boundary-focus`.
- Added: county-boundary config, deployment boundary builder, generated GeoJSON deployment step and validation.
- Changed: Ireland overview rendering and asset cache versions; selected county now receives an exact outline/fill layer.
- Data semantics: no parking records, counts, access rules, availability or capacity changed.
- Status: feature branch implementation complete; CI/Pages/mobile validation pending.

### MAP05 merge / deployment status — 2026-10-20
- PR #43 merged to `main` as `11e8677dce463592dd8402c3cd03daf03cf82b2d`.
- Feature-branch CI run #330: PASS.
- Main CI run #331: PASS.
- GitHub Pages run #274 started from the merge; its new **Build selected-region administrative boundaries** gate completed successfully before the regional parking snapshot refresh continued.
- Public Pages publication/mobile visual verification remains pending until run #274 completes.

## RELEASE-20261020-MAP06 — Parking marker semantic redesign
- Date: 2026-10-20.
- Branch: `feat/parking-marker-semantics`.
- Changed: ranked MapLibre overlay, Leaflet ranked fallback, county browse clusters, inventory clusters, result-card rank notation, CSS and cache versions.
- User-visible result: quantity clusters, ordinal ranks and live availability now have distinct visual/label semantics.
- Data semantics: unchanged.
- Status: feature branch implemented; CI/Pages/mobile review pending.

## RELEASE-20261020-MAP07 — Default Hybrid basemap
- Date: 2026-10-20.
- Branch: `feat/default-hybrid-map`.
- PR: #45.
- Changed: initial Leaflet first-paint map, persistent MapLibre basemap, compact toolbar, Parking Layout default-state logic, map-context styling, cache keys and regression tests.
- User-visible result: labelled aerial Hybrid is shown by default; all other modes are under +.
- Data semantics: unchanged.
- Status: feature branch implemented; CI/Pages/mobile validation pending.

### MAP07 merge status — 2026-10-20
- PR #45 merged to `main` as `2d447a8feb2101e3171e470f50fdd557d8f8178c`.
- Feature-branch CI run #348: PASS.
- Main CI run #349: PASS.
- GitHub Pages deployment run #277 started from the merge and is rebuilding the regional deployment artifact.
- Release state: merged and test-green; public Pages publication pending completion of run #277.

## CHANGE-20261021-001 — Ranked map spacing and mobile viewport correction

- Date: 2026-10-21.
- Branch: `fix/mobile-ranked-map-spacing-2026-10-21`.
- Changed: ranked MapLibre overlay, mobile map sizing, cache keys, universal marker documentation and regression tests.
- Behaviour: crowded detailed markers fan out rather than stack; real coordinates remain unchanged; unreported availability is blank rather than `0 FREE`.
- Mobile map: 460px at <=820px; 480px at <=520px.
- Release state: feature-branch implementation complete; CI/Pages gates pending.

### Deployment update — 2026-10-21

- PR #46 merged to `main` as `c3ef5d0d9221d9c4a8e80733ff22d938965ad055`.
- Feature-branch regression suite: PASS after updating the stale overlay cache-version assertion.
- GitHub Pages deployment run #283: PASS.
- Release state: live.

## CHANGE-20261027-001 — Phase 1.5 Parking Universe foundation

- Date: 2026-10-27.
- Branch: `phase-1-5/parking-universe-foundation-2026-10-27`.
- Added: source registry, coverage builder, deploy validation, Discover coverage UI, operating-model documentation and tests.
- Release state: branch implementation; CI/merge/deployment pending.
