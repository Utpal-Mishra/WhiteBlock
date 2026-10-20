# Experiment Log

## EXP-20261003-001 — Bray seafront mixed-evidence coverage test

- Date: 2026-10-03
- Hypothesis: combining official rules, mapped assets and imagery evidence will surface materially more useful parking coverage around Bray seafront than relying on a single structured feed.
- Test area: Bray seafront, station area, Florence Road, Dargle and Bray Head edge.
- Initial inventory: 7 canonical assets plus 1 bay-level candidate work item.
- Success measures:
  - destination search returns Bray parking assets;
  - no fabricated free-space values;
  - duplicate listings are not double counted;
  - rule/source provenance remains inspectable;
  - unsupported access remains unknown.
- Next validation: field/photo verification of Strand Road bay geometry, signs, accessible/EV bays and capacities.
- Status: implementation ready for validation.

## EXP-20261003-002 — Four-region aerial review batch

- Date: 2026-10-03
- Review ID: WB-IMG-20261003-001.
- Scope: 8 Dublin + 8 Cork + 8 Kildare + 7 Bray = 31 records.
- Results: 17 physical parking visible; 9 parking context visible/extent ambiguous; 3 no distinct footprint confirmed; 2 visible but stale.
- Geometry follow-up: 7 candidate-polygon tasks identified; 0 polygons automatically created.
- Occupancy result: 0 live occupancy/free-space values inferred.
- Outcome: supports imagery as a useful physical-supply validation layer with explicit uncertainty.
- Status: completed.

## EXP-20261019-WW01 — Wicklow multi-area smoke test
- Date: 2026-10-19; status: automated offline tests added; live map QA pending.
- Hypothesis: an OSM county snapshot plus Bray deduplication will expose useful parking records in major and rural localities without false occupancy.
- Method: unit-test boundary selectors, null policy, open-way geometry and Bray radius; after deployment compare five sample destination queries and counts to real source records.
- Pass gate: no fabricated live figures; no Bray duplication; exact county attribution; usable town drill-down.

## EXP-20261020-CL01 — Seven-marker zoom regression
- Hypothesis: a 56px projected-distance cluster threshold and zoom-17 release eliminate mobile overlap without moving physical locations.
- Procedure: mock Leaflet+MapLibre in Node; test Cork seven-location fixture at national view, zoom 7, cluster tap, zoom 17, return to Ireland and county browse.
- Success: zero stale ranked features in browse; one count-7 feature at low zoom; seven ranked points at detailed zoom; prior IDs and 01–07 ranking retained.
- Caveat: additional hands-on Android pinch-zoom/pan and basemap-mode smoke tests required.

