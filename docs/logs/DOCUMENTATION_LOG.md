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

## DOC-20261020-MAP04 — Basemap ownership/recovery documentation

- Date: 2026-10-20.
- Updated project audit trail to record the mobile checkerboard incident, single-renderer architecture, incomplete-grid watchdog, responsive geometry repair and device QA gate.
- No user-data, source-data or commercial-integration documentation changed.
- Status: documented with implementation.

## DOC-20261020-MAP05 — Selected-region boundary design
- Date: 2026-10-20.
- Documented the county relation configuration, GeoJSON build/recovery path, rendering pane, state transitions, risks and QA expectations.
- No commercial/partner workflow changed.

## DOC-20261020-MAP06 — Parking marker semantic language
- Date: 2026-10-20.
- Documented the explicit map-number vocabulary: `OPTIONS` for grouped ranked results, `LOCATIONS` for browse/inventory clusters, `#N` for ordinal recommendation rank, and separate live-space labels.
- Updated QA expectations so future marker changes cannot reintroduce bare-number ambiguity.
- Status: documented with implementation.

## DOC-20261020-MAP07 — Default map-mode contract
- Date: 2026-10-20.
- Documented Hybrid composition, + menu hierarchy, recovery order, provider lifecycle risk and QA expectations.
- Clarified that pure Satellite remains a separate secondary view.
- Status: documented with implementation.

## DOC-20261021-001 — Universal marker policy updated for dense detailed locations

- Date: 2026-10-21.
- Document: `docs/UNIVERSAL_MARKER_POLICY.md`.
- Added: detailed collision check, display-only spider fan, connector-line semantics and canonical-coordinate immutability.
- Status: updated.

## DOC-20261027-001 — Parking Universe operating model

- Date: 2026-10-27.
- Added `docs/PARKING_UNIVERSE_COVERAGE.md`.
- Updated `docs/DATA_SOURCES.md` and roadmap to mark Phase 1.5 ACTIVE and connect the machine-readable source registry.
- Status: complete for foundation slice.

## DOC-20261027-001 — Phase 1.5 implementation status expanded

- Date: 2026-10-27.
- Updated: `docs/ROADMAP.md` and `docs/PARKING_UNIVERSE_COVERAGE.md`.
- Documented: canonical state separation, partner enrichment boundary, shared evidence-review artifact and Phase 1.5 operating loop.
- Status: complete for tranche 1.

## DOC-20261027-002 — Phase 2 closure documented

- Date: 2026-10-27.
- Updated: `docs/ROADMAP.md`.
- Clarified: Phase 2 completion criteria, conservative cost-estimation guardrail and boundary between parking decision and later trip-execution capabilities.
- Status: complete.

## DOC-20261027-002 — Phase 2 marked complete after re-audit

- Date: 2026-10-27.
- Updated: `docs/ROADMAP.md`.
- Clarified: Phase 2 is complete and re-audited; evidence-only ranking removes the last hidden scoring assumption.
- Phase boundary remains unchanged for trip-execution capabilities.
- Status: updated.

## DOC-20261027-003 — Document Phase 3 availability-intelligence foundation

- Date: 2026-10-27.
- Added `docs/PHASE3_AVAILABILITY_INTELLIGENCE.md` covering data flow, model hierarchy, cold-start behavior, guardrails, evaluation gates and next increments.
- Updated the roadmap to mark Phase 3 active without marking its exit condition complete.
- Status: implemented on Phase 3 branch.
