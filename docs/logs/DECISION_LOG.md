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
