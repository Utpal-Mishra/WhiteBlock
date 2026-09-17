# WHITEBLOCK

**Spatial Intelligence for Better Parking**

WHITEBLOCK is an Ireland-first parking and spatial-intelligence infrastructure project designed to help people, cities and operators **discover, understand, predict and optimise parking supply**.

The project starts with a Cork proof of concept and is intentionally broader than a parking-payment app. WHITEBLOCK aims to become an intelligence layer connecting public parking, private parking, accessible bays, EV spaces, underused capacity, parking rules, live occupancy, demand forecasting and potential new supply.

## Product thesis

Most parking tools answer only part of the journey: where a car park is, how to pay, or how to reserve a space. WHITEBLOCK is being designed around a harder question:

> **Where should I park for this trip, will space likely be available when I arrive, am I allowed to park there, and is existing parking supply being used efficiently?**

WHITEBLOCK separates two core problems:

1. **Parking Supply Discovery** — identify known, unknown, underused, changed or potentially convertible parking supply.
2. **Parking Network Optimisation** — predict demand and availability, rank options and improve utilisation of existing supply before recommending new physical capacity.

These loops run in parallel over a shared, evidence-backed parking inventory.

## Core capabilities

### Discover
- Ingest official council and operator datasets.
- Use appropriately licensed aerial/orthophoto imagery and GIS data to identify parking geometry and candidate supply.
- Detect parking-supply changes over time.
- Use aggregated geolocation evidence, where lawful and consented, to identify repeated parking behaviour.
- Identify underused existing parking before proposing new land conversion.

### Understand
- Capacity and geometry.
- Public/private/permit/customer access.
- Pricing and operating hours.
- Maximum stay and parking restrictions.
- Accessible and EV bays.
- Entrances, vehicle access and nearby destinations.
- Confidence and provenance for every important field.

### Predict
- Availability at estimated arrival time rather than only current occupancy.
- Demand by location, time and trip context.
- Event-driven and weather/traffic-related pressure.
- Supply adequacy and likely overflow.

### Optimise
- Rank parking for a destination by availability, price, walking distance, total journey time and restriction risk.
- Redistribute demand toward underused supply.
- Identify when pricing, routing, reservations or shared/private capacity can solve pressure.
- Recommend investigation of new supply only after existing capacity has been evaluated.

## Application UI

WHITEBLOCK includes a responsive driver/intelligence application under `web/`.

The Find experience no longer ships hard-coded parking locations, availability or confidence values. The public GitHub Pages deployment builds an evidence-backed Cork snapshot from the official ingestion pipeline before every deployment and on an hourly schedule. The browser ranks nearby assets relative to the selected destination and derives KPI values from the loaded evidence.

The data priority is:

```text
PostGIS API (when configured)
        ↓ fallback
Build-time Cork official snapshot
        ↓ fallback
No parking values shown
```

WHITEBLOCK deliberately does **not** substitute demo parking values when a data source is unavailable.

Primary views:

- **Find** — destination-first parking search, map layers, Street View handoff and evidence-backed nearby recommendations.
- **Discover** — supply discovery and change-detection workspace.
- **Network** — parking-supply adequacy, demand and redistribution strategy.
- **Evidence** — observed/inferred/predicted truth states, confidence and freshness.

Run the frontend locally:

```bash
python -m http.server 8000 -d web
```

Then open `http://localhost:8000`.

See [UI Design System](docs/UI_DESIGN_SYSTEM.md) and [WHITEBLOCK API](docs/API.md).

## Implementation foundation

WHITEBLOCK has a persistent **Parking Inventory + Spatial Reconciliation Layer**.

```text
EXTERNAL SOURCES
      ↓
RAW SNAPSHOTS / SOURCE STAGING
      ↓
NORMALISATION
      ↓
ENTITY RECONCILIATION ─────────→ REVIEW QUEUE
      ↓
POSTGIS SPATIAL CORE
      ├── parking_location
      ├── parking_observation
      ├── parking_evidence
      ├── parking_source_link
      ├── source_record
      ├── entity_match_candidate
      └── parking_candidate
      ↓
READ-ONLY WHITEBLOCK API
      ↓
APPLICATION / SNAPSHOT FALLBACK
```

