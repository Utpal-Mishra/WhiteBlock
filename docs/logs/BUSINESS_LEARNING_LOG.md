# Business Learning Log

## BUS-20261003-001 — High-demand leisure destinations expose hidden parking supply

- Date: 2026-10-03
- Context: Bray seafront visibly contains materially more parking supply than a city-only structured parking feed reveals.
- Learning: WHITEBLOCK needs a mixed-source discovery model for leisure/tourism areas: official rules + mapped car parks + imagery-derived physical-supply evidence + later occupancy evidence.
- Evidence: Wicklow County Council parking by-laws identify public parking zones/car parks; current mapped listings identify several lots; aerial/street imagery shows substantial seafront parking use.
- Business implication: coverage expansion should prioritise high-traffic destinations where structured data under-represents real usable supply.
- Constraint: physical parking visible in imagery is not equivalent to legal/public/currently available parking.
- Follow-up: validate whether better parking discovery at Bray improves result coverage and user trust without a live occupancy feed.
- Status: active learning.

## BUS-20261003-002 — Imagery adds value when it resolves physical-supply uncertainty, not occupancy

- Date: 2026-10-03
- Learning: aerial review is most valuable on point-only/open records where structured sources identify a location but not the physical footprint.
- First batch: 31 assets across Dublin, Cork, Kildare and Bray.
- Result: 17 clearly visible physical parking, 9 ambiguous-context records, 3 not confirmed as distinct footprints, 2 visible only in older imagery.
- Business implication: WHITEBLOCK can improve supply confidence without waiting for a live occupancy feed, but should monetise/position this as spatial evidence and verification rather than real-time availability.
- Status: validated learning.

## BUS-20261018-001 — Inventory completeness is a stronger moat than partner-only coverage

- Date: 2026-10-18.
- Learning: if WHITEBLOCK only learns about parking through partners, coverage becomes dependent on commercial relationships and the product risks becoming another operator directory.
- Strategic implication: build the parking universe independently from partnerships, then use partnerships to improve actionability, live data and monetisation.
- User value: a driver can understand the full parking landscape, including non-partner options, while partner assets can offer richer booking/payment/live capabilities.
- Business value: partnership negotiations enrich an existing spatial asset rather than controlling WHITEBLOCK's basic coverage.
- Status: adopted.

## BIZ-20261019-WW01 — County expansion before partnerships
- Date: 2026-10-19; status: implementation branch.
- Learning: public/open mapped parking can seed a practical geographic registry independently of live operators. Council rules are location-specific; catalogue of physical parking is not a claim of driver eligibility.
- Evidence: County Wicklow parking by-laws and OSM County Wicklow relation 282760 (see docs/WICKLOW_NETWORK.md).
- Next validation: identify what proportion of real visitor/retail/rural parking remains unrecorded, before prioritising partnerships.

## BUS-20261020-CL01 — Map zoom clarity is part of data trust
- Observation: showing multiple overlapping parking labels at Ireland scale undermines clarity even where site data are valid.
- Learning: match UI granularity to scale: counties at Ireland view, towns at county view, individual parking locations near a destination.
- Constraint: count mapped parking locations only; no claim of live vacant spaces without provider-backed data.

## BUS-20261020-MAP02 — Consistent map readability at expansion scale
- Learning: clear geospatial hierarchy must hold independently of how many counties, towns or parking locations join the network.
- Use source data and legal rules to expand supply; use a reusable clustering component for presentation; never infer vacant bays from a count of locations.

