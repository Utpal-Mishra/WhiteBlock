# WHITEBLOCK System Architecture

## 1. Purpose

WHITEBLOCK is designed as a **parking spatial-intelligence infrastructure layer**, not only as a consumer parking application.

The system must be able to:

1. discover parking supply;
2. verify what that supply actually represents;
3. model rules, capacity and access;
4. measure and forecast demand/availability;
5. recommend the best parking option for a trip;
6. optimise the wider parking network;
7. identify additional supply only when optimisation is insufficient.

## 2. Two parallel intelligence loops

### A. Parking Supply Discovery Loop

Answers:

> Where does parking exist, where has it changed, what capacity is underused, and where might additional viable supply exist?

Inputs may include:

- local-authority/open parking datasets;
- operator feeds;
- OpenStreetMap and other permitted geospatial data;
- appropriately licensed orthophoto/aerial imagery;
- historical imagery for change detection;
- aggregated and consented geolocation evidence;
- user/operator verification;
- planning, land-use and ownership data where lawfully available.

Outputs:

- verified parking locations;
- unverified parking candidates;
- estimated capacity;
- supply gained/lost;
- underutilised existing capacity;
- candidate spatial opportunities for investigation.

### B. Parking Network Optimisation Loop

Answers:

> How should current parking supply be used more efficiently right now and in the future?

Inputs may include:

- current occupancy;
- historical occupancy;
- parking price/rules;
- trip destination and ETA;
- traffic;
- events;
- weather;
- walking distance/time;
- EV/accessibility requirements;
- historical recommendation outcomes.

Outputs:

- ranked parking recommendations;
- predicted availability at ETA;
- supply-pressure forecasts;
- rerouting recommendations;
- underused-capacity interventions;
- evidence for whether additional supply is actually needed.

The two loops run independently and feed the same Parking Knowledge Graph.

## 3. Logical architecture

```text
DATA SOURCES
│
├── Official/Open Data
├── Parking Operators
├── OSM / GIS
├── Licensed Aerial Imagery
├── Traffic / Events / Weather
├── User / GPS Evidence (consented)
└── Planning / Land-use Sources
        │
        ↓
INGESTION + DATA QUALITY
        │
        ├── schema mapping
        ├── geospatial validation
        ├── deduplication
        ├── freshness checks
        └── source provenance
        │
        ↓
PARKING KNOWLEDGE GRAPH / SPATIAL DATA STORE
        │
        ├──────────────┬──────────────────┐
        ↓              ↓                  ↓
DISCOVERY ENGINE   PREDICTION ENGINE   RULES ENGINE
        │              │                  │
        └──────────────┴──────────────────┘
                       ↓
                DECISION ENGINE
                       │
        ┌──────────────┴──────────────┐
        ↓                             ↓
 DRIVER EXPERIENCE              B2B INTELLIGENCE
 Find / rank / navigate        Supply / demand / strategy
```

## 4. Discovery engine

### 4.1 What imagery is for

Aerial/orthophoto imagery can help identify:

- surface parking areas;
- marked bays;
- parking geometry;
- approximate capacity;
- entrances/exits;
- vehicle clusters;
- newly paved or removed parking areas;
- potentially underused land requiring further investigation.

### 4.2 What imagery is **not** for

Imagery alone must not be used to assert:

- live vacancy;
- legal permission to park;
- public access;
- ownership;
- current tariff;
- permit restrictions;
- planning suitability.

These require separate evidence.

### 4.3 Change detection

Rather than repeatedly analysing every pixel, compare imagery over time and prioritise changed polygons.

Examples:

- grass → paved surface;
- construction → completed car park;
- car park → building site;
- capacity reduced by road redesign;
- recurring vehicle activity on previously unclassified land.

### 4.4 Scan cadence

Use adaptive cadence rather than a fixed nationwide frequency.

- high-change/high-demand zones: monthly when fresh imagery exists;
- suburban areas: every 2–3 months or on new imagery;
- low-change areas: 6–12 months;
- construction/event areas: event-triggered or imagery-triggered.

Do not purchase high-frequency imagery unless the expected operational value justifies the cost.

## 5. Verification lifecycle

```text
DETECTED
   ↓
CANDIDATE
   ↓
PHYSICAL PARKING CONFIRMED
   ↓
ACCESS STATUS CHECKED
   ↓
RULES / OWNERSHIP / LAND-USE CHECKED
   ↓
VERIFIED PUBLIC / PRIVATE / RESTRICTED CLASSIFICATION
   ↓
PUBLISHED
   ↓
REVALIDATED
```

A detected paved area should never automatically become a public parking recommendation.

## 6. Prediction engine

Primary question:

> What is the probability that a useful space will be available when the driver arrives?

Initial features may include:

- location;
- day/time;
- current occupancy;
- lagged occupancy;
- ETA;
- weekday/weekend/holiday;
- event context;
- weather;
- traffic;
- local capacity;
- recent demand trend.

Prediction output should include both an estimate and uncertainty/confidence.

## 7. Decision engine

A parking recommendation should consider more than distance.

Conceptually:

```text
Recommendation Score =
  Availability
- Parking Cost
- Driving Time
- Walking Time
- Restriction Risk
+ Reliability
+ User Preference Fit
```

The exact weights should be learned/tested rather than hard-coded permanently.

Recommendation explanations should be human-readable, for example:

> Recommended because expected availability is high, the walk is only two minutes longer than the closest option, and the planned stay costs less.

## 8. Optimise before expanding supply

WHITEBLOCK should evaluate interventions in this order:

1. understand demand;
2. improve use of existing supply;
3. redistribute demand;
4. unlock underused existing/private capacity;
5. consider temporary supply;
6. only then investigate new physical parking.

This prevents the platform from equating parking pressure with a requirement to pave more land.

## 9. Initial implementation recommendation

A pragmatic MVP stack could use:

- **Python** for ingestion, modelling and geospatial processing;
- **PostgreSQL + PostGIS** for the spatial source of truth;
- **GeoPandas / Shapely** for geospatial processing;
- **FastAPI** for service APIs;
- a modern web client for the driver and B2B interfaces;
- scheduled jobs for ingestion/change detection;
- model/version metadata attached to derived evidence.

Technology choices may change; the data/evidence contract is more important than the initial framework.

## 10. Non-functional requirements

- evidence/provenance for derived facts;
- explicit data freshness;
- confidence scores rather than false certainty;
- privacy by design for location information;
- licensed use of imagery and map data;
- accessibility as a first-class requirement;
- graceful operation when live data is unavailable;
- auditable model and rule versions;
- modular operator/payment integrations.
