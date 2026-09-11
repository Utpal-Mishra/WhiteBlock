# WHITEBLOCK Roadmap

This roadmap prioritises proving the intelligence layer before expensive integrations or physical infrastructure.

## Phase 0 — Foundation

**Goal:** establish the project contract.

Deliverables:

- product thesis;
- architecture;
- data/evidence model;
- Cork MVP scope;
- product principles;
- baseline repository structure;
- research/data-source register.

Exit condition:

> The team can explain what WHITEBLOCK is, what it is not, what the Cork pilot must prove, and how evidence/confidence are represented.

## Phase 1 — Cork Parking Inventory

**Goal:** create a trustworthy canonical parking dataset for the pilot area.

Work:

- define Cork pilot boundary;
- ingest official/open data;
- ingest OSM/GIS baseline;
- normalise geometry and identifiers;
- model capacity, rules, accessibility and EV attributes;
- attach source/freshness/confidence;
- create an internal map for QA.

Key output:

> `WB-PARK-*` canonical inventory with evidence.

Exit condition:

- known parking locations are represented consistently;
- duplicates and conflicts are traceable;
- data-quality gaps are quantified.

## Phase 2 — Destination-First Experience

**Goal:** prove that WHITEBLOCK can make a better parking decision than a static parking map.

Build:

- destination search;
- arrival time and stay duration;
- closest/cheapest/best-overall modes;
- accessibility and EV constraints;
- cost and walking estimates;
- rules compatibility;
- transparent ranking explanation;
- source freshness/confidence display.

Do not build native payments yet; use permitted links/integrations where useful.

Exit condition:

> A driver can ask where to park for a real trip and receive an evidence-backed ranked answer.

## Phase 3 — Availability & Demand Intelligence

**Goal:** move from static inventory to time-aware parking intelligence.

Build:

- observation ingestion;
- historical occupancy profiles;
- naive availability baseline;
- ML baseline where data supports it;
- ETA-based availability forecast;
- forecast confidence/calibration;
- event/weather/traffic feature experiments.

Evaluation:

- compare models to simple historical baselines;
- measure MAE/RMSE where ground-truth counts exist;
- evaluate probability calibration;
- monitor degradation/data drift.

Exit condition:

> Forecasting improves parking decisions measurably over static/current-only information.

## Phase 4 — Parking Supply Discovery

**Goal:** discover missing, changed and underused parking supply.

Build:

- licensed imagery ingestion workflow;
- surface-parking segmentation/detection;
- bay/capacity estimation experiment;
- change detection between imagery dates;
- cross-match against known inventory;
- candidate lifecycle;
- manual verification tooling;
- candidate precision/recall evaluation.

Important:

Imagery produces **candidates/evidence**, not automatic public parking.

Exit condition:

- high-precision surface-parking discovery is demonstrated in the Cork pilot;
- false-positive causes are documented;
- newly discovered supply can be verified and added through a repeatable process.

## Phase 5 — Network Optimisation

**Goal:** determine whether parking pressure can be solved by better use of current supply.

Build:

- spatial demand zones;
- Parking Supply Adequacy metric;
- underutilised-capacity detection;
- demand redistribution simulations;
- event/peak-period routing scenarios;
- shared/private capacity opportunities;
- optimisation recommendations with measurable impact.

Example decision:

> Redirecting demand to a nearby underused facility removes the need to investigate additional parking supply in this zone.

Exit condition:

> WHITEBLOCK can provide strategic recommendations at network level, not only individual-driver recommendations.

## Phase 6 — B2B Intelligence

**Goal:** package WHITEBLOCK's data and analytics for councils/operators/property owners.

Potential capabilities:

- occupancy and turnover dashboards;
- demand forecasts;
- peak-pressure mapping;
- lost/new supply change detection;
- utilisation imbalance;
- accessibility/EV capacity analysis;
- evidence-backed capacity opportunities;
- scenario modelling;
- downloadable/inspectable analysis reports.

Target users may include:

- local authorities;
- parking operators;
- hospitals;
- universities;
- airports;
- shopping centres;
- event venues;
- large employers/property owners.

## Phase 7 — New Supply Opportunity Assessment

**Goal:** investigate where additional parking supply is viable **only after optimisation has been tested**.

Candidate assessment should include:

- surface/geometry suitability;
- road access;
- proximity to unresolved demand;
- ownership status;
- land use/planning constraints;
- environmental/flood/drainage considerations;
- indicative capacity;
- likely utilisation;
- economic case.

Output:

> investigation candidate, not an automatic development recommendation.

## Phase 8 — Ireland Expansion

Suggested sequence:

1. Cork proof complete;
2. Dublin;
3. Galway/Limerick/Waterford;
4. national integration framework.

Each new city should reuse adapters, schemas and validation tests rather than creating one-off pipelines.

## Phase 9 — Commercial/Infrastructure Integrations

Only after the intelligence proposition is validated, consider:

- operator partnerships;
- reservation APIs;
- payment orchestration;
- parking-session evidence;
- selective sensor/camera integrations;
- dynamic signage;
- fleet/enterprise mobility integration.

## Ongoing workstreams

Across every phase:

- data quality;
- privacy/security;
- licensing/compliance;
- accessibility;
- evidence provenance;
- model monitoring;
- user research;
- cost/ROI measurement;
- documentation.

## Roadmap rule

A later phase may be prototyped early for research, but production scope should not skip the evidence/data foundations required to support it safely.
