# Automation Log

## AUTO-20261003-001 — Bray refresh remains manual/curated

- Date: 2026-10-03
- Current automation: none for Bray evidence ingestion.
- Reason: sources span council rules, mapped parking records, secondary listings and imagery; automatic promotion could create false legal/public assertions.
- Current method: curated snapshot with explicit provenance and confidence.
- Automation candidate: scheduled source-refresh job that stages changes, hashes evidence, flags changed rules/coordinates/capacity and requires reconciliation before promotion.
- Trigger to automate: stable source contracts plus repeatable validation tests.
- Risk control: do not automate imagery-to-public-parking promotion.
- Status: backlog.

## AUTO-20261003-002 — Controlled aerial imagery review workflow

- Date: 2026-10-03
- Workflow: .github/workflows/imagery-review.yml.
- Automation: selects high-priority open/missing-geometry records, fetches temporary aerial frames/metadata, creates contact sheets and a manifest, and uploads a seven-day review artifact.
- Human gate: imagery conclusions are not auto-promoted; the permanent evidence file records human-reviewed outcomes only.
- Current first-pass selection: up to 8 spatially distributed targets per region; Bray had 7 total records.
- Future automation: expand in repeatable batches while retaining human or separately validated CV review before any geometry promotion.
- Status: operational.

## AUTO-20261019-WW01 — Scheduled Wicklow snapshot generation
- Date: 2026-10-19; status: configured, awaits successful Pages run.
- Source refresh: existing Pages deployment workflow invokes County Wicklow OSM builder; validates relation ID, source integrity, non-live semantics and Bray exclusion.
- Failure path: no snapshot released if the external feed fails. No invented fallback counts.
- Evidence: GitHub Actions log and per-snapshot generated_at/source metadata.

## AUTO-20261020-CL01 — Regression gating for ranking/map clusters
- Trigger: PR #38 adds `node tests/test_ranked_gl_clustering.js` to CI and a JavaScript syntax check for `web/parking-gl-overlay.js`.
- Checks: browse-mode empty overlay; seven sample locations merge into one at low zoom, expand into seven at zoom 17, and cluster tap zooms rather than fabricates a location.
- Source/data: deterministic local fixture only, no live occupancy feed or external Overpass needed in CI.
- Status: CI pending at entry creation.

## AUTO-20261020-MAP02 — Universal clustering CI release gate
- PR #39 adds a pure Node policy test, existing ranked GL regression and syntax checks to `.github/workflows/test.yml`.
- Deterministic 7-site fixtures for Cork, Kildare, Dublin, Wicklow, Galway and Donegal, plus Bray nested/duplicate-Cork guard and script integration.
- Region adapters still refresh source-backed JSON independently; new county onboarding requires valid snapshot before county activation.

## AUTO-20261020-MAP03 — Geographical fallback CI
- `tests/test_geographic_map_fallback.js` tests immediate MapLibre exception and style watchdog timeout, real raster tile attachment, backup street tiles and no automatic Parking Layout activation.
- Existing marker/ranked/county regression suite retained; Python layout/map engine version and fallback expectations updated.
- PR #40 CI / main Pages deployment to be recorded after conclusion.

## AUTO-20261020-COV04 — Country/county regression gate
- `tests/test_ireland_county_map.js`: simulated browser/map DOM, national 4 badges and counts, Cork & Dublin auto-fit to all assets, zoom 17 reveals individual sites, Ireland reset, no camera resets on inventory refresh, Wicklow pilot then county load.
- `.github/workflows/test.yml` includes Node integration test alongside previous all-region marker tests and full Python suite.
- Initial status: PR #41; awaiting CI conclusion and mobile production verification.

## AUTO-20261020-MAP04 — Automatic incomplete-tile-grid recovery

- Date: 2026-10-20.
- Trigger: raster fallback begins after MapLibre/WebGL failure or explicit raster mode.
- Automation:
  - count tile failures;
  - detect a raster layer that never reaches Leaflet's full `load` event;
  - after 3.2 s, automatically switch an incomplete OSM Street grid to the alternate Street provider;
  - responsive container changes automatically schedule geometry repair.
