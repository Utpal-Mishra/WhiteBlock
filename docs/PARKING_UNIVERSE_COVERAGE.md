# Parking Universe Coverage — Phase 1.5

## Purpose

Phase 1.5 turns WHITEBLOCK from a set of connected parking inventories into a measurable parking-universe programme.

The objective is:

> represent every materially discoverable parking asset or plausible parking candidate in the target geography, even when it is not currently recommendable or partnered.

This is not a claim that WHITEBLOCK can prove literal 100% real-world completeness. Parking opens, closes, changes rules and may never appear in any public source. The programme therefore measures **source coverage, geographic gaps, evidence resolution and freshness**.

## Separation of states

A record can exist in WHITEBLOCK without being recommendable.

The system must keep these concepts separate:

1. physical parking existence;
2. canonical identity;
3. access classification;
4. rules / maximum stay;
5. capacity / geometry evidence;
6. recommendation eligibility;
7. live availability;
8. partnership / commercial status.

Example:

```text
physical parking confirmed
  → customer-only
  → 120 min maximum stay
  → no live feed
  → not eligible for a 4h stay
  → no partnership
```

The asset still belongs in the parking universe.

## Coverage classes

Phase 1.5 tracks:

- public off-street;
- on-street;
- accessible;
- EV;
- Park & Ride;
- station/transport;
- hospital;
- university/campus;
- airport;
- retail/customer parking;
- private/shared parking;
- permit/restricted parking;
- temporary/event parking;
- imagery/GIS candidates;
- closed/removed historical supply.

## Required source families

The initial source-family checklist is stored in:

`config/parking_universe_sources.json`

It currently requires each geography to assess:

- official/local-authority;
- open geospatial;
- accessible parking;
- parking rules/by-laws;
- transport/Park & Ride;
- retail/customer parking;
- operator facilities;
- EV parking;
- licensed imagery.

A family can be:

- `integrated`;
- `ready_to_integrate`;
- `gap`.

These statuses measure the work programme. They do not prove that every asset represented by that family has been discovered.

## Initial source-universe expansion

The first registry pass records the sources already integrated and several official datasets ready for the next ingestion work.

High-priority Dublin additions include:

- Dublin City Council multistorey car-park availability/inventory;
- Dublin City accessible parking;
- Dublin City parking-meter locations/tariffs/zones;
- South Dublin parking meters;
- Dún Laoghaire–Rathdown parking meters/runs.

The registry also records Galway City Council's structured car-parking dataset as a future-region source so Ireland expansion can reuse the same source contract.

## Deploy-time coverage report

Every Pages build now produces:

`web/data/parking_universe_coverage.json`

The builder:

`scripts/build_parking_universe_coverage.py`

reads the regional deployment snapshots and reports, per region:

- known asset count;
- coordinate coverage;
- polygon-geometry coverage;
- access resolution;
- capacity resolution;
- rules/pricing resolution;
- accessible/EV evidence;
- broad asset-class counts;
- source-family progress;
- unresolved source-family gaps.

The browser-local candidate queue is explicitly excluded from this deployment metric because GitHub Pages has no authenticated shared write service.

## Programme readiness score

The UI shows a **programme readiness score**.

It combines:

- progress across required source families; and
- resolution of important inventory fields.

It is intentionally labelled as a progress indicator only.

It must never be interpreted or marketed as:

> “WHITEBLOCK has X% of all real-world parking.”

## UI

Discover now includes a **Parking Universe Coverage** section.

For Cork, Kildare, Dublin and Wicklow it shows:

- deployed known assets;
- access/capacity/rules/geometry resolution;
- integrated source families;
- source families ready for integration;
- remaining gaps.

This lets Phase 1.5 work be measured directly from the product.

## Immediate implementation sequence

### 1. Source-universe reconciliation

For each connected county:

1. enumerate official/open/transport/operator/retail/imagery sources;
2. assign source family and licence;
3. integrate/stage lawful structured sources;
4. reconcile to canonical `WB-PARK-*` identity;
5. preserve unresolved records rather than discard them.

### 2. Access and rules resolution

Prioritise records where:

- physical parking exists;
- access is unknown;
- maximum stay is unknown;
- customer/private restrictions are unclear.

These records are high-value because they improve both universe completeness and recommendation safety.

### 3. Retail/customer parking

Create a repeatable candidate workflow for:

- supermarkets;
- shopping centres;
- retail parks;
- other customer-parking facilities.

Presence of a retail site is not enough to infer public parking. Map/imagery/source evidence may create a candidate, while access, maximum stay and customer restrictions require separate verification.

### 4. Transport parking

Systematically reconcile:

- Park & Ride;
- railway/station parking;
- bus/transport interchange parking.

### 5. Change detection

Once a geography has broad source coverage, move from manual discovery to maintenance:

- new asset detected;
- asset removed/closed;
- geometry changed;
- access/rule changed;
- evidence stale.

## Phase 1.5 exit gate

A geography is partnership-ready only when:

- no material known source family remains unassessed;
- no material geographic gap remains unprocessed;
- unresolved parking is represented explicitly as candidate/restricted/unknown rather than omitted;
- source freshness and stale records are measurable;
- the remaining uncertainty is documented.

Partnerships then enrich the existing parking universe with booking, payment, trusted live data, verified rules and commercial access instead of defining basic coverage.

## Implementation tranche 1 — canonical state + shared review queue

Started 2026-10-27.

The first operational tranche moves Phase 1.5 beyond a coverage dashboard:

- `db/migrations/006_parking_universe_states.sql` separates physical state, recommendation state, partnership state and live-data state on canonical parking assets.
- `parking_partner_capability` attaches future booking/payment/live/session capabilities to an existing `WB-PARK-*` asset rather than creating a second commercial identity.
- The deploy-time builder emits `web/data/parking_universe_review_queue.json`.
- Review items are derived from source-backed deployed records with unresolved coordinates, access, rules, capacity, polygon geometry or explicit candidate/unverified state.
- Review priority is operational only; it does not change canonical truth or recommendation eligibility.
- Browser-local user proposals remain separate from the shared deployment queue until a write-backed review service exists.

The operating loop is now:

`discover → retain → reconcile → review evidence gaps → classify → recommend when eligible → enrich through partnership later`.

