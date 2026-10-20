# Product / Feature Log

## PROD-20261003-001 — Bray coverage in Find and Ireland Coverage View

- Date: 2026-10-03
- Feature: Bray added as a live evidence-pilot coverage node and fallback searchable destination.
- UI changes: application shell now describes Cork + Bray pilots; Ireland overview includes Bray.
- Find behaviour: Bray destinations can return regional evidence-backed parking assets using existing ranking/cards/map.
- Evidence behaviour: live availability is explicitly unknown when unsupported.
- User value: a beach/seafront destination is no longer treated as outside supported parking coverage.
- Status: implemented on feature branch.

## PROD-20261003-002 — Aerial evidence visibility in WHITEBLOCK

- Date: 2026-10-03
- Feature: regional records can display aerial-review state in Find cards, Discover inventory and Evidence summary.
- Region coverage: Cork, Kildare, Dublin and Bray are wired into the application runtime.
- Discover: Bray is added as a fourth evidence region/filter.
- Kildare: app accepts a clearly labelled partial evidence-anchor fallback when full county refresh is unavailable.
- UX principle: imagery evidence is described as physical-supply evidence, never as live availability.
- Status: implemented on PR #32.

## PROD-20261004-001 — Hierarchical parking coverage map and compact controls

- Date: 2026-10-04.
- Feature: hierarchical national parking exploration.
- Flow: Ireland overview → connected region/county → city/town/settlement group → individual mapped parking points.
- National nodes: show mapped location count plus published/known capacity where available; live free-space totals appear only when a source reports them.
- Mobile control: Street is visible/default; Terrain, Satellite, Street View and Parking Layout are available from a + menu.
- Readability: long Discover parking names wrap; evidence research rows collapse from four columns to two/one columns on narrow screens.
- Status: implemented in PR #33.

## PROD-20261018-001 — Persistent regional count cards in Ireland overview

- Date: 2026-10-18.
- Feature correction: regional map cards now persistently expose mapped/evidence-backed location totals for Cork, Kildare, Dublin and Bray.
- Count source order: hydrated canonical regional inventory first; validated deployment snapshot rows/summary as fallback.
- Visual hierarchy: location total is the strongest line in the regional card; published capacity and reported free-space totals remain secondary and appear only where evidence exists.
- Browse behaviour: individual clustered parking markers are intentionally suppressed until the user drills into a region/locality or commits a destination.
- Status: implemented; deployment validation pending.

## PROD-20261018-002 — Parking Universe Registry

- Date: 2026-10-18.
- Product capability: represent all known/plausible parking supply in the canonical registry, including assets that are not currently recommendable.
- Required states: verified public, customer/time-limited, permit/restricted, private/shared, temporary/event, unknown access, unverified candidate and closed/removed history.
- Recommendation boundary: only assets meeting access/rule/evidence criteria may be recommended; candidate/restricted records remain visible to the evidence and coverage systems.
- Partnership boundary: partnership status enriches an asset rather than creating the asset.
- Status: roadmap/design adopted.

## FEAT-20261019-WW01 — Wicklow browse and search
- Date: 2026-10-19; status: feature branch awaiting integration validation.
- UI: Wicklow connected-region summary, selectable focus, town grouping, destination parking markers, Discover filtering and search inventory.
- Labels: mapped/evidence-backed inventory, not live parking availability or county completeness.
- Regression controls: existing Bray pilot and other regional views retained.

## FEAT-20261020-WW01 — Remove duplicate Bray county filter
- Date: 2026-10-20; status: branch.
- UX contract: national and inventory-region filters list exactly Cork, Kildare, Dublin and Wicklow. Bray appears inside Wicklow as a locality; clicking Wicklow shows its parking plus Bray locations.
- Provenance: individual Bray source remains labelled as the seafront pilot.

## FEAT-20261020-WW02 — County-only coverage markers and preserved town search
- Date: 2026-10-20; feature scope: remove a legacy Bray top-level map marker that visually suggested an additional county; county navigation remains Cork, Kildare, Dublin and Wicklow.
- Bray remains a named Wicklow locality and searchable destination; curated parking evidence and Wicklow county aggregation are unchanged.
- Implementation: `web/app.js` legacy marker/status cleanup; cache version bump for initial HTML entry.
- Status: awaiting PR validation; no standalone Bray region/filter expected.

## FEAT-20261020-CL01 — Map aggregation and expanding ranked markers
- User report: mobile Cork numbered 01–07 map symbols overlap when zooming out, including Ireland coverage mode.
- Behaviour: no destination ranks over national/region county cards; low-zoom clustered badge shows aggregate parking-location count, tap zooms; higher zoom reveals 01–07 at true positions.
- Existing large-inventory MarkerCluster remains available and sourced independently.
- Status: PR #38 pending CI and publication smoke check.

