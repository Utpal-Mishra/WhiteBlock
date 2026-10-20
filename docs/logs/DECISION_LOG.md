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

