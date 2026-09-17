# WHITEBLOCK Decision Log

This file records important project decisions so the architecture does not drift without an explicit reason.

---

## 2026-09-11 — Master brand

**Decision:** Use **WHITEBLOCK** (singular) as the working master brand.

**Why:**

- distinctive enough to support a broader spatial-intelligence story;
- not restricted to a parking-payment application;
- can represent the platform/system rather than individual parking spaces;
- allows `WhiteBlocks` to be used conceptually for individual spatial opportunities if useful later.

**Caveat:** Complete formal trademark/company/domain clearance before commercial launch.

---

## 2026-09-11 — Canonical repository

**Decision:** Use `Utpal-Mishra/WhiteBlock` as the canonical project repository.

Repository:

`https://github.com/Utpal-Mishra/WhiteBlock`

---

## 2026-09-11 — Product category

**Decision:** Build WHITEBLOCK as **parking/spatial intelligence infrastructure**, not another parking-payment app.

The first differentiator is decision intelligence:

> where should a driver park for a specific trip, and how should the parking network use existing supply more effectively?

---

## 2026-09-11 — Ireland first, Cork first

**Decision:** Start in Ireland with a controlled Cork proof of concept.

**Why:**

- manageable geography;
- useful public/open parking data;
- enough parking complexity to test the architecture;
- enables learning before Dublin/national expansion.

---

## 2026-09-11 — Destination-first UX

**Decision:** The primary consumer interaction starts with the destination/trip rather than a map of parking facilities.

Core inputs:

- destination;
- ETA;
- expected stay;
- EV/accessibility needs;
- cost/distance preference.

---

## 2026-09-11 — Two parallel intelligence loops

**Decision:** Parking Supply Discovery and Parking Network Optimisation run in parallel.

Discovery does not pause optimisation, and optimisation does not depend on discovering new land.

---

## 2026-09-11 — PostGIS spatial system of record

**Decision:** Use **PostgreSQL + PostGIS** as the persistent spatial core for the pilot architecture.

**Why:**

- canonical parking assets need durable relational identity;
- parking discovery and reconciliation require spatial indexes, distance queries and later polygon operations;
- observation history, evidence and source links need transactional consistency;
- PostgreSQL provides a practical path from local Docker development to managed production hosting.

The file-based Cork ingestion remains a reproducible raw/curated boundary; PostGIS becomes the durable downstream source of truth.

---

## 2026-09-11 — Source staging before canonical mutation

**Decision:** Secondary datasets must enter a `source_record` staging layer before they can change the canonical parking inventory.

**Reason:** A source record can be stale, duplicated, private, poorly geocoded or simply refer to an existing parking asset under another name. Ingestion alone is not evidence that a new canonical location should exist.

---

## 2026-09-11 — Conservative entity reconciliation

**Decision:** Prefer **false non-matches over false merges**.

Initial fuzzy reconciliation combines:

- normalized-name similarity;
- spatial proximity;
- capacity similarity when available.

A fuzzy match may auto-link only when it passes high score/name/proximity thresholds **and** has a clear margin over the second-best candidate. Ambiguous records remain reviewable.

Exact durable source links always take precedence over fuzzy matching on subsequent runs.

---

## 2026-09-11 — Identity and field truth are separate

**Decision:** Entity reconciliation answers only whether two records describe the same physical parking asset. It does not automatically decide which source's capacity, price, restrictions or access classification should win.

Field values continue to use provenance, confidence, freshness and source priority.

---

## 2026-09-11 — Imagery role

**Decision:** Use appropriately licensed satellite/aerial/orthophoto imagery for **parking discovery, capacity estimation and change detection**, not as the core source for real-time vacancy.

**Reason:** imagery capture cadence, resolution, cloud/occlusion and licensing make live individual-bay occupancy unreliable for the initial architecture.

---

## 2026-09-11 — No scraped proprietary map imagery

