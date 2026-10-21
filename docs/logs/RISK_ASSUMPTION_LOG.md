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

## RISK-20261020-MAP03 — Raster fallback reliability and safe UI control
- R1 WebGL blocked/slow: map could fall into Parking Layout and hide geographic context. Mitigation: use raster street basemap, never programmatic schematic activation. Evidence: user mobile screenshot/code path.
- R2 OSM raster tile availability/rate limits: use alternative CARTO street tiles after repeated tile failures; report failure if both unavailable. Never imply a basemap is loaded without tile evidence.
- R3 Legacy handler removes fallback raster: layeradd cleanup explicitly exempts tracked `rasterFallbackLayer`; regression test confirms retained layer.
- R4 Street selected while Parking Layout visible: clear basemap pressed state during schematic; provide visible Back to map, document capture listener to restore even with MapLibre intercepted clicks.
- R5 External tile-provider terms/attribution/network reliability: preserve attribution; evaluate hosting strategy and tile policy before scale-up.

## RISK-20261020-COV04 — All-region parking map
- R1 “available spots” misread as vacant bays. Evidence: inventory snapshots do not contain continuous live occupancy for all sites; mitigation county badges say mapped locations and separately show reported vacant bays or “Vacancies unverified”.
- R2 heavy county source crowding/mobile performance. Mitigation reuse grid-based zoom clustering, viewport-limited site dots at detail zoom; retain full records without arbitrary top-300 truncation.
- R3 late county source after pilot-only display. Mitigation pending county fit until source-backed canonical region inventory and snapshot arrive.
- R4 unexpected camera recenter while inspecting Ireland. Mitigation refresh counts and markers without recurring `fitBounds`; fit only on explicit Ireland/county action and pending initial county source.
- R5 any source rows outside Irish bounds or duplicate IDs. Mitigation filter invalid coordinates and stable-ID duplicates; physical duplicate IDs still need evidence reconciliation.

## RISK-20261020-MAP04 — Partial public-tile delivery on mobile

- Date: 2026-10-20.
- R1: raster provider returns only part of the visible tile grid. Likelihood medium; impact high. Mitigation bounded completion watchdog + alternate provider.
- R2: simultaneous basemap renderers race during startup. Likelihood medium; impact high. Mitigation one persistent renderer owner.
- R3: responsive container geometry changes after initialization. Likelihood high on mobile; impact medium/high. Mitigation ResizeObserver + Leaflet invalidateSize + GL resize.
- R4: both public raster providers unavailable. Likelihood low/medium; impact high. Mitigation explicit source-incomplete status; future production provider/hosting requirement.
- R5: repeated repair causes unnecessary requests. Mitigation debounced repair timer; watchdog cleared on successful full-layer load/provider change.
- Status: mitigations implemented; live mobile validation pending.

## RISK-20261020-MAP05 — Region border can be mistaken for parking coverage completeness
- Date: 2026-10-20.
- Risk: a precise county outline may visually imply WHITEBLOCK knows every physical parking asset inside that county.
- Mitigation: boundary is a navigation/focus layer only; mapped-location counts keep evidence wording; no completeness claim is introduced.
- Risk: stale administrative geometry if upstream boundary changes.
- Mitigation: refresh on Pages deploy; reuse last known validated boundary only when refresh fails; validate relation IDs and geometry types.
- Risk: boundary layer obscures map content.
- Mitigation: fill opacity 0.045, non-interactive pane below parking footprint/point layers.
- Status: controlled.

## RISK-20261020-MAP06 — Cluster count confused with rank or vacant spaces
- Date: 2026-10-20.
- Risk: users may interpret `3` as third-best parking or three free bays instead of three grouped locations.
- Impact: high for decision confidence.
- Mitigation: `3 OPTIONS` in search mode, `3 LOCATIONS` in browse mode, `#3` for rank and separate `N FREE` availability label.
- Additional risk: unknown availability could be read as zero. Mitigation: use `LIVE —`, never `0 FREE` when the feed is absent.
- Status: mitigated.

## RISK-20261020-MAP07 — Hybrid provider/reference-layer dependency
- Date: 2026-10-20.
- Risk: current Hybrid reference overlay is a legacy Esri service scheduled for future retirement.
- Impact: future loss of road/place labels if migration is not completed.
- Mitigation: keep provider logic isolated in the basemap engine; track migration to modern Imagery Hybrid / Hybrid Reference before retirement; Street remains an independent fallback.
- Risk: Hybrid imagery may be heavier than Street on mobile networks.
- Mitigation: bounded tile watchdog, responsive repair and explicit user access to Street mode under +.
- Status: controlled for prototype; provider migration remains open.

## RISK-20261021-001 — Display fan-out could be mistaken for true parking coordinates

- Date: 2026-10-21.
- Risk: visually displaced detailed markers may appear to represent different physical coordinates.
- Likelihood: medium.
- Impact: medium-high for spatial trust.
- Mitigation: source coordinates and polygons remain unchanged; display-only points retain canonical IDs; connector lines visibly anchor each fanned marker to its real coordinate; fan-out occurs only when screen collisions make exact rendering unreadable.
- Status: controlled.
