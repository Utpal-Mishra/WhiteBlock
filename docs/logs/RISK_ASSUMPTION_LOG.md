# Risk & Assumption Log

## RISK-20261003-001 — Historical imagery staleness

- Risk: aerial/street imagery may not reflect current layout.
- Likelihood: medium.
- Impact: high if used for capacity/legal claims.
- Mitigation: use imagery only as physical-supply evidence; keep bay count/capacity unverified until fresh imagery or field survey.
- Status: open.

## RISK-20261003-002 — Duplicate/alias parking records

- Risk: adjacent or renamed listings can double count the same facility.
- Likelihood: high.
- Impact: medium-high.
- Mitigation: canonicalise near-identical coordinates/names and preserve aliases as evidence.
- Status: mitigated for North Beach and NCPS/Station Car Park 2 records.

## RISK-20261003-003 — Baseline rule versus temporary restriction

- Risk: events/works/local signs can override stored rules.
- Likelihood: medium.
- Impact: high.
- Mitigation: display verification language; model event restrictions as time-bounded evidence; signage always wins.
- Status: open; event automation pending.

## ASM-20261003-001 — Public-access interpretation

- Assumption: facilities explicitly represented as public car parks / council parking zones are usable by the public subject to local rules.
- Control: unknown/ambiguous access remains unknown, never silently promoted to public.

## RISK-20261003-004 — Imagery can look precise while being legally or temporally wrong

- Risk: visible vehicles/pavement may be private, temporary, obsolete, event-controlled or misaligned with a mapped point.
- Likelihood: high across heterogeneous county inventories.
- Impact: high if promoted directly to public parking.
- Mitigation: separate physical-supply review from access/rules/live occupancy; explicit stale/ambiguous states; no automatic polygons.
- Status: controlled.

## RISK-20261003-005 — Imagery licensing and derivative-storage risk

- Risk: copying third-party imagery into the public repository can violate provider terms or create avoidable redistribution obligations.
- Mitigation: imagery remains short-lived CI review artifacts; repo stores metadata/conclusions only; preserve attribution/provider provenance.
- Status: controlled.

## RISK-20261003-006 — Kildare external inventory refresh can time out

- Risk: full County Kildare Overpass traversal can exceed deployment time or fail at public endpoints.
- Impact: Kildare previously disappeared from the deployed snapshot.
- Mitigation: bounded exact-boundary attempt plus explicitly partial KCC/maintained-anchor fallback; UI must label partial coverage.
- Status: mitigated in PR #32.

## RISK-20261004-001 — Aggregated map totals can be misread as complete or live

- Date: 2026-10-04.
- Risk: users may interpret a regional location/capacity total as complete real-world supply or current availability.
- Likelihood: medium.
- Impact: high for recommendation trust.
- Mitigation: label capacity as known/published only; display live free-space values only when reported; retain Bray as an explicit pilot; locality groups are derived from existing mapped evidence and never create new parking records.
- Residual risk: source inventories remain incomplete in some areas and subarea labels depend on available settlement/area metadata.
- Status: controlled; continue evidence enrichment and deployed UX review.

## RISK-20261018-001 — Map cluster counts can be mistaken for county totals

- Date: 2026-10-18.
- Risk: a MarkerCluster number near Dublin/Kildare/Bray can look like a regional parking count even though it is only a zoom-dependent grouping of visible markers.
- Likelihood: high on mobile at national zoom.
- Impact: high for coverage interpretation.
- Mitigation: hide the cluster layer during national/region browsing, use dedicated summary cards with explicit region labels and evidence-derived totals, and keep partial-coverage wording for Kildare.
- Status: mitigated in the 2026-10-18 fix.

## RISK-20261018-002 — Treating “all parking” as a static-completeness claim

- Date: 2026-10-18.
- Risk: stating that WHITEBLOCK has every parking spot could create false confidence because parking is created, removed, reconfigured, restricted or temporarily closed.
- Likelihood: high over time.
- Impact: high for trust and recommendation safety.
- Mitigation: define completeness against known source/geographic coverage; retain unresolved candidates; continuously revalidate rules/lifecycle; expose freshness and uncertainty.
- Status: controlled by Parking Universe Coverage design.

## ASM-20261018-001 — Partnership is enrichment, not inventory discovery

- Assumption: commercial/operator partnerships should primarily add operational/commercial capability to already-known parking assets.
- Control: if a partner exposes previously unknown physical parking, ingest it through the same canonical reconciliation/evidence workflow rather than bypassing the registry.

## RISK-20261019-WW01 — Wicklow mapped parking coverage limitations
- Date: 2026-10-19; status: open.
- R1 incomplete OSM rural/retail mapping: high likelihood/medium impact; mitigation official sources and licensed imagery candidate queue; do not claim exhaustive county coverage.
- R2 wrong legal/public-access classification: medium/high; method compare OSM access tags with official signage/operator evidence; mitigation keep unknown/restricted explicit and gate recommendations.
- R3 temporary/seasonal coastal closures: medium/high; method check current on-site rules and event notices; mitigation timestamp rule evidence, no blanket year-round access promises.
- R4 Overpass timeout: medium/medium; method inspect hourly build logs; mitigation remove optional snapshot and show source-unavailable state, no fake fallbacks.
- R5 double counting Bray: high/medium if unmitigated; mitigation remove the existing 5 km Bray circle from Wicklow data and unit-test.

## RISK-20261020-CL01 — Stale overlays and icon collisions
- Risk: ranked MapLibre circles may remain after overview transition despite Leaflet layer cleanup. Impact: phantom Cork parking dots and implied extra availability. Mitigation: source reset + generation cancellation + browse gating; test with source-nonavailable overlays.
- Risk: clusters misinterpreted as available parking *spaces*. Mitigation: document as counted mapped parking locations, not vacant bays.
- Risk: visual collisions within dense areas near zoom 17. Mitigation: pixel-connected clusters below zoom 17, preserve mapped locations at detailed zoom; verify on narrow mobile screens.
- Risk: differing asynchronous overlay and basemap events. Mitigation: cache-busted GL loader, CI regressions and pending manual mobile smoke validation.

## RISK-20261020-MAP02 — Universal marker regression and source expansion
- R1: future region mislabelled county without trusted inventory; mitigation demand non-empty snapshot + valid coordinates before automatic county navigation registration.
- R2: network-blocked cluster plugin; mitigation internal zoom-reactive group fallback instead of unclustered inventory points.
- R3: two different IDs refer to same physical car park; stable-ID deduplication alone is insufficient; mitigation evidence-based asset reconciliation.
- R4: venues with identical exact coordinates may not separate by zoom 17; preserve IDs and add spiderfy/list disambiguation if required, never arbitrarily relocate sites.
- R5: heavy locality source: use approximate linear screen grid grouping; viewport-filter detailed markers.