**Decision:** Do not build computer-vision training/extraction around imagery whose licence prohibits machine analysis, storage or derivative geodata.

Use open, government or appropriately licensed imagery sources.

---

## 2026-09-11 — Candidate before parking

**Decision:** A newly detected physical parking-like area is a `PARKING_CANDIDATE`, not automatically a verified parking location.

Required verification can include:

- physical use;
- access class;
- ownership/land status where necessary;
- parking rules;
- public/private/restricted classification.

---

## 2026-09-11 — Confidence and evidence

**Decision:** Store attribute-level evidence/confidence rather than one binary truth value for an entire location.

Geometry, capacity, pricing, access and restrictions may each have different confidence.

---

## 2026-09-11 — Adaptive imagery cadence

**Decision:** Do not mandate weekly nationwide imagery scans.

Use adaptive cadence based on:

- availability of fresh imagery;
- rate of physical change;
- parking pressure;
- expected value of detecting change;
- imagery cost.

Monthly analysis may be appropriate for selected Cork pilot/high-change areas, while low-change areas can be checked less often.

---

## 2026-09-11 — Change detection

**Decision:** Prioritise changed polygons between imagery periods rather than repeatedly processing every location at equal depth.

The system should detect both **new supply** and **lost supply**.

---

## 2026-09-11 — Optimise before new construction

**Decision:** New physical parking is a late-stage intervention.

Prioritise:

1. existing utilisation;
2. demand redistribution;
3. underused/private/shared capacity;
4. temporary capacity;
5. only then investigate new parking opportunities.

---

## 2026-09-11 — Payments later

**Decision:** Do not build proprietary payment processing in the first MVP.

Integrate/deep-link to existing operators where permitted. WHITEBLOCK should first prove its parking decision and intelligence advantage.

---

## 2026-09-11 — Sensors later

**Decision:** Do not begin with proprietary city-wide sensors, ANPR or camera infrastructure.

Use existing/open/operator data first and add physical sensing only where its incremental value is demonstrated.

---

## 2026-09-11 — B2B is a first-class future product

**Decision:** Architect data so the same intelligence can support both drivers and organisations.

Potential B2B users include councils, operators, hospitals, universities, airports, retail/property owners and event venues.

Potential B2B outputs include:

- occupancy/utilisation;
- demand forecasts;
- supply adequacy;
- change detection;
- underused capacity;
- scenario/strategy recommendations.

---

## 2026-09-17 — API-first browser data delivery with evidence-backed fallback

**Decision:** The browser should prefer a read-only WHITEBLOCK API backed by PostGIS when an API endpoint is configured. The public GitHub Pages deployment should retain the latest official Cork snapshot as a fallback rather than connecting directly to PostgreSQL or substituting demo values.

**Why:**

- GitHub Pages is static and must never contain database credentials;
- destination-specific spatial queries belong in PostGIS/API rather than the browser;
- the existing official Cork ingestion can still produce a safe deployment snapshot while backend hosting is being established;
- API outages should degrade to recent evidence-backed data, not fabricated parking availability;
- the same API contract can later support mobile apps, operator dashboards and other clients.

**Data priority:**

```text
PostGIS API
   ↓ unavailable
Official build-time snapshot
   ↓ unavailable
No parking values shown
```

**Confidence:** Keep the API and snapshot confidence meaning aligned: source quality + freshness + field completeness.

**Deployment boundary:** The API requires a container/server runtime and is not hosted by GitHub Pages. Once a backend is deployed, configure the Pages application using the `WHITEBLOCK_API_BASE_URL` repository variable.

---

## Future decisions to record

Add dated entries when choosing or materially changing:

- Cork pilot boundary;
- primary map/geospatial provider;
- imagery provider/licence;
- production database/hosting provider;
- first secondary production data source;
- prediction-model strategy;
- recommendation-score design;
- privacy/telemetry policy;
- public API policy;
- commercial model;
- final trademark/domain decision.
