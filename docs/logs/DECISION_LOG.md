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
