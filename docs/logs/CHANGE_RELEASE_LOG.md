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
