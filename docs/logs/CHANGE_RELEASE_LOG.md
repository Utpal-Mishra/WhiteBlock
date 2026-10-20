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
