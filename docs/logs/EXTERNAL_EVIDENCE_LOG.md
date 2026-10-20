# External Evidence Log

## EVID-20261003-001 — Bray parking evidence sweep

- Date: 2026-10-03
- Official source: Wicklow County Council Parking Bye-Laws page and 2017 adopted by-laws.
- Official facts captured:
  - Zone D includes Strand Road from Martello Terrace to Fontenoy Terrace.
  - Zone D baseline: €0.30/hour or €3/day, up to 15 hours unless local plate states otherwise.
  - Zone G names Florence Road Carpark.
  - Zone H names North Beach Carpark.
  - the adopted schedule records free parking all day Sunday.
- Mapped evidence:
  - Bray Station Car Park / Station Yard: OSM-derived location.
  - Dargle Car Park: OSM-derived location.
  - multiple current parking listings around Strand Road/Quinsborough Road/Florence Road.
- Imagery evidence:
  - historical aerial beachfront imagery shows extensive parked vehicles along the seafront;
  - geotagged Strand Road street imagery shows marked/used parking.
- Event evidence: 2026 Bray Air Display traffic plan shows Strand Road parking can be temporarily prohibited.
- Evidence interpretation: imagery confirms physical use/supply only; it does not establish current occupancy or supersede legal signage.
- Status: recorded in web/data/bray_parking_snapshot.json.

## EVID-20261003-002 — Aerial imagery sources and freshness

- Date: 2026-10-03
- Review provider: Esri World Imagery, used as temporary review imagery with provider/source metadata captured per asset.
- Reviewed imagery dates ranged from 2018 to 2025; older Cork scenes were explicitly classified as stale rather than treated as current.
- Typical reviewed resolution metadata was approximately 0.31–0.50 m.
- Production preference: appropriately licensed Tailte Éireann orthophotography for Irish geometry work where available; Tailte publishes national high-resolution orthophotography and higher-resolution Dublin metropolitan coverage.
- Repository policy: provider imagery pixels are not committed; only source/date/resolution and review conclusions are persisted.
- Status: evidence policy active.

## EVID-20261019-WW01 — County Wicklow source package
- Date: 2026-10-19; status: referenced and data-query configured.
- Geographic provenance: https://www.openstreetmap.org/relation/282760 (County Wicklow admin level 6; ODbL).
- Rules: https://www.wicklow.ie/Living/Services/Roads-Transport/Road-Policy/Parking-Bye-Laws
- Greystones: https://www.wicklow.ie/Living/Your-Council/Municipal-Districts/Greystones/Pay-Parking
- Wicklow Town: https://wicklowtown.ie/find-us
- Glendalough: https://glendalough.ie/transport/parking-in-glendalough/
- Important: links support candidate/rule research, not blanket current pricing or live vacancy claims.

## EVID-20261020-CL01 — Mobile visual defect supplied by project owner
- Evidence type: two Android mobile screenshots, 20 October 2026, showing Ireland connected coverage while numbered Cork ranks 01–07 overlap at city and national zoom levels.
- Root cause: ranked MapLibre overlay mounted independently of Leaflet county overview cleanup; code inspection confirmed missing browse-mode guard.
- Confidence: high match to reported symptoms; deployment screenshot confirmation outstanding.

## EVID-20261020-MAP02 — Mobile overlapping markers
- Evidence: two owner-supplied Android screenshots dated 20 October 2026 showing multiple overlapping numbered Cork markers at close/national zoom.
- Root causes confirmed in source: ranked MapLibre layer remained on browse; locality drill-down drew unclustered circles. Both handled by shared policy work.
- Status: mobile post-publication screenshot check remains pending.

## EVID-20261020-MAP03 — Android geographical map absent
- Owner-supplied 2026-10-20 screenshot depicts dark Parking Layout of 3 Cork City parking locations while Street appears active.
- Code review confirmed a forced schematic takeover in `map-engine-v2.js` on vector renderer failure/style timeout.
- Ambiguity: screenshot alone cannot tell whether the user manually selected Parking Layout; runtime code confirms forced takeover was possible. Device retest pending.

## EVID-20261020-COV04 — User requested Ireland top map and region drilldown
- Evidence: project-owner instruction 2026-10-20: “When the coverage is Ireland, make sure to view top view of Ireland with total available parking spots in each coverage region while when any coverage region is selected, map zoom into that region to view all the available parkings.”
- Technical review: current `focusRegion` called `renderRegionSettlementNodes(key)` which required a second locality click before parking sites; current national node already computed evidence-backed location counts with guarded live vacant-bay aggregates.
- Decision: preserve truth in labeling; total mapped parking locations per region on national overview, separately identify sourced real-time free bays.

## EVID-20261020-MAP04 — Mobile screenshot confirms incomplete geographic tile grid

- Date: 2026-10-20.
- Evidence type: owner-supplied production/mobile screenshot.
- Observation: the Ireland coverage map displayed only separated Street raster tiles over a grey map background while the map container itself remained correctly sized.
- Interpretation: parking data/count UI was present; the failure was basemap rendering/transport rather than missing parking inventory.
- Constraint: screenshot alone cannot identify whether individual requests errored or hung, so the corrective design covers both explicit tile errors and silent incomplete-grid stalls.
- Status: incorporated into MAP04 regression design.

## EVID-20261020-MAP05 — Irish county boundary provenance
- Date: 2026-10-20.
- Boundary model: OpenStreetMap traditional Irish counties use administrative level 6.
- Current selected-region relations:
  - Cork: OSM relation 332631.
  - Kildare: OSM relation 285833.
  - Dublin: OSM relation 282800.
  - Wicklow: OSM relation 282760.
- Pinned fallback dataset: OSM-derived GeoJSON from `hyperknot/country-levels-export` at commit `536b86946e69d407d544405d6b1a18c6e20eb651`.
- Use: map-focus presentation only; no parking inventory or access inference.
