# Product / Feature Log

## PROD-20261003-001 — Bray coverage in Find and Ireland Coverage View

- Date: 2026-10-03
- Feature: Bray added as a live evidence-pilot coverage node and fallback searchable destination.
- UI changes: application shell now describes Cork + Bray pilots; Ireland overview includes Bray.
- Find behaviour: Bray destinations can return regional evidence-backed parking assets using existing ranking/cards/map.
- Evidence behaviour: live availability is explicitly unknown when unsupported.
- User value: a beach/seafront destination is no longer treated as outside supported parking coverage.
- Status: implemented on feature branch.

## PROD-20261003-002 — Aerial evidence visibility in WHITEBLOCK

- Date: 2026-10-03
- Feature: regional records can display aerial-review state in Find cards, Discover inventory and Evidence summary.
- Region coverage: Cork, Kildare, Dublin and Bray are wired into the application runtime.
- Discover: Bray is added as a fourth evidence region/filter.
- Kildare: app accepts a clearly labelled partial evidence-anchor fallback when full county refresh is unavailable.
- UX principle: imagery evidence is described as physical-supply evidence, never as live availability.
- Status: implemented on PR #32.

## PROD-20261004-001 — Hierarchical parking coverage map and compact controls

- Date: 2026-10-04.
- Feature: hierarchical national parking exploration.
- Flow: Ireland overview → connected region/county → city/town/settlement group → individual mapped parking points.
- National nodes: show mapped location count plus published/known capacity where available; live free-space totals appear only when a source reports them.
- Mobile control: Street is visible/default; Terrain, Satellite, Street View and Parking Layout are available from a + menu.
- Readability: long Discover parking names wrap; evidence research rows collapse from four columns to two/one columns on narrow screens.
- Status: implemented in PR #33.

## PROD-20261018-001 — Persistent regional count cards in Ireland overview

- Date: 2026-10-18.
- Feature correction: regional map cards now persistently expose mapped/evidence-backed location totals for Cork, Kildare, Dublin and Bray.
- Count source order: hydrated canonical regional inventory first; validated deployment snapshot rows/summary as fallback.
- Visual hierarchy: location total is the strongest line in the regional card; published capacity and reported free-space totals remain secondary and appear only where evidence exists.
- Browse behaviour: individual clustered parking markers are intentionally suppressed until the user drills into a region/locality or commits a destination.
- Status: implemented; deployment validation pending.

## PROD-20261018-002 — Parking Universe Registry

- Date: 2026-10-18.
- Product capability: represent all known/plausible parking supply in the canonical registry, including assets that are not currently recommendable.
- Required states: verified public, customer/time-limited, permit/restricted, private/shared, temporary/event, unknown access, unverified candidate and closed/removed history.
- Recommendation boundary: only assets meeting access/rule/evidence criteria may be recommended; candidate/restricted records remain visible to the evidence and coverage systems.
- Partnership boundary: partnership status enriches an asset rather than creating the asset.
- Status: roadmap/design adopted.

## FEAT-20261019-WW01 — Wicklow browse and search
- Date: 2026-10-19; status: feature branch awaiting integration validation.
- UI: Wicklow connected-region summary, selectable focus, town grouping, destination parking markers, Discover filtering and search inventory.
- Labels: mapped/evidence-backed inventory, not live parking availability or county completeness.
- Regression controls: existing Bray pilot and other regional views retained.

## FEAT-20261020-WW01 — Remove duplicate Bray county filter
- Date: 2026-10-20; status: branch.
- UX contract: national and inventory-region filters list exactly Cork, Kildare, Dublin and Wicklow. Bray appears inside Wicklow as a locality; clicking Wicklow shows its parking plus Bray locations.
- Provenance: individual Bray source remains labelled as the seafront pilot.

