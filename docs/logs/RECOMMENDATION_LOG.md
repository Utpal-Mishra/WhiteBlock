# Recommendation Log

## REC-20261003-001 — Use evidence tiers for Bray recommendations

- Date: 2026-10-03
- Recommendation: rank verified/mapped Bray parking assets but keep live availability unknown where no live feed exists.
- Recommendation rule: current signage and event restrictions override stored baseline rules.
- Special handling: unknown-access Bray Head/Raheen Park stays visible as evidence but is not treated as verified public access.
- Duplicate handling: Northern Carpark / Bray Town Council Car Park evidence is folded into the North Beach canonical record; NCPS / Bray (Daly) Car Park 2 evidence is canonicalised as one record.
- Rationale: avoid double counting and avoid false certainty.
- Status: implemented.

## REC-20261003-002 — Use imagery to prioritise geometry work, not to manufacture precision

- Date: 2026-10-03
- Recommendation: prioritise the 7 records marked candidate_polygon_allowed for a separate digitisation/reconciliation task.
- Do not count bays or infer current capacity from aerial vehicles.
- Use fresh/authoritative Irish orthophotography where licensing permits; treat older imagery as lower-confidence evidence.
- Records with ambiguous or unconfirmed footprints remain points/corridors until corroborated.
- Status: adopted.

## REC-20261004-001 — Use progressive disclosure for national parking exploration

- Date: 2026-10-04.
- Recommendation: keep the national map concise and progressively reveal detail only after a user selects a region and then a locality.
- Display order: county/region inventory and known-space total → locality location count/known spaces → exact mapped parking points.
- Reason: this prevents national-marker overlap while retaining useful evidence density at each zoom level.
- Mobile rule: controls that change context but are not required for the main parking task should sit behind the + menu.
- Status: adopted in PR #33.

## REC-20261018-001 — Keep national parking counts stable and labelled

- Date: 2026-10-18.
- Recommendation: display one stable evidence-derived count per connected region on the Ireland map and reserve dynamic clustering for detailed/destination views.
- Presentation: region name + mapped/evidence-backed location total should remain readable without requiring hover/tap; capacity may be shown only where published.
- Kildare qualifier: when using the 128-anchor fallback, call it partial/evidence-anchor coverage rather than complete county inventory.
- Status: adopted.

## REC-20261018-002 — Measure coverage completeness before adding more commercial features

- Date: 2026-10-18.
- Recommendation: prioritise a Parking Universe Coverage workstream before payment/reservation/operator features.
- Coverage KPIs: source-universe coverage, geographic gap coverage, candidate resolution rate, verified-access rate, stale-record rate and unresolved-access rate.
- Recommended operating rule: no material known source or geographic gap should remain unprocessed in the target region; unresolved parking should be represented explicitly rather than omitted.
- After this gate: partnerships can become the main product-expansion workstream while automated inventory maintenance continues in parallel.
- Status: adopted.

## REC-20261019-WW01 — County recommendation eligibility controls
- Date: 2026-10-19; status: follow-up review open.
- Guidance: prioritize Wicklow Town, Greystones, Arklow, Glendalough/Laragh, Brittas Bay and inland towns for access/stay/entrance verification.
- Guardrail: do not promote OSM unknown/customer/private/permit-only parking to unrestricted public parking; on-site signage overrides general rules.
- Action: enrich individual sites with maximum stay and tariff only after matching official evidence to location.

## REC-20261020-CL01 — Use zoom-adaptive location aggregation
- Recommendation: preserve county and locality aggregation at overview zoom levels; display one count for nearby parking *locations*, not available bays.
- Detailed mode: reveal distinct ranked parking IDs and actual coordinates as zoom permits; keep source evidence and live availability indicators separate.
- Interaction: tapping a cluster progressively zooms; do not scatter markers to artificial coordinates or leave previous destination ranks on national map.

## REC-20261020-MAP02 — One zoom UI standard for expansion
- Recommendation: use one shared pixel-radius grouping algorithm for all county and subcounty maps, rather than separate per-county marker implementations.
- Avoid external-only clustering dependencies; keep a local fallback if MarkerCluster does not load.
- Use labels explicitly counting parking locations; preserve raw IDs, access restrictions and evidence.

## REC-20261020-MAP03 — Never mask map failures with schematics
- Street mode must show real-world roads, including a no-WebGL alternative.
- User chooses Parking Layout explicitly from More map views; exit/Street control returns to geographical map.
- Avoid silent ambiguity: mark compatibility raster street map and report outage if both tile sources fail.

