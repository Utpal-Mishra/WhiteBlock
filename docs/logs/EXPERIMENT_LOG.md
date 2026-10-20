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

## EXP-20261020-MAP02 — Existing and future region clustering
- Test sample: 7 synthetic clustered parking locations in each of Cork, Kildare, Dublin, Wicklow, Galway, Donegal.
- Expected: zoom 7 -> one count-7 group per sample area; zoom 17 -> seven individual site markers; Bray remains included in Wicklow with stable ID; duplicate Cork county pool does not inflate count.
- Automation: `tests/test_universal_marker_policy.js` plus ranked GL unit; Android visual test remains outstanding.

## EXP-20261020-MAP03 — Mobile vector failure recovery
- Hypothesis: true Leaflet raster fallback solves blank/delayed vector-map cases while preserving real parking point geography.
- Simulations: synchronous MapLibre init exception; 4500ms style health timeout; three OSM tile failures; assert CARTO fallback; assert no layout overlay programmatically activated.
- Manual acceptance: Android Cork parking search should show actual road map or geographic raster despite WebGL failure; explicit Parking Layout toggle/Back to map must work.

## EXP-20261020-COV04 — Count and camera transition verification
- Hypothesis: county auto-fitting full parking location bounds plus zoom-clustering is clearer than a mandatory town-group stage.
- Fixtures: Ireland 4 active county badges; Cork 7, Dublin 10, Kildare 4, Wicklow 5 + Bray 1 (synthetic test data; not live counts).
- Cases: Ireland overview camera, per-county fit bounds, Cork/Dublin site detail, no repeated camera reset on ready events, initial Bray-only followed by full Wicklow inventory; no live availability invented.
- Acceptance: CI green and manual Android map with actual source coverage and real Street basemap.

## EXP-20261020-MAP04 — Mobile partial-tile recovery hypothesis

- Date: 2026-10-20.
- Observation: Ireland Street map rendered a checkerboard/partial raster grid on mobile.
- Hypothesis: a raster request can stall without enough `tileerror` events to trigger the existing provider failover; duplicate renderer startup increases the probability of unstable map state.
- Change under test: single renderer ownership + bounded incomplete-grid watchdog + responsive Leaflet geometry repair.
- Automated acceptance: simulated MapLibre exception must keep a geographic map; a stalled raster fallback must switch to alternate Street tiles even without explicit tile errors; no schematic layout may auto-open.
- Manual acceptance: Android/mobile Ireland view must fill the entire map card, then remain intact through county switches, orientation changes and returning from background.
- Status: implementation ready for CI/device validation.

## EXP-20261020-MAP05 — County-border focus experiment
- Date: 2026-10-20.
- Hypothesis: a persistent exact county outline makes Cork/Kildare/Dublin/Wicklow focus materially clearer than zoom alone.
- Treatment: lime administrative outline + low-opacity fill while county filter is selected.
- Control: existing county auto-fit with no boundary.
- Acceptance: user can identify the focused county at a glance; parking clusters remain legible; Ireland reset removes the outline; switching county never leaves the previous border.
- Status: implementation ready for CI/mobile validation.
