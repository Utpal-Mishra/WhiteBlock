# WHITEBLOCK Data & Evidence Model

## 1. Goal

WHITEBLOCK should not store parking information as a flat list of coordinates and labels.

Every important parking fact should be traceable to:

- **what** is believed;
- **where** it applies;
- **when** it was observed;
- **who/what** supplied it;
- **how confident** the system is;
- **whether it has been verified**;
- **which model/rule version** derived it.

This is essential because parking information can come from official records, imagery, operator APIs, models, user reports and geolocation evidence with very different reliability.

## 2. Core entities

### PARKING_LOCATION

Represents a physical parking asset or verified parking area.

Suggested fields:

```text
parking_id
name
geometry
latitude
longitude
parking_type
operator
public_access_class
capacity_verified
capacity_estimated
accessible_spaces
ev_spaces
entrance_geometry
surface_type
status
created_at
updated_at
```

Example `parking_type` values:

- surface;
- on_street;
- multi_storey;
- underground;
- park_and_ride;
- private_shared;
- temporary.

### PARKING_RULE

Represents restrictions and permission relevant to a parking location or zone.

```text
rule_id
parking_id / zone_id
rule_type
valid_from
valid_to
days_of_week
start_time
end_time
max_stay
permit_requirement
payment_requirement
vehicle_restriction
source_evidence_id
confidence
```

### PARKING_OBSERVATION

Represents time-varying measurements.

```text
observation_id
parking_id
timestamp
occupied_spaces
available_spaces
occupancy_ratio
source_type
source_id
confidence
```

Possible sources:

- official API;
- barrier count;
- sensor;
- operator system;
- camera-derived observation;
- aggregated GPS evidence;
- user report;
- model prediction.

Predictions should remain explicitly distinguishable from observations.

### PARKING_EVIDENCE

Represents why WHITEBLOCK believes a fact.

```text
evidence_id
parking_id / candidate_id
source_type
source_reference
source_timestamp
ingested_at
geometry
attribute_supported
observed_value
confidence
verification_status
model_name
model_version
notes
```

Possible source types:

- government_dataset;
- council_api;
- operator_api;
- licensed_aerial_imagery;
- osm;
- gps_cluster;
- user_confirmation;
- manual_ground_check;
- street_observation;
- model_inference.

### PARKING_CANDIDATE

Represents a detected area that may be parking but is not yet safe to publish as verified parking.

```text
candidate_id
geometry
detected_type
estimated_capacity
physical_confidence
public_access_confidence
capacity_confidence
road_access_confidence
status
first_detected_at
last_checked_at
```

Candidate lifecycle:

```text
DETECTED
  ↓
UNVERIFIED
  ↓
PHYSICAL_USE_CONFIRMED
  ↓
ACCESS_CLASSIFIED
  ↓
RULES_VERIFIED
  ↓
VERIFIED / REJECTED / RESTRICTED
```

### SPATIAL_OPPORTUNITY

Represents land or existing capacity that may warrant investigation as future parking supply.

This is **not** consumer-facing parking inventory.

```text
opportunity_id
geometry
current_land_class
surface_suitability
road_access_score
nearby_demand_score
planning_status
ownership_status
environmental_risk
estimated_capacity_range
opportunity_score
status
```

A spatial opportunity must not be treated as approved parking merely because imagery shows usable land.

### DEMAND_FORECAST

```text
forecast_id
area_id / parking_id
forecast_timestamp
for_timestamp
predicted_demand
predicted_available_spaces
lower_bound
upper_bound
model_name
model_version
features_version
```

## 3. Confidence model

Avoid binary truth where evidence is uncertain.

Instead of:

```text
is_parking = true
```

prefer fields such as:

```text
physical_confidence = 0.97
public_access_confidence = 0.61
pricing_confidence = 0.30
capacity_confidence = 0.88
restriction_confidence = 0.54
```

Confidence should describe evidence quality, not hide uncertainty.

## 4. Source precedence

Not all evidence should have equal authority.

A starting precedence framework:

1. current official/operator source for the specific attribute;
2. verified ground observation;
3. multiple corroborating trusted sources;
4. licensed imagery/GIS inference;
5. aggregated behavioural evidence;
6. individual user report;
7. model-only inference.

This order is not absolute. Attribute-specific logic is required. For example, imagery may be strong evidence for geometry but weak evidence for legal access.

## 5. Attribute-level provenance

Do not assign one generic confidence score to an entire car park.

A location may have:

- geometry: high confidence;
- capacity: medium confidence;
- tariff: high confidence;
- EV count: low confidence;
- public access: high confidence.

Each material attribute should be traceable separately.

## 6. Freshness

Every time-sensitive fact should include:

- `source_timestamp`;
- `ingested_at`;
- `valid_from` / `valid_to` where applicable;
- a freshness state such as `CURRENT`, `AGING`, `STALE`, `UNKNOWN`.

A correct tariff from two years ago may be less useful than a lower-confidence tariff verified yesterday.

## 7. Evidence aggregation

Example:

```text
Candidate: WB-CORK-00427

Aerial imagery:
- surface-parking geometry detected
- estimated 36 bays

OSM:
- parking polygon present
- capacity missing

Aggregated parking events:
- repeated parking-like dwell patterns

Manual verification:
- public access confirmed
- observed 34 marked bays

Result:
- capacity = 34
- capacity confidence = high
- public access = verified
```

The final value should preserve the evidence chain rather than overwrite it.

## 8. Naming convention

Use stable machine identifiers independent of display names.

Examples:

```text
WB-PARK-CORK-000123
WB-CAND-CORK-000427
WB-OPP-CORK-000031
WB-EVD-0000009842
```

Display names may change; identifiers should not.

## 9. Privacy requirements

Location-based evidence can be sensitive.

Principles:

- collect only what is necessary;
- prefer aggregation over individual trajectory storage;
- obtain meaningful consent where required;
- avoid storing identifiable raw movement histories unless essential and lawful;
- define retention periods;
- separate operational identifiers from user identity;
- make contribution/telemetry controls understandable;
- perform a formal privacy/legal review before production GPS collection.

## 10. Auditability

Every derived recommendation should be reproducible enough to answer:

> Why did WHITEBLOCK recommend this location at this time?

A recommendation record should retain references to:

- candidate parking options;
- rules version;
- observed/predicted availability;
- cost estimate;
- decision-score components;
- model version;
- user constraints/preferences;
- timestamp.

This creates an evidence-backed platform rather than an opaque ranking engine.
