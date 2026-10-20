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

