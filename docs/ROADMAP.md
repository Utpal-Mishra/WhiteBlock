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

## Phase 1.5 — Parking Universe Coverage

**Implementation status (2026-10-27):** ACTIVE. Foundation slice now includes the machine-readable source-family registry, deploy-time coverage audit, Discover coverage dashboard, canonical Parking Universe state model, shared evidence-review queue and regression guardrails. Next work is source ingestion/reconciliation, retail/transport candidate discovery, and access/rules gap resolution.

**Goal:** make the canonical WHITEBLOCK registry as complete as practicable before commercial partnerships become a dependency.

This phase is broader than verified public parking. The registry should preserve every known or plausible parking asset/candidate, while keeping its legal/use status explicit.

Coverage classes should include, where evidence exists:

- public off-street car parks;
- on-street parking zones/bays;
- accessible parking;
- EV parking;
- Park & Ride;
- station/transport parking;
- hospital/university/airport/event parking;
- shopping-centre and grocery/retail customer parking;
- private/shared parking that may become partner-accessible;
- permit/restricted parking;
- temporary/event parking;
- imagery/GIS-detected parking candidates whose public access is not yet verified;
- closed/removed/former parking retained as lifecycle history rather than silently deleted.

Core rule:

> A parking asset can exist in the WHITEBLOCK registry without being currently recommendable to a driver.

Required state separation:

- physical existence;
- public/private/restricted/unknown access;
- rules and maximum stay;
- capacity/geometry confidence;
- current recommendation eligibility;
- partnership/commercial status;
- live availability source.

Coverage-completion work:

- enumerate every authoritative/open/map/imagery source available for the target geography;
- reconcile and deduplicate all discovered assets into canonical `WB-PARK-*` records;
- scan geographic gaps rather than only known car-park names;
- maintain unresolved candidates instead of dropping them;
- measure source/geographic coverage and unresolved-access gaps;
- establish automated change detection/revalidation for additions, removals and rule changes.

Suggested completion metrics:

- source-universe coverage;
- geographic coverage;
- candidate resolution rate;
- verified-access rate;
- stale-record rate;
- unresolved-access rate;
- percentage of known physical parking represented by canonical records.

Exit condition:

> No material known parking source or geographic coverage gap remains unprocessed for the target region, and unresolved assets are explicitly represented as candidates/restricted/unknown rather than omitted.

Important:

This is a **coverage-complete objective, not a claim of literal 100% real-world completeness**. Parking supply, rules and physical layouts change over time.

## Phase 2 — Destination-First Experience

**Implementation status (2026-10-27):** ✅ COMPLETE — re-audited and evidence-ranking hardened. Unknown availability, confidence or non-comparable pricing no longer receive hidden placeholder score credit.

**Goal:** prove that WHITEBLOCK can make a better parking decision than a static parking map.

Integrated:

- destination search across connected Ireland coverage;
- arrival time and stay duration controls;
- closest / lowest-cost / best-overall modes;
- accessibility and EV constraints;
- destination-distance and walking-time estimates;
- session-cost estimates only where a simple published tariff can be calculated safely;
- explicit non-calculable state for tiered/ambiguous/unpublished tariffs;
- access, maximum-stay and opening-window compatibility before recommendation;
- transparent per-result ranking explanation;
- source, truth-state, freshness and evidence-confidence display;
- excluded/ineligible nearby parking retained for transparency rather than silently hidden.

Cost guardrail:

> WHITEBLOCK calculates a session total only from an unambiguous published free/hourly tariff. Complex or unclear tariffs remain visible as published evidence but are not converted into a fabricated total.

Do not build native payments yet; use permitted links/integrations where useful.

Phase boundary:

- turn-by-turn navigation, parking-session timers/reminders, walking-route execution and operator payment/session hand-off are **trip-execution capabilities**, not blockers for Phase 2 completion.

Exit condition:

> ✅ Met — a driver can ask where to park for a real trip and receive an evidence-backed ranked answer whose stay fit, walk estimate, safely calculable cost, ranking rationale, source, freshness and confidence are visible.

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

## Partnership-readiness gate

Commercial/operator partnerships should enrich an already-existing parking registry rather than determine which parking assets exist in WHITEBLOCK.

Partnership integrations should mainly add or improve:

- verified operator/owner relationship;
- reservability/bookability;
- payment/deep-link capability;
- partner-only access rules;
- trusted capacity/occupancy feeds;
- session-management capability;
- commercial terms/benefits.

The canonical parking asset should remain stable before and after a partnership. A partnership changes **how the asset can be used**, not whether WHITEBLOCK knows that the asset physically exists.

After the coverage-completion gate, partnerships can become the principal **product-expansion** workstream. Inventory maintenance must still continue automatically for new/removed parking, rule changes, temporary closures and source freshness.

## Roadmap rule

A later phase may be prototyped early for research, but production scope should not skip the evidence/data foundations required to support it safely.
