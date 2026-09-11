# WHITEBLOCK

**Spatial Intelligence for Better Parking**

WHITEBLOCK is an Ireland-first parking and spatial-intelligence infrastructure project designed to help people, cities and operators **discover, understand, predict and optimise parking supply**.

The project starts with a Cork proof of concept and is intentionally broader than a parking-payment app. WHITEBLOCK aims to become an intelligence layer connecting public parking, private parking, accessible bays, EV spaces, underused capacity, parking rules, live occupancy, demand forecasting and potential new supply.

## Product thesis

Most parking tools answer only part of the journey: where a car park is, how to pay, or how to reserve a space. WHITEBLOCK is being designed around a harder question:

> **Where should I park for this trip, will space likely be available when I arrive, am I allowed to park there, and is existing parking supply being used efficiently?**

WHITEBLOCK therefore separates two core problems:

1. **Parking Supply Discovery** — identify known, unknown, underused, changed or potentially convertible parking supply.
2. **Parking Network Optimisation** — predict demand and availability, rank options and improve utilisation of existing supply before recommending new physical capacity.

These loops run in parallel.

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

## Key design principle

**Physical parking detection is not the same as legal/public parking availability.**

A location detected from imagery is first stored as a candidate. It must be validated for access, ownership, planning constraints and parking rules before it can be presented as verified public parking.

Likewise, aerial imagery is treated as a supply-discovery and change-detection source, **not as live occupancy infrastructure**.

## Initial geography

### Phase 1 — Cork
Use Cork as the first controlled test market because it offers a manageable geography and useful public parking data sources.

The first pilot should prove that WHITEBLOCK can:

- consolidate known parking inventory;
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
                    PARKING KNOWLEDGE GRAPH
                              ↓
                   DECISION / RECOMMENDATION
                              ↓
               Driver App + B2B Intelligence
```

## Documentation

- [System Architecture](docs/SYSTEM_ARCHITECTURE.md)
- [Cork MVP](docs/CORK_MVP.md)
- [Data & Evidence Model](docs/DATA_EVIDENCE_MODEL.md)
- [Product Principles](docs/PRODUCT_PRINCIPLES.md)
- [Roadmap](docs/ROADMAP.md)
- [Decision Log](docs/DECISIONS.md)

## Current status

**Stage:** concept definition / architecture foundation.

The immediate objective is to build a data-first Cork MVP before introducing payment infrastructure, proprietary sensors or nationwide coverage.

## Working brand

**WHITEBLOCK** is the working master brand for this project. The project should complete appropriate trademark, company-name and domain clearance before public commercial launch.

---

WHITEBLOCK is being built around one operating principle:

> **Discover → Verify → Measure → Predict → Optimise → Expand only when necessary → Learn → Repeat.**
