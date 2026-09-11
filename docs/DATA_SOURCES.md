# WHITEBLOCK Data Source Register

This register tracks data sources, what they support, and the validation/licensing questions that must be resolved before production use.

Machine-readable Cork source configuration is stored in `config/cork_sources.yaml`.

## 1. Source classes

WHITEBLOCK should prefer sources in this order where practical:

1. official/local-authority data;
2. parking-operator APIs/feeds;
3. government geospatial/open-data sources;
4. appropriately licensed commercial data;
5. community/open geospatial data;
6. consented aggregated user evidence;
7. model inference.

No single source class is sufficient for every parking attribute.

## 2. Cork source — approved for baseline implementation

### Cork City Council Real Time Parking Spaces

**Status:** `APPROVED_FOR_PILOT`

- Publisher: Cork City Council
- Resource ID: `f4677dac-bb30-412e-95a8-d3c22134e3c0`
- Access URL: `https://data.corkcity.ie/datastore/dump/f4677dac-bb30-412e-95a8-d3c22134e3c0`
- Licence: Creative Commons Attribution
- Role: authoritative parking inventory baseline + live observation source

Current expected schema:

```text
identifier
name
spaces
free_spaces
opening_times
height_restrictions
price
notes
latitude
longitude
date
```

WHITEBLOCK treatment:

- `spaces` → stable capacity attribute;
- `free_spaces` → time-series observation;
- `date` → source/observation timestamp;
- location fields → canonical spatial point after validation;
- textual rules/pricing → preserve raw value before structured parsing.

Do not infer source freshness from ingestion time alone. Compare the source-provided timestamp with retrieval time.

### Cork City Centre Parking Map

**Status:** `REFERENCE`

Official map page:

`https://www.corkcity.ie/en/council-services/services/parking-services/i-need-a-city-centre-car-park/cork-city-centre-parking-map/`

Officially represented categories include real-time available spaces, city-centre car parks, set-down areas, disabled parking, disc parking retailers and the Black Ash route.

Use the map as an official reference and source-discovery aid. Do not scrape proprietary/base map tiles or assume every displayed layer has machine-readable reuse rights.

## 3. Secondary Cork / Ireland starter sources

### National / Irish open data portals

Potential uses:

- parking datasets from multiple authorities;
- road/transport datasets;
- planning/land-use references;
- future city expansion.

Required checks:

- source authority;
- licence per dataset;
- freshness;
- whether APIs are stable enough for production ingestion.

### Tailte Éireann aerial / orthophoto data

Potential uses:

- parking-area discovery;
- geometry extraction;
- capacity estimation research;
- change detection;
- spatial validation.

Important:

- confirm the exact imagery product and licence before ML/computer-vision processing;
- record capture date and spatial resolution with each derived evidence item;
- do not treat imagery as live occupancy.

### OpenStreetMap

**Pilot role:** secondary inventory + geometry + entity matching.

Potential uses:

- parking polygons;
- entrances;
- road network;
- walking network;
- parking attributes where mapped;
- cross-checking newly discovered candidates.

Required checks:

- ODbL attribution/derivative-database obligations;
- completeness by area;
- contributor freshness;
- avoid treating missing OSM data as evidence that parking does not exist.

Official/verified council or operator evidence should not be silently overwritten by an OSM conflict.

## 4. Dynamic contextual data

Potential future categories:

### Traffic

Supports arrival ETA, driving-time comparison and congestion-aware recommendations.

### Events

Supports venue parking pressure, abnormal demand forecasting and temporary routing strategies.

### Weather

Supports demand forecasting and walking-cost/preferences. Weather should be retained only if it demonstrates predictive value.

## 5. Operator integrations

Future operator feeds may provide:

- capacity;
- live occupancy;
- prices;
- opening hours;
- reservation status;
- payment handoff;
- EV/accessibility attributes.

For each operator maintain:

```text
operator_name
integration_type
API/feed documentation
commercial agreement required?
allowed caching
rate limits
coverage
refresh interval
SLA/status
attribution requirement
```

## 6. User/geolocation evidence

Potential uses:

- repeated parking-stop detection;
- validation of parking use;
- actual arrival outcomes;
- search-time estimation;
- recommendation feedback.

Production use requires privacy-by-design review including consent, aggregation, minimisation, retention, re-identification risk, user controls and lawful basis.

## 7. Imagery restrictions

Do not use a map/imagery provider for computer vision, bulk extraction or dataset creation merely because images are visible in a consumer map.

Before use, document:

- whether machine analysis is allowed;
- whether images may be cached/stored;
- whether derived geodata can be retained;
- model-training rights;
- attribution;
- geographic/use limitations;
- commercial-use terms.

## 8. Source-quality metadata

Every integrated source should have a registry entry containing:

```text
source_id
source_name
source_owner
source_type
licence
coverage
update_frequency
last_successful_ingestion
expected_schema_version
quality_notes
production_status
```

Suggested `production_status` values:

- RESEARCH_ONLY
- VALIDATING
- APPROVED_FOR_PILOT
- APPROVED
- DEGRADED
- RETIRED

## 9. Data-source acceptance checklist

Before marking a source `APPROVED`:

- [ ] provenance is clear;
- [ ] licence permits intended use;
- [ ] attribution requirements are documented;
- [ ] schema is understood;
- [ ] coverage is measured;
- [ ] freshness is measured;
- [ ] failure behaviour is understood;
- [ ] privacy implications are reviewed;
- [ ] conflicts with other sources are handled;
- [ ] evidence records can reference the source.

## 10. Next source integrations

After the Cork authoritative feed is running reliably:

1. reconcile OpenStreetMap parking geometry;
2. identify structured accessible-parking sources;
3. identify EV bay/charger sources without conflating chargers with public parking access;
4. structure tariffs/rules;
5. add licensed imagery only for supply discovery/change detection;
6. add traffic/events/weather only when the core inventory is reliable.
