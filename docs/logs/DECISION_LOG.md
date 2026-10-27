# Decision Log

## DEC-20261003-001 — Expand WHITEBLOCK to Bray using evidence-backed regional data

- Date: 2026-10-03
- Decision: add Bray now as an evidence pilot rather than wait for a Cork-equivalent live feed.
- Rationale: the product thesis includes parking-supply discovery, not only live car-park feeds; Bray provides a strong test of heterogeneous evidence.
- Chosen approach: curated regional snapshot + adapter + shared UI.
- Rejected alternative: hard-code demo parking/availability values.
- Rejected alternative: infer current free spaces from historical aerial imagery.
- Rejected alternative: treat every nearby business-directory listing as a distinct parking asset.
- Consequence: Bray can be searched and mapped with transparent uncertainty while live occupancy remains unknown.
- Status: accepted/implemented on feature branch.

## DEC-20261003-002 — No imagery-only canonical parking promotion

- Date: 2026-10-03
- Decision: aerial imagery may confirm physical parking or create a geometry follow-up candidate, but cannot by itself create verified public parking, live availability or automatic canonical geometry.
- Rationale: imagery lacks reliable legal-access, signage and live-state semantics and can be stale.
- Implementation: metadata-only evidence sidecar + human review + build-time overlay.
- Consequence: negative and ambiguous imagery evidence is retained rather than forcing every mapped point into a parking polygon.
- Status: accepted.

## DEC-20261004-001 — Make Street the only always-visible map mode

- Date: 2026-10-04.
- Decision: keep Street as the startup and always-visible map mode; move Terrain, Satellite, Street View and Parking Layout behind a compact + control.
- Rationale: mobile map space is more valuable than permanently exposing infrequently used basemap/context controls.
- Alternative rejected: horizontally scrolling the existing five-button toolbar, because it obscures the map and makes the primary/default mode visually ambiguous.
- Related decision: regional clicks should reveal locality-level parking groups rather than a second single regional marker.
- Accessibility: + uses aria-label/expanded/haspopup and Escape closes the menu.
- Status: accepted/implemented in PR #33.

## DEC-20261018-001 — Never use the full inventory cluster layer as the national summary

- Date: 2026-10-18.
- Decision: the Ireland default map must use explicit regional summary cards, not incidental MarkerCluster counts, to communicate coverage.
- Reason: cluster counts depend on zoom/radius and can combine nearby regions, so they are not reliable county-level figures.
- Count semantics: regional location totals are evidence-backed inventory counts; Kildare must retain its partial-fallback label when the exact-boundary refresh is unavailable.
- Consequence: clustered parking is deferred to destination/detail context, while national navigation remains stable and interpretable.
- Status: accepted.

## DEC-20261018-002 — Build the parking universe before partnerships

- Date: 2026-10-18.
- Decision: WHITEBLOCK should maintain a canonical record for every known or plausible parking asset in the target geography before commercial partnerships become the main expansion lever.
- Separation: physical existence, access, rules, recommendation eligibility and partnership/commercial status are distinct fields/states.
- Consequence: a non-partner asset may still exist in the registry as verified public, customer-only, permit/restricted, private/shared, temporary, unknown-access, unverified candidate or closed/historical.
- Partnership role: enrich an existing asset with operator verification, booking/payment, trusted occupancy/capacity feeds, session management or partner-specific access/benefits.
- Caveat: literal 100% real-world completeness cannot be guaranteed because parking supply and rules change; the operational target is source/geographic coverage completeness with continuous revalidation.
- Status: accepted.

## DEC-20261019-WW01 — Wicklow inventory separate from Bray pilot
- Date: 2026-10-19; decision: include exact-county OSM mapped parking outside the existing Bray 5 km evidence pilot, preserving Bray as a separately sourced locality pilot within County Wicklow.
- Rationale: broaden useful parking knowledge without duplicating Bray records or implying live availability.
- Alternatives rejected: approximate rectangular OSM county query; invented capacity/occupancy; wholesale application of town-wide by-law rates; partnership-dependent initial inventory.
- Risk accepted: current OSM coverage is incomplete, and some records have unresolved access/restriction evidence.
- Status: implemented on branch, subject to live-source and CI validation.