- Guardrails: no automatic switch to Parking Layout; no parking data or recommendation state is modified.
- Status: implemented.

## AUTO-20261020-MAP05 — Boundary build and deployment gate
- Date: 2026-10-20.
- Pages now builds `web/data/ireland_region_boundaries.geojson` before publishing.
- Primary refresh: exact OSM relation geometry through Overpass.
- Recovery: if the live refresh fails, reuse the last published boundary layer; first-deploy fallback uses pinned OSM-derived county GeoJSON with relation-ID validation.
- Validation: deployment requires exactly Cork 332631, Kildare 285833, Dublin 282800 and Wicklow 282760 with Polygon/MultiPolygon geometry.
- Status: implemented.

## AUTO-20261020-MAP06 — Zoom-driven semantic transition
- Date: 2026-10-20.
- Behaviour: universal screen-distance clustering automatically changes nearby ranked results from `N OPTIONS` to separate `#N` markers as zoom reaches detail level.
- Reverse behaviour: zooming out recombines nearby recommendations into the explicit option-count cluster.
- No live availability is generated during clustering; availability labels are copied only from source-backed result records.
- Status: implemented.

## AUTO-20261020-MAP07 — Default Hybrid degradation chain
- Date: 2026-10-20.
- Automatic recovery:
  1. MapLibre Hybrid;
  2. Leaflet Hybrid using imagery + reference overlay;
  3. Street raster when Hybrid imagery stalls/errors;
  4. alternate Street raster when the first Street source also stalls/errors.
- Existing 3.2 s incomplete-grid watchdog and responsive geometry repair remain active.
- Status: implemented.

## AUTO-20261021-001 — Automatic re-layout of ranked markers by zoom

- Date: 2026-10-21.
- Automation: the ranked overlay recalculates grouping/collision state on every map `zoomend`.
- Low/medium zoom: nearby recommendations remain clustered.
- Detailed zoom: residual screen collisions automatically fan out; no county-specific manual marker layout is required.
- Trigger scope: destination results across all regions.
- Status: implemented.

## AUTO-20261027-001 — Recompute Parking Universe progress on every Pages build

- Date: 2026-10-27.
- Trigger: GitHub Pages deployment after regional snapshots and imagery evidence are assembled.
- Action: build and validate `parking_universe_coverage.json`.
- Failure rule: publication fails if the report loses the completeness guardrail, connected-region set or all deployed parking assets.
- Status: implemented.

## AUTO-20261027-001 — Recompute Parking Universe progress on every Pages build

- Date: 2026-10-27.
- Trigger: GitHub Pages deployment after regional snapshots and imagery evidence are assembled.
- Action: build and validate `parking_universe_coverage.json`.
- Failure rule: publication fails if the report loses the completeness guardrail, connected-region set or all deployed parking assets.
- Status: implemented.

## AUTO-20261027-001 — Deploy-time evidence review queue

- Date: 2026-10-27.
- Automation: every Pages build derives `parking_universe_review_queue.json` from current regional snapshots.
- Prioritisation: missing coordinates > unknown access > candidate state > missing rules > missing capacity > missing polygon.
- Safety: the queue is diagnostic only and does not promote, reject or alter recommendation eligibility automatically.
- Status: implemented.

## AUTO-20261027-002 — Recompute Phase 2 decision factors on arrival/stay changes

- Date: 2026-10-27.
- Trigger: existing arrival and duration change events.
- Automated effects: re-evaluate session eligibility, recalculate walking/session-cost factors, re-rank results and refresh explanations.
- Safety: ambiguous pricing stays non-comparable instead of receiving an inferred numeric cost.
- Status: implemented.

## AUTO-20261027-002 — Automatic exclusion of unknown factors from ranking credit

- Date: 2026-10-27.
- Automation: every ranking pass now checks evidence availability before applying factor weights.
- No manual region-specific handling is required.
- Scope: all current and future regions using the shared Phase 2 session/ranking engine.
- Status: implemented.
