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