Stable parking assets receive canonical `WB-PARK-*` identifiers. Live availability is stored separately as time-series observations so changing occupancy never overwrites the permanent asset record.

Secondary sources are staged before they can affect canonical inventory. Exact source links are reused first; otherwise WHITEBLOCK uses conservative spatial/name/capacity reconciliation and sends ambiguous records to review.

## Local backend development

Copy the environment template and use a non-default password:

```bash
cp .env.example .env
```

Start PostGIS and the API together:

```bash
docker compose up --build
```

The API is then available at:

```text
http://localhost:8080
```

Health check:

```text
GET http://localhost:8080/health
```

Nearby parking query:

```text
GET http://localhost:8080/v1/parking/nearby?lat=51.8985&lng=-8.4756&radius_km=5&limit=8
```

See [WHITEBLOCK API](docs/API.md) for the API contract and browser configuration.

## Cork authoritative baseline

The first authoritative ingestion target is the Cork City Council real-time parking dataset.

```bash
python scripts/ingest_cork_parking.py
python scripts/load_cork_to_postgis.py
```

The ingestion process preserves the raw source snapshot, validates source fields and quality rules, separates stable inventory from live observations, quarantines inconsistent records, and writes a run manifest with a SHA-256 evidence hash.

For GitHub Pages, the deployment workflow additionally exports a browser-safe snapshot:

```bash
python scripts/export_web_snapshot.py \
  --input-dir data/cork \
  --output web/data/parking_snapshot.json
```

Generated pilot data is excluded from Git; the Pages artifact contains only the fields required by the UI.

See [Cork Ingestion Runbook](docs/CORK_INGESTION_RUNBOOK.md).

## Secondary-source reconciliation

Normalize a secondary parking dataset into JSON/JSONL records containing at minimum:

```text
external_id
name
latitude
longitude
```

Stage it:

```bash
python scripts/stage_source_records.py --source-key osm_parking --input data/osm_parking.jsonl
```

Reconcile it:

```bash
python scripts/reconcile_source_records.py --source-key osm_parking
```

A fuzzy match auto-links only when the score, name similarity, spatial distance and best-vs-second margin all pass conservative gates. Otherwise the record remains reviewable.

Manual confirmation example:

```bash
python scripts/resolve_entity_match.py confirm \
  --staging-id 123 \
  --parking-id WB-PARK-IE-CORK-000012
```

## Key design principle

**Physical parking detection is not the same as legal/public parking availability.**

A location detected from imagery is first stored as a candidate. It must be validated for access, ownership, planning constraints and parking rules before it can be presented as verified public parking.

Likewise, aerial imagery is treated as a supply-discovery and change-detection source, **not as live occupancy infrastructure**.

## Initial geography

### Phase 1 — Cork
Use Cork as the first controlled test market because it offers a manageable geography and useful public parking data sources.

The first pilot should prove that WHITEBLOCK can:

- consolidate known parking inventory;
- maintain a repeatable authoritative ingestion process;
- persist a spatial source of truth;
- reconcile multiple datasets without unsafe duplicate merges;
- separate stable assets from live observations;
- identify missing or underrepresented parking assets;
- estimate useful capacity attributes;
- predict parking pressure and availability where data permits;
- produce evidence-backed parking recommendations;
- identify underused capacity before proposing additional parking supply.

### Later expansion
Dublin → Galway/Limerick/Waterford → national Ireland coverage → selected international markets.

## Conceptual architecture

```text
                         WHITEBLOCK
               Parking Spatial Intelligence
                              │
            ┌─────────────────┴─────────────────┐
            │                                   │
   SUPPLY DISCOVERY LOOP              NETWORK OPTIMISATION LOOP
            │                                   │
  Official/Open Data                     Live Occupancy
  Aerial / Orthophoto                    Historical Demand
  GIS / OSM                              Pricing / Rules
  Change Detection                       Traffic / Events
  Aggregated GPS Evidence                Forecasting
  User / Operator Verification           Routing
            │                                   │
            └─────────────────┬─────────────────┘
                              ↓
               POSTGIS PARKING INVENTORY LAYER
                              ↓
                    PARKING KNOWLEDGE GRAPH
                              ↓
                     WHITEBLOCK API
                              ↓
           FIND / DISCOVER / NETWORK / EVIDENCE
```

