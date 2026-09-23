# Dublin County Coverage Log

This file is the audit trail for expanding WHITEBLOCK parking coverage across the complete Dublin Region / traditional County Dublin scope.

The log distinguishes implementation completion from source-data completeness. A completed boundary traversal does not imply that every physical or legally usable parking space exists in the source data.

## 2026-09-22 — Step 1: repository and architecture audit

- Confirmed canonical repository: `Utpal-Mishra/WhiteBlock`.
- Reused the existing evidence-first architecture and County Kildare exact-boundary ingestion precedent.
- Confirmed existing Dublin VMS ingestion is a guidance-display source only and must not be misrepresented as parking inventory.
- Identified that GitHub Pages currently builds Cork and Kildare snapshots but not a Dublin county snapshot.

Status: complete.

## 2026-09-22 — Step 2: geographic boundary model

- Defined traditional County Dublin / Dublin Region provenance as OSM relation `282800`.
- Defined current operational partitions as exact admin-level-7 relations:
  - Dublin City `1109531`
  - Fingal `1114164`
  - Dún Laoghaire–Rathdown `1115720`
  - South Dublin `1117469`
- Rejected rectangular bounding-box ingestion because it can leak parking assets from neighbouring counties.

Status: complete.

## 2026-09-22 — Step 3: current official-source review

Configured council evidence probes after reviewing current/open official datasets:

- Dublin City Council parking-meter locations — resource data last updated 2025-06-20.
- Fingal County Council Parking Meters FCC — current 2026 dataset, source date recorded as 2026-07-30.
- South Dublin County Council Parking Meters SDCC — current 2026 dataset, source date recorded as 2026-05-18.
- Dún Laoghaire–Rathdown Parking Tag Information — **resource data last updated 2021-04-15**. The dataset catalogue metadata was refreshed on 2025-06-19, but that metadata date is not treated as new parking evidence.

Precision decision: official meter/sign records are evidence about regulated parking, tariffs, restrictions and hours. They are not automatically converted into standalone parking-area polygons.

Status: complete.

## 2026-09-22 — Step 4: county-wide ingestion implementation

Added `scripts/ingest_dublin_county_parking.py`.

The builder:

- traverses all four exact local-authority relations;
- retrieves mapped car parks plus street-side/lane parking in the full model;
- collects named city/town/village/suburb/neighbourhood anchors;
- assigns each parking asset a transparent geography hierarchy;
- preserves access, fee, opening-hours, maximum-stay, accessibility, EV and geometry evidence where present;
- assigns `unknown` rather than inventing missing access/restriction facts;
- never fabricates availability or capacity;
- probes official council evidence independently;
- emits per-local-authority counts and a county-wide completeness disclaimer.

Commit: `c0d6add013295543777a8882e8cdc1bff4af9a76`.

Status: complete.

## 2026-09-22 — Step 5: methodology documentation

Added `docs/DUBLIN_NETWORK.md` documenting:

- county scope and relation IDs;
- city/town/suburb/village assignment hierarchy;
- source priority;
- precision rules;
- interpretation of county-wide completeness.

Commit: `0dd1f2afdb9f2fe2a3544aae5cfc015d6602cd24`.

Status: complete.

## 2026-09-22 — Step 6: deployment and hard validation

Updated GitHub Pages CI so County Dublin is built and rejected unless:

- all four configured Dublin local-authority boundaries are traversed successfully;
- every authority returns mapped parking inventory;
- the traditional County Dublin provenance relation and all four authority relation IDs match the configured evidence;
- every emitted parking record retains local-authority provenance;
- city/town/suburb/village labelling is present;
- the snapshot carries the mandatory `complete_boundary_traversal_not_complete_real_world_inventory` precision disclaimer.

Commit: `ccdd587dd57a9314233802387bd9518f358e5c1b`.

The first two Pages executions failed inside the combined data-build gate. Deployment was therefore skipped: no partial or misleading Dublin inventory was published. The regular application test suite passed, so the failure was isolated to the live data-build path rather than general application syntax/tests.