## FEAT-20261020-WW02 — County-only coverage markers and preserved town search
- Date: 2026-10-20; feature scope: remove a legacy Bray top-level map marker that visually suggested an additional county; county navigation remains Cork, Kildare, Dublin and Wicklow.
- Bray remains a named Wicklow locality and searchable destination; curated parking evidence and Wicklow county aggregation are unchanged.
- Implementation: `web/app.js` legacy marker/status cleanup; cache version bump for initial HTML entry.
- Status: awaiting PR validation; no standalone Bray region/filter expected.

## FEAT-20261020-CL01 — Map aggregation and expanding ranked markers
- User report: mobile Cork numbered 01–07 map symbols overlap when zooming out, including Ireland coverage mode.
- Behaviour: no destination ranks over national/region county cards; low-zoom clustered badge shows aggregate parking-location count, tap zooms; higher zoom reveals 01–07 at true positions.
- Existing large-inventory MarkerCluster remains available and sourced independently.
- Status: PR #38 pending CI and publication smoke check.

## FEAT-20261020-MAP02 — Universal cluster and locality drill-down
- UX: national county totals -> clustered county locality cards -> grouped parking markers -> individual true-coordinate site points, with tap-to-zoom.
- Cork, Kildare, Dublin, Wicklow/Bray currently supported. Subsequent source-backed county networks inherit the grouping policy without special case scripts.
- Removed former locality detail rendering limit of 300 items: broader view aggregates full evidence inventory, high zoom filters to map viewport.
- Status: feature PR #39, CI/mobile QA pending.

## FEAT-20261020-MAP02 integration status
- PR #39 integrated into `main`; branch CI passed on 2026-10-20.
- All connected region and future county map marker renderers consume the shared zoom policy, with legacy renderer handoff and no-CDN fallback.
- Release to GitHub Pages and mobile acceptance remain open at time of log entry.

## FEAT-20261020-MAP03 — Geographic map first, optional parking diagram
- Defect: Cork user's Spatial Layer showed “Parking Layout · 3 nearby” black radial schematic instead of streets even with Street selected.
- Update: geographic Street map remains primary; on renderer failure use raster tiles; Parking Layout only opens on explicit user selection.
- Added in-panel Back to map button and close-on-basemap click; Street state no longer appears simultaneously active with schematic.
- Scope: all current/future geographical regions, not Cork-specific.

## FEAT-20261020-COV04 — Ireland-wide coverage and direct county parking map
- Ireland selected: geographical island-scale overview with one linked county badge and mapped parking-location total per connected county, distinct from sourced vacant-bay figures.
- County selected: zoom to all valid parking sites across that region and display adaptive count clusters immediately; pinch/tap zoom expands actual individual parking locations.
- Wicklow directly includes Bray as locality source; future source-backed counties inherit existing global marker policy.
- Optional Parking Layout closes on coverage action so the map remains geographical.
- Status: PR #41, pending CI and live mobile acceptance.

## FEAT-20261020-MAP04 — Full-card geographic Street recovery

- Date: 2026-10-20.
- User-visible requirement: Street mode must fill the complete map card on mobile; isolated checkerboard tiles are not an acceptable degraded state.
- Recovery behaviour: vector Street when healthy; otherwise geographic raster Street with automatic alternate-provider failover on errors or incomplete loading.
- Interaction preservation: Ireland/county drilldown, parking markers, + menu and optional Parking Layout remain unchanged.
- Status: implemented on fix branch.

## FEAT-20261020-MAP05 — Highlight selected county boundary
- Date: 2026-10-20.
- User-visible behavior: selecting Cork, Kildare, Dublin or Wicklow draws the county outline on the map so the active region is immediately obvious.
- The border remains visible while viewing county parking clusters and individual sites.
- Switching region replaces the outline; returning to Ireland or selecting a destination removes it.
- Styling: high-contrast lime outline, subtle translucent green interior.
- Status: implemented on feature branch.