## Repository structure

```text
WhiteBlock/
├── README.md
├── Dockerfile.api
├── docker-compose.yml
├── requirements.txt
├── api/
│   └── app.py
├── web/
│   ├── index.html
│   ├── app.js
│   ├── live-data.js
│   ├── api-adapter.js
│   ├── runtime-config.js
│   ├── map-fix.js
│   └── styles.css
├── config/
│   ├── cork_pilot.yaml
│   └── cork_sources.yaml
├── data_contracts/
│   ├── parking_inventory.schema.json
│   └── parking_observation.schema.json
├── db/
│   └── migrations/
├── scripts/
│   ├── ingest_cork_parking.py
│   ├── export_web_snapshot.py
│   ├── load_cork_to_postgis.py
│   ├── stage_source_records.py
│   ├── reconcile_source_records.py
│   └── resolve_entity_match.py
├── tests/
│   ├── test_api.py
│   ├── test_db_integration.py
│   ├── test_ingest_cork_parking.py
│   ├── test_reconciliation.py
│   └── test_web_ui.py
└── docs/
    ├── API.md
    ├── CORK_INGESTION_RUNBOOK.md
    ├── CORK_MVP.md
    ├── DATA_EVIDENCE_MODEL.md
    ├── DATA_SOURCES.md
    ├── DECISIONS.md
    ├── PARKING_INVENTORY_LAYER.md
    ├── PRODUCT_PRINCIPLES.md
    ├── ROADMAP.md
    ├── SPATIAL_STORAGE_RECONCILIATION.md
    ├── SYSTEM_ARCHITECTURE.md
    └── UI_DESIGN_SYSTEM.md
```

## Documentation

- [WHITEBLOCK API](docs/API.md)
- [UI Design System](docs/UI_DESIGN_SYSTEM.md)
- [Spatial Storage & Entity Reconciliation](docs/SPATIAL_STORAGE_RECONCILIATION.md)
- [Parking Inventory Layer](docs/PARKING_INVENTORY_LAYER.md)
- [Cork Ingestion Runbook](docs/CORK_INGESTION_RUNBOOK.md)
- [System Architecture](docs/SYSTEM_ARCHITECTURE.md)
- [Cork MVP](docs/CORK_MVP.md)
- [Data & Evidence Model](docs/DATA_EVIDENCE_MODEL.md)
- [Product Principles](docs/PRODUCT_PRINCIPLES.md)
- [Data Source Register](docs/DATA_SOURCES.md)
- [Roadmap](docs/ROADMAP.md)
- [Decision Log](docs/DECISIONS.md)

## Current status

**Stage:** Cork evidence-backed application + PostGIS API foundation.

WHITEBLOCK now has:

- authoritative Cork ingestion;
- canonical PostGIS parking inventory;
- historical observations and evidence storage;
- conservative multi-source entity reconciliation;
- hourly evidence-backed GitHub Pages snapshot generation;
- destination-sensitive parking ranking with no hard-coded demo parking values;
- a read-only PostGIS API for nearby parking and evidence;
- browser API-first / snapshot-fallback behavior;
- responsive driver/intelligence UI with national destination search.

The public GitHub Pages application continues to use the snapshot until a container-hosted API URL is deployed and configured through the `WHITEBLOCK_API_BASE_URL` repository variable.

The next data objective is to onboard and reconcile broader Cork parking inventory beyond the current authoritative live-feed subset, so searches in different parts of Cork have materially richer nearby supply rather than only the locations exposed by the live feed.

## Working brand

**WHITEBLOCK** is the working master brand for this project. The project should complete appropriate trademark, company-name and domain clearance before public commercial launch.

---

WHITEBLOCK is being built around one operating principle:

> **Discover → Verify → Measure → Predict → Optimise → Expand only when necessary → Learn → Repeat.**