## DEC-20261020-WW01 — County-level navigation with Bray as a Wicklow locality
- Date: 2026-10-20; decision: remove Bray as a standalone national coverage region/filter and fold its locations under County Wicklow.
- Rationale: consistent administrative hierarchy with Cork, Kildare and Dublin. A locality-level evidence pilot must not look like a fifth county.
- Keep: independent Bray curated source data, IDs, 5 km overlap guard and individual tariff/restriction evidence.
- Scope: overview, Discover, Inventory Coverage, local city drill-down and national county counts.
- Status: feature branch, CI/deployment review pending.

## DEC-20261020-WW02 — Eliminate legacy Bray top-level map coverage marker
- Date: 2026-10-20; decision: only county networks receive top-level map coverage nodes. Bray stays a Wicklow locality and retains its independently sourced seven-asset pilot inventory and search destinations.
- Identified root cause: the older `web/app.js` coverage-area list still contained Bray even though the newer Ireland switcher, Discover and Inventory Coverage were already county-normalized.
- Action: remove only that legacy coverage marker and stale status copy; retain destination search and OSM Bray overlap exclusion. No changes to capacity, pricing, evidence, availability or geolocation.
- Status: proposed fix on `fix/remove-legacy-bray-region-marker-20261020`; QA and production verification required.

## DEC-20261020-CL01 — Two-layer clustering without inventing locations
- Decision: keep existing all-inventory Leaflet clustering and add zoom-aware grouping to the separate MapLibre ranked-results overlay; suppress ranked overlay in Ireland/county browsing.
- Alternative rejected: shift map coordinates to avoid visual overlap or expose multiple numbered circles at small map scales; these misstate actual site positions.
- Thresholds: 56px connected-distance at zoom <17; polygons at >=14; higher zoom keeps per-location rank.
- Status: implementation on PR #38, subject to CI/mobile acceptance.

## DEC-20261020-MAP02 — Universal rather than regional marker implementation
- Decision: centralise clustering at shared renderer level; automatically register future validated county snapshots. No new county-specific marker algorithms.
- Guardrails: counts mean mapped parking locations (not vacant bays), original coordinates and source evidence unchanged.
- Rationale: prevent recurrence of Cork 01–07 overlap as WHITEBLOCK scales geographically.

## DEC-20261020-MAP03 — No forced Parking Layout fallback
- Accepted: MapLibre first; actual Leaflet geographic raster map on failure; optional user-selected schematic only.
- Rejected: programmatically click Parking Layout when style times out and obscure road geography; false Street active indicator while schematic is displayed.
- Reason: driving/parking decisions require true road topology; schematic is supplementary only.
- Status: implemented on PR #40, pending CI/deployment/device acceptance.

## DEC-20261020-COV04 — County selection means full mapped parking coverage
- Decision: Ireland always displays island-wide geographic bounds and current connected county totals. County selection auto-fits the whole mapped regional inventory and renders clustered individual assets, without mandatory town intermediary.
- Alternative rejected: only show locality labels when a county is selected. This hides actual parking inventory behind an extra tap, contrary to the user intent.
- Counts: label “mapped parking locations”; source-reported live vacant bays only where evidence exists, otherwise “Vacancies unverified”.
- State transitions: explicit Ireland/county actions control camera, ordinary asynchronous refresh updates markers/stats without recentering.

## DEC-20261020-MAP04 — Single-owner geographic basemap with completion watchdog