Status: validation gate working; live build remediation in progress.

## 2026-09-22 — Step 7: browser integration

Added `web/dublin-network.js` and connected it through `web/runtime-config.js`.

The browser adapter:

- loads `web/data/dublin_parking_snapshot.json` only after validating county scope and boundary provenance;
- supports Dublin destinations across city/town/suburb/village coverage anchors;
- keeps live availability unknown unless an actual observation source reports it;
- exposes the four-authority network in the Network view;
- does not substitute demo parking when Dublin data is unavailable.

Commits:

- `dcdc7de7fdf59a13584c2269196fd4410581ec34`
- `74f4914a839bfc55a2191fc59decee864bdc2dd4`

Status: complete; awaiting successful county snapshot deployment.

## 2026-09-22 — Step 8: ingestion resilience and cross-region safety

Added `scripts/ingest_dublin_county_parking_stable.py` to run the same evidence model against multiple current public Overpass endpoints and a narrower `amenity=parking` discovery query. Regulated on-street parking remains represented through council meter/tag evidence instead of promoting signs/meters into unsupported car-park geometry.

Updated the Pages workflow to use the resilient runner while retaining the same four-authority validation gates.

Also fixed the Cork PostGIS API adapter so later widening of the UI coverage gate for Kildare/Dublin cannot accidentally send a Dublin destination to the Cork-only API.

A further evidence correction was applied after re-checking Smart Dublin: the DLR Parking Tag **resource data** is dated 2021-04-15, despite the dataset catalogue metadata being refreshed in 2025. The stable runner now uses the 2021 resource date for freshness/confidence.

Commits:

- `3940cf9f4808097bbf961be56603d51b834b5942`
- `b13862d6e52fc8b0c8b1b302672d5a34a9b2878a`
- `889c1d98eaf77f156349c94573e8f420f6954e41`
- `f6889d6f0c5384bc13e0f672aeae18b5347e6bd8`

Status: resilient live build running; no precision checks removed.

## 2026-09-22 — Step 9: test coverage

Added `web/dublin-network.js` to the JavaScript syntax gate in `.github/workflows/test.yml`.

Commit: `8ddbb8b55102f0428e46826b72a77a118379dcaf`.

Status: complete.

## 2026-09-23 — Step 10: access intelligence and evidence-resolution queue

Converted Dublin mapped supply into an explicit access-evidence layer rather than treating every mapped asset as equally usable.

Implemented five shared product classes:

- Public
- Customer / destination
- Permissive
- Restricted / private / permit
- Unknown

Precision rules retained:

- missing access evidence is never promoted to public;
- `designated` alone remains uncertain rather than being treated as general public access;
- restricted parking remains visible in evidence/network views but is excluded from normal driver recommendations;
- customer/destination and permissive parking remain conditional;
- existing maximum-stay and opening-hour session rules still apply before ranking.

The validated 9,005-asset snapshot contains 4,442 raw `unknown` records plus one `designated` record retained as uncertain, giving 4,443 unresolved access assets in the WHITEBLOCK taxonomy.

Added `scripts/build_dublin_access_research_queue.py` and deterministic P0–P3 research tiers. Applying the queue to the validated snapshot produced 158 settlement research rows: 7 P0, 14 P1, 41 P2 and 96 P3.

Highest-volume P0 gaps are Mulhuddart, Swords, Castleknock, Ballyogan, Balbriggan, Finglas and Cherrywood. These priorities are evidence-resolution targets, not claims of parking shortage or demand.

Added `.github/workflows/dublin-access-research.yml` so a successful County Dublin validation automatically produces a machine-readable access research artifact from the validated evidence snapshot.

Detailed methodology and current priorities are recorded in:

- `docs/DUBLIN_ACCESS_LAYER.md`
- `docs/DUBLIN_ACCESS_RESEARCH_QUEUE.md`

Status: implemented; end-to-end queue automation triggered for validation.
