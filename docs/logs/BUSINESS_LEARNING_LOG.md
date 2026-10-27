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

## BUS-20261020-MAP03 — Map reliability affects trust
- Relative-distance Parking Layout is useful for analytical comparison, but cannot replace road-level geographic context.
- Basemap must have a non-WebGL fallback across all future regions before broad roll-out and partner integrations.

## BUS-20261020-COV04 — Geographic hierarchy must match county selection
- User requirement: Ireland selection shows an actual all-Ireland geographical map with total mapped parking locations at each currently connected county; selecting a region zooms directly to all its mapped parking assets.
- Learning: a county filter should not require a second town/locality tap before parking evidence becomes visible. Cluster where markers collide, reveal actual locations with zoom.
- Commercial trust: mapped locations are not live vacant bays. Label any live vacancies separately and only where provider-backed records are available.

## BUS-20261020-MAP04 — Map reliability is part of parking trust

- Date: 2026-10-20.
- Learning: correct inventory counts are not enough if the underlying geographic map appears broken; users cannot trust or interpret spatial coverage when only partial tiles render.
- Product implication: basemap completeness and recovery must be treated as a core availability requirement, independent of parking-data quality.
- Architecture implication: graceful degradation must stay geographic; analytical layouts are supplementary rather than substitutes for a failed road map.
- Status: incorporated into renderer design.

## BUS-20261020-MAP05 — County focus needs visible geographic scope
- Date: 2026-10-20.
- Learning: zooming into a county is not always enough to communicate the exact operating area; a visible administrative outline materially improves interpretation of the parking inventory.
- Product implication: geographic scope should be explicit without implying complete parking coverage.
- Status: incorporated into map UX.

## BUS-20261020-MAP06 — Numeric map markers need explicit semantics
- Date: 2026-10-20.
- Learning: a bare number on a parking map can be misread as rank, cluster size or vacant-space count.
- Product implication: WHITEBLOCK should never rely on shape/colour alone when multiple parking quantities coexist.
- Adopted language: destination cluster = `N OPTIONS`; browse/inventory cluster = `N LOCATIONS`; individual recommendation = `#1/#2/#3`; live spaces = separate `N FREE` label.
- Status: implemented.

## BUS-20261020-MAP07 — Aerial context should be the default parking context
- Date: 2026-10-20.
- Learning: parking discovery benefits from seeing real physical land use, road geometry, buildings and access context immediately; a labelled aerial basemap communicates this better than a plain street map for WHITEBLOCK's spatial-intelligence use case.
- Product implication: Hybrid becomes the default, while Street/Terrain/pure Satellite remain user-selectable.
- Status: adopted.

## BUS-20261021-001 — Complete parking coverage can create display-density problems

- Date: 2026-10-21.
- Observation: Kildare Town contains several evidence-backed records only metres apart, including records that share or nearly share an entrance/coordinate.
- Learning: broader inventory completeness increases the need to separate **data truth** from **map presentation**. Deleting records merely to make a map cleaner would weaken the evidence model.
- Product implication: preserve source-backed records, then use collision-aware clustering/fan-out for presentation.
- Status: adopted.

## BUS-20261027-001 — Parking-universe coverage is an asset independent of partnerships

- Date: 2026-10-27.
- Learning: WHITEBLOCK's strategic value increases when the platform knows the parking landscape before commercial integration. Partner status should enrich an asset, not determine whether the asset is known.
- Implication: Phase 1.5 is now an active programme with measurable source-family and evidence-resolution gaps.
- Status: adopted.

## BUS-20261027-001 — Parking-universe coverage is an asset independent of partnerships

- Date: 2026-10-27.
- Learning: WHITEBLOCK's strategic value increases when the platform knows the parking landscape before commercial integration. Partner status should enrich an asset, not determine whether the asset is known.
- Implication: Phase 1.5 is now an active programme with measurable source-family and evidence-resolution gaps.
- Status: adopted.

## BUS-20261027-001 — Parking coverage and commercial coverage must remain independent

- Date: 2026-10-27.
- Learning: a comprehensive parking product cannot depend on commercial partnerships to define its inventory.
- Implication: WHITEBLOCK must preserve every source-backed asset/candidate independently, then let partnerships add booking, payment, verified rules or live data later.
- Phase 1.5 action: canonical states now explicitly separate physical existence, recommendation eligibility, live-data state and partnership state.
- Status: implemented in Phase 1.5 tranche 1.

## BUS-20261027-002 — Decision transparency completes the driver-value proposition

- Date: 2026-10-27.
- Learning: destination search and filtering are not enough to differentiate WHITEBLOCK from a static parking directory; the driver must be able to see why a result ranks where it does and what evidence supports it.
- Phase 2 action: every recommendation now exposes stay fit, walk estimate, safely calculable session cost, ranking rationale, source, freshness and confidence.
- Commercial implication: later partner integrations can enrich the same decision surface without replacing the underlying recommendation logic.
- Status: Phase 2 complete.

## BUS-20261027-002 — Unknown data must not silently improve a parking recommendation

- Date: 2026-10-27.
- Learning: a recommendation can be visually transparent yet still contain hidden assumptions if unknown inputs receive placeholder score credit.
- Phase 2 audit finding: Best Overall gave positive default contributions to unreported availability and non-comparable price evidence.
- Product implication: only evidenced/safely calculable factors may earn positive ranking credit.
- Status: corrected.