- Date: 2026-10-20.
- Decision: retire legacy startup basemap creation from `map-fix.js`; `map-engine-v2.js` owns persistent basemap lifecycle.
- Decision: raster fallback is considered healthy only after its visible tile grid completes, not merely because at least one tile rendered.
- Decision: incomplete OSM Street fallback automatically tries alternate geographic Street tiles; never auto-open Parking Layout.
- Rationale: mobile map integrity is more important than retaining a particular basemap provider.
- Status: accepted/implemented.

## DEC-20261020-MAP05 — Selected county gets an exact border
- Date: 2026-10-20.
- Decision: county selection must communicate focus using an exact published administrative outline in addition to camera zoom.
- Rejected: rectangular coverage boxes, marker convex hulls and approximate hand-drawn borders.
- Ireland default remains uncluttered; the strong outline appears only for the selected county.
- Status: accepted/implemented.

## DEC-20261020-MAP06 — Use nouns and ordinal prefixes to remove numeric ambiguity
- Date: 2026-10-20.
- Decision: cluster quantities must include `OPTIONS` or `LOCATIONS`; recommendation positions must use `#N`; live spaces must be visually separate.
- Rejected: continuing with bare numeric circles differentiated only by colour.
- Reason: colour is insufficient and the same numeral can otherwise encode three different concepts.
- Status: accepted/implemented.

## DEC-20261020-MAP07 — Make Hybrid the product default
- Date: 2026-10-20.
- Decision: labelled aerial Hybrid replaces Street as the startup/default basemap.
- Secondary modes: Street, Terrain and pure Satellite move under +; Street View and Parking Layout remain contextual tools in the same menu.
- Reason: Hybrid provides real physical context while retaining road/place orientation, which is more useful for parking/spatial intelligence.
- Rejected: pure Satellite as default because missing labels reduces orientation; Street as default because it hides physical parking context.
- Status: accepted/implemented.

## DEC-20261021-001 — Do not solve marker overlap by deleting evidence-backed parking records

- Date: 2026-10-21.
- Decision: keep canonical records intact and solve dense destination-marker collisions in the presentation layer.
- Chosen approach: screen-space collision detection plus display-only spider fan and connector lines.
- Rejected approach: arbitrary coordinate jitter persisted into inventory.
- Rejected approach: dropping records solely because they are geographically close.
- Separate follow-up: true duplicate/alias reconciliation remains a data-quality task and should be evidence-driven.
- Status: accepted.

## DEC-20261027-001 — Start Phase 1.5 with measurable source-universe coverage

- Date: 2026-10-27.
- Decision: Phase 1.5 is active and begins with a machine-readable source registry, deployment audit and product-visible gap dashboard.
- Reason: parking discovery work must be measurable before large-scale source ingestion; otherwise “complete coverage” becomes an untestable claim.
- Next decision boundary: integrate official ready sources and reconcile them into canonical identities without weakening existing evidence/access rules.
- Status: accepted/implemented.

## DEC-20261027-001 — Make evidence-resolution backlog a first-class Phase 1.5 artifact

- Date: 2026-10-27.
- Decision: do not manage Parking Universe completeness only through aggregate percentages.
- Chosen approach: generate a durable, source-backed review queue on every deployment and surface its counts in the UI.
- Rationale: Phase 1.5 needs an actionable list of unresolved access/rules/capacity/geometry/candidate work.
- Rejected: treating browser-local candidate storage as a shared project queue.
- Status: accepted/implemented.

## DEC-20261027-002 — Close Phase 2; keep trip execution outside its exit gate

- Date: 2026-10-27.
- Decision: Phase 2 is complete once WHITEBLOCK can return an evidence-backed ranked parking answer with visible stay compatibility, walking estimate, conservative session cost, explanation and provenance.
- Not required for Phase 2 exit: turn-by-turn navigation, parking-session timers/reminders, walking-route execution, booking/payment hand-off.
- Reason: those capabilities act on a chosen parking decision; they do not determine whether WHITEBLOCK can make the decision.
- Status: accepted.
