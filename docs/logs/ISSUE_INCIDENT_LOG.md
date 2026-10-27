# Issue / Incident Log

## INC-20261003-001 — Bray update not visible in deployed app

- Date: 2026-10-03
- Severity: medium.
- Detection: user observed that the Bray update did not appear synchronized with the WHITEBLOCK app.
- Root cause: the implementation had been committed to feature branch `feature/bray-seafront-expansion-2026-10-03` and PR #31, but the PR had not yet been merged into `main`. GitHub Pages deploys from `main`, so the live application correctly continued serving the previous version.
- Evidence:
  - PR #31 was open, mergeable and unmerged when checked.
  - PR tests subsequently completed successfully.
  - previous Pages deployment was based on pre-Bray main commit.
- Corrective action:
  - merged PR #31 using squash merge;
  - resulting main commit: `b9269d82fd7d659a8843f861262f099403cc6b4a`;
  - verified `web/index.html` and `web/bray-adapter.js` on main;
  - confirmed Pages workflow #181 triggered from the merged commit.
- Preventive action:
  - distinguish clearly between "implemented on feature branch", "merged to main", and "deployed live" in future release reporting;
  - do not describe a feature as synced/live until the Pages deployment has completed successfully;
  - include branch, commit and deployment state in release-log entries.
- Status: corrective code merge complete; Pages deployment in progress at time of entry.

## INC-20261003-002 — Kildare snapshot omitted after Overpass timeout

- Date: 2026-10-03
- Detection: latest deployed Pages artifact contained Dublin, Cork and Bray regional snapshots but no Kildare snapshot.
- Root cause: the County Kildare exact-boundary Overpass request timed out/failed across public endpoints and the deployment workflow removed the optional snapshot.
- Corrective action: add bounded exact-boundary refresh, tiled exact-boundary fallback capability, and an explicitly partial Kildare County Council/maintained-anchor snapshot if the full refresh still fails.
- Product control: partial Kildare coverage is visibly labelled and is not described as complete county coverage.
- Status: corrective implementation included in PR #32.

## INC-20261004-001 — Mobile coverage map and evidence layout defects

- Date: 2026-10-04.
- Severity: medium.
- Scope: Find/coverage map, Discover cards and Evidence queues on narrow mobile viewports.
- Symptoms:
  - national coverage nodes did not communicate regional inventory/capacity clearly and region focus stopped at a single regional marker;
  - map-view controls consumed excessive horizontal map space;
  - long parking names could collide with the inventory-state badge;
  - Dublin evidence queue rows used fixed minimum column widths and escaped the card boundary.
- Root causes:
  - Ireland overview had a one-level region marker model and hard-coded three-region totals;
  - parking-layout startup explicitly selected Terrain despite Street being the intended product default;
  - Discover title CSS forced a single-line ellipsis beside a fixed badge;
  - evidence integrations embedded fixed-width four-column inline grids.
- Corrective action: PR #33 introduces national → region/county → locality → individual-point drilldown, responsive text/table contracts, a compact + map menu and Street-default preservation.
- Data-integrity control: missing capacity or live availability remains unknown and is never estimated by the UI.
- Status: implemented on branch; CI/production deployment validation pending.

## INC-20261018-001 — Cork and Kildare counts missing from Ireland overview

- Date: 2026-10-18.
- Severity: medium.
- Detection: mobile screenshot showed no regional count card over Cork or Kildare while an overlapping numeric cluster remained near Dublin.
- Root cause:
  - the all-inventory MarkerCluster layer was still allowed to render during national/region browse mode and could visually compete with the dedicated regional summary layer;
  - Bray snapshot loading could mutate `parkingData` and rebuild markers even when no Bray destination had been committed;
  - regional summary counts depended primarily on hydrated in-memory inventories, so a slower adapter could temporarily leave the national node without a numeric total.
- Corrective action:
  - suppress/remove the clustered inventory layer during Ireland/region browse mode;
  - keep Bray inventory passive until a Bray destination is selected;
  - allow regional totals to fall back to the validated snapshot rows/summary;
  - render overview nodes in a dedicated high-priority Leaflet pane and visually emphasise the location count.
- Data integrity: no counts are hard-coded; values remain derived from the deployed evidence snapshots/inventories.
- Status: implemented on branch `fix/overview-region-counts-2026-10-18`; CI/deployment validation pending.

## INC-20261020-MAP04 — Partial/checkerboard Street map on mobile

- Date: 2026-10-20.
- Severity: high for map usability.
- Detection: owner mobile screenshot showed the Ireland Street view with only isolated raster tiles rendered while the rest of the map card remained blank/grey.
- Technical diagnosis:
  - mobile MapLibre can legitimately fall back to raster Street tiles;
  - the raster fallback only failed over after repeated `tileerror` events, so hanging/incomplete requests could leave a persistent checkerboard without ever reaching the error threshold;
  - both `map-fix.js` and the persistent v3 map engine could create basemap renderers during startup, introducing renderer ownership/race risk;
  - the persistent engine resized MapLibre on responsive changes but did not independently revalidate Leaflet geometry with a `ResizeObserver`.
- Corrective action:
  - one startup basemap owner: legacy `map-fix.js` no longer creates its own MapLibre layer;
  - add a 3.2 s raster visible-grid watchdog and early failover from OSM Street to CARTO Street;
  - treat two tile errors as an incomplete provider rather than waiting for three;
  - add central `repairMapGeometry()` using Leaflet `invalidateSize` + MapLibre resize;
  - add persistent-engine `ResizeObserver`, orientation/visibility/resize repair and map-state repair hooks.
- Data impact: none.
- Status: implemented on branch `fix/mobile-map-tile-integrity-2026-10-20`; CI/device deployment validation pending.

## INC-20261021-001 — Kildare destination markers overlap at detailed zoom

- Date: 2026-10-21.
- Severity: medium.
- Symptoms: low zoom showed a 7-option cluster plus a separated ranked option; after zooming, several numbered markers and `0 FREE` labels stacked on top of one another.
- Root causes:
  - detailed zoom forced every record into an individual marker without retaining collision awareness;
  - several Kildare Town source-backed records are only metres apart;
  - null availability was converted with `Number(null)`, yielding the misleading numeric zero label;
  - mobile map height constrained the usable spatial canvas.
- Corrective action: detailed collision fan-out, connector lines, null-availability guard and larger mobile map.
- Status: implemented on feature branch; release validation pending.

## INC-20261027-002 — Hidden defaults in Best Overall recommendation score

- Date: 2026-10-27.
- Severity: medium.
- Detection: Phase 2 completion audit.
- Symptoms: unreported availability contributed as 0.3 and non-comparable session cost contributed as 0.4 to internal ranking.
- User-visible labels were correct, but ordering could still be biased by unsupported values.
- Corrective action: remove placeholder score contributions and disclose missing factors in ranking explanation.
- Status: corrected on feature branch.
