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

## Implementation foundation

Phase 1 starts with a formal **Parking Inventory Layer**.

```text
DATA SOURCES
    ↓
RAW SNAPSHOTS
    ↓
NORMALISATION + ENTITY MATCHING
    ↓
PARKING INVENTORY LAYER ───────→ EVIDENCE / PROVENANCE
    │
    ├── stable parking asset attributes
    │
    └── PARKING OBSERVATION LAYER
             ↓
       live + historical state
             ↓
   FORECASTING / RECOMMENDATION / OPTIMISATION
```

Stable parking assets receive canonical `WB-PARK-*` identifiers. Live availability is stored separately as time-series observations so a changing space count never overwrites the permanent asset record.

The first authoritative ingestion target is the Cork City Council real-time parking dataset. The Cork source registry, pilot boundary and machine-readable data contracts live under `config/` and `data_contracts/`.

## Run the first Cork ingestion

The first executable pipeline uses only the Python standard library.

```bash
python scripts/ingest_cork_parking.py
```

Run its unit tests with:

```bash
python -m unittest tests/test_ingest_cork_parking.py
```

The ingestion process preserves the raw source snapshot, validates source fields and quality rules, separates stable inventory from live observations, quarantines inconsistent records, and writes a run manifest with a SHA-256 evidence hash.

Generated pilot data is written under `data/cork/` and excluded from Git.

See [Cork Ingestion Runbook](docs/CORK_INGESTION_RUNBOOK.md) for operational details and known limitations.

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
                    PARKING INVENTORY LAYER
                              ↓
                    PARKING KNOWLEDGE GRAPH
                              ↓
                   DECISION / RECOMMENDATION
                              ↓
               Driver App + B2B Intelligence
```

## Repository structure

```text
WhiteBlock/
├── README.md
├── config/
│   ├── cork_pilot.yaml
│   └── cork_sources.yaml
├── data_contracts/
│   ├── parking_inventory.schema.json
│   └── parking_observation.schema.json
├── scripts/
│   └── ingest_cork_parking.py
├── tests/
│   └── test_ingest_cork_parking.py
└── docs/
    ├── CORK_INGESTION_RUNBOOK.md
    ├── CORK_MVP.md
    ├── DATA_EVIDENCE_MODEL.md
    ├── DATA_SOURCES.md
    ├── DECISIONS.md
    ├── PARKING_INVENTORY_LAYER.md
    ├── PRODUCT_PRINCIPLES.md
    ├── ROADMAP.md
    └── SYSTEM_ARCHITECTURE.md
```

## Documentation

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

**Stage:** Cork inventory-layer implementation.

The repository now contains both the contracts and the first executable Cork ingestion pipeline. The next engineering objective is **persistent spatial storage + multi-source entity reconciliation** before imagery candidates or forecasting are allowed to depend on the canonical layer.

## Working brand

**WHITEBLOCK** is the working master brand for this project. The project should complete appropriate trademark, company-name and domain clearance before public commercial launch.

---

WHITEBLOCK is being built around one operating principle:

> **Discover → Verify → Measure → Predict → Optimise → Expand only when necessary → Learn → Repeat.**