## FEAT-20261020-MAP06 — Clear parking option marker language
- Date: 2026-10-20.
- Destination search:
  - nearby grouped results show `N OPTIONS`;
  - individual recommendations show `#1`, `#2`, etc.;
  - reported live free spaces appear separately as `N FREE`;
  - missing live data appears as `LIVE —`.
- County/general browse:
  - clustered mapped parking displays `N LOCATIONS`;
  - individual browse points carry no ordinal number.
- Result cards now use the same `#N` ordinal notation as the map.
- Status: implemented.

## FEAT-20261020-MAP07 — Hybrid default map
- Date: 2026-10-20.
- Default map now combines aerial imagery with road/place labels.
- Always-visible toolbar: `Hybrid` + `+`.
- + menu: Street, Terrain, Satellite, Street View and Parking Layout.
- Satellite remains imagery-only so users can deliberately remove labels when needed.
- Status: implemented on feature branch.

## PROD-20261021-001 — Mobile dense-parking fan-out

- Date: 2026-10-21.
- Feature: detailed destination maps automatically fan overlapping ranked parking options into individually readable `#1…#N` markers.
- Visual aid: each displaced marker has a connector to its true location.
- Mobile viewport: map receives materially more vertical space for dense urban parking.
- Availability: unreported live availability no longer displays as zero.
- Status: implemented on feature branch.

## PROD-20261027-001 — Discover · Parking Universe Coverage

- Date: 2026-10-27.
- Feature: new Phase 1.5 section in Discover.
- Displays per connected region: deployed known assets, access/capacity/rules/polygon resolution, integrated source families, ready-next sources and remaining gaps.
- Product copy explicitly distinguishes programme progress from literal parking completeness.
- Status: implemented on Phase 1.5 branch.

## PROD-20261027-001 — Phase 1.5 evidence-resolution workload in product

- Date: 2026-10-27.
- Feature: Parking Universe cards now expose evidence-review task count, unresolved-access count and deployed source-backed candidate count per region.
- Programme summary: shows total assets and total evidence-resolution workload side by side.
- Purpose: make coverage work operationally visible instead of presenting only a readiness percentage.
- Guardrail: review-task counts are not missing-parking counts or real-world completeness percentages.
- Status: implemented on Phase 1.5 branch.

## PROD-20261027-002 — Phase 2 Destination-First Experience completed

- Date: 2026-10-27.
- Completed driver capabilities:
  - destination search;
  - arrival/stay controls;
  - closest / lowest-cost / best-overall modes;
  - accessible and EV constraints;
  - walking estimate;
  - safely calculable session-cost estimate;
  - rules/stay compatibility;
  - transparent ranking explanation;
  - source/freshness/truth-state/confidence display;
  - ineligible-option transparency.
- Phase boundary: navigation/session reminders/operator hand-off remain trip-execution work, not Phase 2 blockers.
- Status: complete.

## PROD-20261027-002 — Phase 2 ranking explanation now identifies missing evidence

- Date: 2026-10-27.
- Driver-facing behaviour: Best Overall explanation states that unknown ranking factors receive no ranking credit.
- Existing Phase 2 capabilities remain unchanged: destination/stay controls, closest/lowest-cost/best modes, EV/accessibility constraints, session fit, walk/cost estimates, evidence metadata and excluded-option transparency.
- Status: Phase 2 fully closed after audit.

## PROD-20261027-003 — Future-arrival historical availability annotation

- Date: 2026-10-27.
- Find behavior: when the selected arrival is at least 20 minutes in the future and sufficient history exists, a recommendation card can show historically free spaces, empirical chance of at least one space, supporting sample count, bucket method and history-strength indicator.
- Network behavior: the former forecast card reports actual Phase 3 history/baseline coverage instead of presenting an unsupported forecast.
- Guardrail: the card explicitly states that the experimental baseline is not yet used to rank.
- Cold-start behavior: insufficient history shows no forecast value.
- Status: implemented on Phase 3 branch.
