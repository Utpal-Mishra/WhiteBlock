# Expansion Log

## EXPAND-20261003-001 — Cork → Bray, County Wicklow

- Date: 2026-10-03
- Geography: Bray seafront and nearby town parking network.
- Expansion type: evidence pilot, not live-occupancy city rollout.
- Reason selected: high visitor traffic, visible parking supply, multiple nearby car parks, official parking rules and useful imagery/mapped evidence.
- Initial scope: North Beach, Strand Road corridor, Bray station parking, Florence Road, Dargle, Bray Head/Raheen Park.
- Coverage radius: 5 km from Bray seafront centre.
- Exit criteria for stronger production status:
  - current authoritative parking inventory or repeatable source integration;
  - fresh bay geometry/capacity verification;
  - current restriction/sign capture;
  - live occupancy or forecastable observations where available.
- Status: evidence pilot implemented.

## EXPAND-20261003-002 — Imagery evidence expanded across four connected regions

- Date: 2026-10-03
- Regions: County Cork, County Kildare, County Dublin and Bray/County Wicklow.
- Expansion type: physical-supply evidence enrichment on existing open/missing-geometry records.
- First-pass scale: 31 reviewed assets; the repeatable target queue identified substantially more point-only/open records for later batches.
- Promotion policy: this pass enriches existing canonical assets; it does not create new canonical parking solely from imagery.
- Follow-up: digitise/reconcile only the seven records whose reviewed imagery supports a clear surface-lot geometry candidate.
- Status: first batch complete; broader review backlog retained.

## EXPAND-20261018-001 — Coverage-complete geography before partnership-led expansion

- Date: 2026-10-18.
- Expansion rule: for each target county/city, exhaust known official/open/map/imagery/source categories and retain unresolved candidates before treating the geography as partnership-ready.
- Geography exit metric: no material known source or spatial gap remains unprocessed; remaining uncertainty is explicitly measured.
- Commercial consequence: partnership rollout should enrich the geographic registry rather than define it.
- Status: adopted.

## EXPAND-20261019-WW01 — Bray pilot to County Wicklow evidence network
- Date: 2026-10-19; status: implementation branch; deployment pending.
- Geography: County Wicklow outside existing 5 km Bray pilot, sourced from exact OSM County Wicklow administrative relation.
- Priority audit areas: Wicklow Town, Greystones, Arklow, Glendalough/Laragh, Brittas Bay, Blessington, Baltinglass and inland/rural towns.
- Exit: successful network snapshot, source reconciliation, missing-location audit and location-specific access/rule checks; no assertion of exhaustive coverage.

## EXPAND-20261020-WW01 — Wicklow county rollout hierarchy corrected
- Date: 2026-10-20; status: branch.
- Correction: Wicklow county is the expansion geography, Bray is a subordinate locality/pilot source, not an extra connected county.
- Metrics: count Bray in Wicklow aggregate exactly once, preserve distinct source evidence and the OSM Bray-exclusion radius.

## EXP-20261020-MAP02 — Marker policy for any later county
- Onboarding: write validated county snapshot, normalized parking rows, and dispatch region-inventory-ready; future counties join the shared map logic automatically.
- Galway/Donegal used as test fixtures only; do not imply networks are live in those counties.
- Existing county set remains Cork, Kildare, Dublin and Wicklow (Bray as locality).

## EXP-20261020-MAP03 — One map failover for any county
- Global Leaflet geographic raster fallback requires no region-specific implementation; applies to Cork, Kildare, Dublin, Wicklow and any future source-backed county.
- Maintain provider/source attribution and verify acceptable production tile usage as traffic grows.

## EXP-20261020-COV04 — New counties inherit national overview/drilldown
- Source-backed new county uses existing registration and map zoom policies; its total mapped parking locations appear as a national node and selecting it zooms to the full regional dataset automatically.
- Existing baseline counties: Cork, Kildare, Dublin, Wicklow (Bray nested). Future test fixtures must not be confused with deployed coverage.
- Before claiming capacity/free bays, require verified capacity or live telemetry as appropriate.

## EXPAND-20261020-MAP05 — Boundary onboarding requirement for future counties
- Date: 2026-10-20.
- Future source-backed county additions should include a verified administrative boundary relation/geometry before the county is considered fully map-ready.
- Existing automatic inventory registration may still expose a future county without a border if no verified geometry is configured; the UI must not synthesize one.
- Preferred onboarding: add relation ID/ISO code to `config/ireland_region_boundaries.json`, then let the deployment builder publish the geometry.
- Status: adopted.

## EXPAND-20261020-MAP06 — Marker semantics apply nationwide
- Date: 2026-10-20.
- Rule: current and future counties inherit the same cluster/rank/availability language through the universal marker policy and shared renderers.
- No county-specific number interpretation is permitted.
- Status: adopted.

## EXPAND-20261020-MAP07 — One default map language across all regions
- Date: 2026-10-20.
- Rule: current and future WHITEBLOCK regions inherit Hybrid as the initial basemap; no county-specific default is allowed.
- Region/county boundary focus, clustering and parking marker semantics remain independent of basemap choice.
- Status: adopted.

## EXPAND-20261021-001 — Dense-marker behaviour standardised for every region

- Date: 2026-10-21.
- Expansion implication: new counties do not need bespoke marker spacing logic when several parking records share an entrance or lie close together.
- Shared rule: broad-scale cluster → detailed collision check → display-only fan-out when required.
- Status: adopted as universal behaviour.

## EXPAND-20261027-001 — Phase 1.5 expansion gate is now measurable

- Date: 2026-10-27.
- Each connected/future county must assess the same required source families and expose unresolved gaps.
- Galway City official structured parking data has been added to the registry as a future-region ready source, but Galway is not yet a connected WHITEBLOCK region.
- Expansion rule: new counties reuse the Parking Universe source registry/report rather than bespoke completeness claims.
- Status: implemented.

## EXPAND-20261027-001 — Phase 1.5 coverage workflow begins with current four counties

- Date: 2026-10-27.
- Initial geography: Cork, Kildare, Dublin and Wicklow, with Bray retained as a Wicklow locality/source.
- Expansion rule: new counties must use the same source-family assessment, canonical state separation and evidence-review queue.
- Gate: county partnership-readiness requires material source families and geographic gaps to be assessed, with unresolved assets retained explicitly.
- Status: active.

## EXPAND-20261027-002 — Phase 2 decision contract is region-independent

- Date: 2026-10-27.
- Expansion rule: every new region should populate the same destination-result fields (coordinates, rules, pricing evidence, source/freshness/confidence) so the Phase 2 driver experience works without county-specific UI.
- Missing fields remain explicit unknowns; regional rollout does not require fabricated defaults.
- Status: adopted.

## EXPAND-20261027-002 — Evidence-only Phase 2 ranking applies universally

- Date: 2026-10-27.
- Expansion rule: every newly connected county inherits the same no-placeholder ranking semantics automatically.
- No county-specific scoring defaults are permitted.
- Status: adopted.

## EXPAND-20261027-003 — Phase 3 starts with Cork before cross-region forecasting

- Date: 2026-10-27.
- Scope decision: use Cork's existing official live occupancy feed to establish the observation-history, baseline and evaluation pattern first.
- County expansion remains data-dependent: regions without comparable time-series ground truth stay inventory/rules evidence only.
- Phase 1.5 source coverage continues across Cork, Kildare, Dublin and Wicklow in parallel.
- Status: accepted.
