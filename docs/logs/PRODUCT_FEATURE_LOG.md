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
