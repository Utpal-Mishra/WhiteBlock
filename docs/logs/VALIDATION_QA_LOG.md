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
