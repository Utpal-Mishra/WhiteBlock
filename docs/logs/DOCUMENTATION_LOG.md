# Documentation Log

## DOC-20261003-001 — Aerial imagery review documentation

- Date: 2026-10-03
- Added: docs/IMAGERY_REVIEW_RUNBOOK.md.
- Covers: review purpose, four evidence states, geometry actions, target-selection rules, provider/provenance policy, app integration, Kildare fallback, and QA checklist.
- README: updated with the first cross-region review summary and Kildare continuity policy.
- Status: current for review ID WB-IMG-20261003-001.

## DOC-20261019-WW01 — Wicklow network documentation
- Date: 2026-10-19; status: feature branch.
- Added docs/WICKLOW_NETWORK.md with scope, provenance, no-live policy, priority town/seasonal locations, official rule references and acceptance tests.
- Follow-up: record exact deployment asset counts, source freshness, missing localities and human verification evidence once produced.

## DOC-20261020-WW01 — Administrative hierarchy contract
- Date: 2026-10-20; status: branch.
- Updated: docs/WICKLOW_NETWORK.md clarifies one Wicklow county filter containing Bray, with separate ingestion/evidence provenance retained internally.

## DOC-20261020-MAP02 — Marker/onboarding reference
- Source: `docs/UNIVERSAL_MARKER_POLICY.md` specifies nationwide hierarchy, fallback, default zoom, future source-backed county registration and QA.
- Authoritative runtime: `web/parking-marker-policy.js`, associated regression tests and per-region evidence files.

## DOC-20261020-MAP03 — Geographic map and optional schematic semantics
- Changed map fallback architecture: actual Street vector -> actual raster Street -> alternate street tiles; Parking Layout stays an optional analytical diagram.
- Relevant implementation: `web/map-engine-v2.js` and `web/parking-layout.js`; regression `tests/test_geographic_map_fallback.js`.

## DOC-20261020-COV04 — Ireland geographic navigation
- Updated Ireland navigation design and CI contract: island-wide county totals, direct all-location county map, evidence-based availability labels and no background camera changes.
- References: `web/ireland-overview.js`, `tests/test_ireland_county_map.js`, existing `docs/UNIVERSAL_MARKER_POLICY.md`, and audit logs.