## REC-20261020-COV04 — Show every region's supply at region selection
- Recommendation: default Ireland shows all connected counties, each with its mapped parking-location count; default county shows all county parking assets directly as clusters without a prerequisite locality view.
- Cluster tap zooms towards real parking locations, individual point tap gives evidence/name and details where supported.
- Live vacant bays and total capacity must remain independent of mapped-location inventory totals; unreported live occupancy is unknown, never zero or inferred.

## REC-20261020-MAP04 — Treat partial basemaps as failure, not degraded success

- Date: 2026-10-20.
- Recommendation: a map showing one or two isolated tiles must never be considered successfully loaded.
- Implementation rule: success requires the visible raster grid to complete; otherwise fail over within a bounded window.
- Renderer rule: maintain one basemap owner and keep analytical Parking Layout user-invoked.
- Longer-term recommendation: before material traffic scale, replace best-effort public tile dependencies with a production map provider/hosting contract and explicit SLA/usage terms.
- Status: adopted.

## REC-20261020-MAP05 — Use exact administrative outlines for region focus
- Date: 2026-10-20.
- Recommendation: when a county filter is active, keep the selected county border visible throughout county-level parking exploration so spatial context is unambiguous.
- Do not draw a synthetic border from parking-marker extent.
- Keep the outline visually strong enough to survive bright Street tiles while the fill remains subtle enough not to obscure roads or parking markers.
- Status: adopted.

## REC-20261020-MAP06 — Never show unexplained numbers on parking markers
- Date: 2026-10-20.
- Recommendation: all quantity markers require a noun; all recommendation positions require an ordinal prefix; all availability numbers require a live/free-space qualifier.
- Preferred vocabulary: `OPTIONS`, `LOCATIONS`, `#N`, `N FREE`, and `LIVE —` when no live feed exists.
- Status: adopted.

## REC-20261020-MAP07 — Keep Hybrid visible; hide secondary map modes under +
- Date: 2026-10-20.
- Recommendation: the toolbar should communicate one clear product default rather than show several equally weighted basemap choices.
- Adopted UX: `Hybrid` + `+`; the menu contains Street, Terrain, Satellite, Street View and Parking Layout.
- Reason: preserves maximum map area on mobile and aligns the visible control with the actual startup state.
- Status: adopted.

## REC-20261021-001 — Prefer fan-out over forced de-duplication for crowded map options

- Date: 2026-10-21.
- Recommendation: do not merge/remove distinct source records solely because their points overlap visually.
- Presentation rule: cluster at broad zoom, then fan genuinely colliding detailed markers around the true location with connector lines.
- UX rule: suppress repeated availability labels inside the fan and rely on ordinal markers + result cards for detailed facts.
- Status: adopted.

## REC-20261027-001 — Integrate official source gaps before adding more presentation features

- Date: 2026-10-27.
- Recommendation: use the Phase 1.5 source-family gap report to choose the next ingestion work.
- First ready queue: Dublin City multistorey inventory/live feed, Dublin accessible parking, Dublin City parking meters, South Dublin parking meters and DLR parking runs.
- Parallel priority: resolve access/max-stay/customer restrictions for known physical parking.
- Status: adopted.

## REC-20261027-001 — Resolve access before optimising lower-risk metadata gaps

- Date: 2026-10-27.
- Recommendation: Phase 1.5 review work should prioritise unknown legal/customer/private access above missing capacity or polygon geometry.
- Rationale: access uncertainty directly affects whether WHITEBLOCK may safely recommend an asset for a driver's stay.
- Operationalisation: shared review queue weights unknown access more heavily than missing capacity/geometry.
- Status: adopted.

## REC-20261027-002 — Rank on session cost, not isolated tariff number

- Date: 2026-10-27.
- Recommendation: "Lowest cost" should compare the cost of the requested stay, not the first euro value found in source text.
- Adopted rule: compare only safely calculable session totals; unresolved tariff structures remain visible but are not treated as numeric.
- Best-overall: retain availability/distance/confidence/rule-risk weighting and incorporate safely calculable session cost.
- Status: adopted.

## REC-20261027-002 — Rank on known evidence, not neutral placeholders

- Date: 2026-10-27.
- Recommendation: unknown availability, unknown confidence and unsafe/non-comparable pricing should receive no positive ranking credit.
- Rationale: a neutral-looking placeholder can still materially change ordering and imply evidence that does not exist.
- Status: adopted.
\n
## REC-20261027-003 — Do not let the first Phase 3 baseline change driver ranking

- Date: 2026-10-27.
- Recommendation: expose the historical arrival baseline for inspection first, but keep Phase 2 Best Overall ranking on its already validated evidence factors.
- Promotion gate: require sufficient history, backtesting, error metrics, probability calibration review and degradation monitoring before forecast availability can replace/currently supplement the ranking availability factor.
- Reason: a naive baseline is the benchmark a later forecast model must beat, not evidence that ranking has improved.
- Status: adopted.\n