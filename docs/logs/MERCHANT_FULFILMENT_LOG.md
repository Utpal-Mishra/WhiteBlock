# Merchant & Fulfilment Log

This log records merchant, operator, permit-holder and fulfilment dependencies only when evidence or a real relationship exists. Mapped physical parking does not imply a merchant relationship, a booking channel, or a right to reserve a bay.

## MERCH-20261019-WW01 — County Wicklow inventory without partnership claims
- Date: 2026-10-19.
- Geography: County Wicklow outside Bray's existing evidence pilot.
- Decision: seed physical inventory with source-labelled OSM records without assuming merchant/operator integrations or public right to park.
- Partnership status: not established by this expansion; no contract, merchant fulfilment integration, payment, reservation, or live occupancy is claimed.
- Next step: separately validate local parking operators, retail-customer restrictions, permissions, public/permit access and booking eligibility.
- Risk mitigation: keep commercial status and public access as separate fields; require documentary evidence before asserting any operator relationship.
- Status: evidence inventory only.

## MERCH-20261020-COV04 — No partner telemetry inferred by map coverage
- County overview badges display mapped supply, not confirmed partner inventory or bookable/vacant bays.
- Merchant/operator integration remains separate: publish live availability only after partner/data-source agreement and trustworthy timestamps; county map rendering does not create partner commitments.
- No merchant fulfilment workflow or booking capability changed.

## MERCH-20261021-001 — No merchant/partner dependency introduced by map-spacing fix

- Date: 2026-10-21.
- Change impact: none on operator, merchant, payment, booking or fulfilment contracts.
- Reason logged: dense parking records remain canonical regardless of future partnership state; the correction is presentation-only.
- Future relevance: partner-provided facility segmentation can later improve physical reconciliation without changing the renderer contract.
- Status: no action required.

## MERCH-20261027-001 — Retail/customer parking enters the universe before merchant partnership

- Date: 2026-10-27.
- Rule: supermarket, shopping-centre and retail customer parking may be represented as evidence-backed assets/candidates before any merchant partnership.
- Required separation: physical existence, customer/access restrictions, maximum stay and partnership status.
- Partnership later adds verified rules/live/commercial capability rather than creating the parking identity.
- Status: adopted for Phase 1.5.

## MERCH-20261027-001 — Partnership capabilities attach to existing parking assets

- Date: 2026-10-27.
- Data contract: future partner/operator capability records reference an existing canonical `parking_id`.
- Capability fields: booking, payment, live occupancy, session management and partner-specific access support.
- Business rule: a partner relationship enriches a parking asset; it does not define whether the physical parking exists in WHITEBLOCK.
- Status: schema foundation implemented; no live partner integration activated.
