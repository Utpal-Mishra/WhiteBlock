# Cork MVP

## Objective

Prove that WHITEBLOCK can create a trustworthy, useful parking-intelligence layer for a limited Cork pilot area **without** first installing proprietary sensors or building a payment system.

The MVP should validate the data model, discovery workflow, recommendation logic and evidence framework before geographic expansion.

## Phase 1 foundation — Parking Inventory Layer

Before recommendation or forecasting work, WHITEBLOCK must establish a canonical parking inventory and observation history.

Implementation artefacts:

- `docs/PARKING_INVENTORY_LAYER.md` — layer behaviour and quality rules;
- `config/cork_sources.yaml` — executable source registry;
- `config/cork_pilot.yaml` — provisional Cork pilot geography and quality gates;
- `data_contracts/parking_inventory.schema.json` — stable asset contract;
- `data_contracts/parking_observation.schema.json` — live/historical observation contract.

The first authoritative source is Cork City Council's real-time parking feed. Stable fields such as location and capacity populate the inventory, while `free_spaces` and its source timestamp populate the observation layer.

A changing live count must never overwrite the canonical parking asset itself.

## Pilot scope

Start with a controlled Cork City area of roughly **2–4 km²** containing a useful mix of:

- council/off-street parking;
- on-street parking zones;
- accessible parking;
- EV parking where available;
- private/commercial parking;
- high-demand destinations;
- areas where public datasets are incomplete.

The current provisional engineering boundary is defined in `config/cork_pilot.yaml`. It should be refined based on data availability and parking complexity rather than size alone.

## MVP user question

The first consumer workflow should answer:

> **I am going to this destination at this time for this long. Where should I park?**

Inputs:

- destination;
- estimated arrival time;
- expected stay duration;
- optional EV requirement;
- optional accessibility requirement;
- preference: closest / cheapest / best overall.

Outputs:

- ranked parking options;
- expected availability or confidence band when data supports it;
- cost estimate;
- walking time/distance;
- restrictions relevant to the planned stay;
- explanation of why each recommendation is ranked;
- data confidence/freshness.

## Data layers

Initial sources should prioritise lawful/open or appropriately licensed data, including where available:

- Cork City Council parking/open data;
- public car-park capacity/availability feeds;
- parking rules/tariffs;
- OpenStreetMap/geospatial baselines;
- appropriately licensed Irish aerial/orthophoto imagery;
- road and pedestrian-network data;
- event/weather/traffic data where useful.

Do not build the MVP around scraped proprietary map imagery.

## MVP workstreams

### 0. Inventory ingestion and reconciliation

Build the canonical `WB-PARK-*` dataset first.

```text
Cork authoritative feed
        +
secondary geospatial sources
        ↓
raw snapshots
        ↓
schema validation
        ↓
normalisation
        ↓
entity matching
        ↓
canonical parking assets
        +
live observations
        ↓
quality + evidence report
```

Required checks include valid coordinates, source timestamps, duplicate detection, capacity consistency and complete provenance.

### 1. Known parking inventory

Build a canonical inventory of parking assets in the pilot area.

Minimum fields:

- geometry;
- parking type;
- capacity where known;
- operator;
- public/private/restricted classification;
- price/rules;
- accessibility/EV attributes;
- source;
- freshness;
- confidence.

### 2. Discovery pilot

Test the Parking Supply Discovery Engine against the same area.

Process:

```text
Known inventory
      +
Licensed aerial/GIS data
      ↓
Candidate detection
      ↓
Cross-check existing datasets
      ↓
Unmatched candidates
      ↓
Manual/ground validation
      ↓
Verified additions or rejected candidates
```

The discovery model should optimise **precision before recall**. Falsely labelling private or prohibited land as public parking is more harmful than missing a candidate.

### 3. Recommendation engine

Create destination-first ranking using initially transparent rules.

Evaluate:

- likely availability;
- cost;
- driving time;
- walking time;
- planned stay compatibility;
- accessibility/EV requirements;
- data confidence.

### 4. Availability forecasting

Only introduce ML forecasting where sufficient historical observations exist.

Start with interpretable baselines before complex models:

- same weekday/time historical average;
- rolling occupancy profiles;
- simple regression/tree-based baseline;
- event/weather features later.

Always compare ML against a naive baseline.

### 5. Supply optimisation

Identify parking locations where demand is poorly distributed.

Example:

```text
Car Park A: 96% utilisation
Car Park B: 43% utilisation, 500 m away
```

Test whether recommendation/routing changes can reduce pressure before proposing additional capacity.

## Success metrics

### Inventory

**Parking Inventory Coverage**

```text
verified parking locations captured
-----------------------------------
actual verified locations in pilot
```

Operational quality gates for the initial layer are defined in `config/cork_pilot.yaml`, including provenance completeness, coordinate validity and duplicate-rate controls.

### Discovery

- candidate precision;
- candidate recall where ground truth is available;
- false-public-parking rate;
- capacity-estimation error;
- percentage of candidates resolved through evidence.

A target such as **>90% precision for surface-parking discovery** is a useful research ambition, not a guaranteed launch threshold.

### Recommendation

- recommendation acceptance/use;
- arrival success rate;
- estimated vs actual search time;
- user-reported recommendation usefulness;
- frequency of restriction/rule errors.

### Forecasting

- MAE/RMSE for available-space prediction where counts exist;
- calibration of probability/confidence bands;
- improvement over naive baseline.

### Network

Track **Parking Supply Adequacy (PSA)** conceptually as:

```text
effective usable parking supply
-------------------------------
predicted parking demand
```

Values below 1 indicate potential pressure; the metric must be interpreted by time and location rather than as a single city-wide number.

## Explicitly out of scope for first MVP

- proprietary payment processing;
- nationwide coverage;
- installing a sensor network;
- ANPR/enforcement infrastructure;
- claiming satellite/aerial imagery provides live vacancy;
- autonomous legal interpretation of parking signs;
- automatic conversion of vacant land into public parking;
- high-frequency commercial imagery purchases without demonstrated ROI.

## MVP deliverables

1. Cork pilot parking dataset with canonical `WB-PARK-*` IDs.
2. Parking Knowledge Graph/spatial schema.
3. Historical observation table for authoritative availability data.
4. Source/evidence ledger and quality report.
5. Interactive pilot map.
6. Destination-first recommendation prototype.
7. Supply-discovery experiment with validation results.
8. Initial availability baseline where data allows.
9. Evidence/confidence UI.
10. Evaluation report documenting errors and limitations.

## Go/no-go criteria for expansion

Do not move to Dublin simply because the Cork interface works.

Expand when Cork demonstrates:

- reliable core inventory;
- acceptable discovery precision;
- recommendation usefulness;
- a repeatable ingestion/verification process;
- a clear path to maintain data freshness;
- evidence that users/operators gain value beyond existing parking/payment apps.
