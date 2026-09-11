# WHITEBLOCK Data Source Register

This register tracks candidate data sources, what they can support, and the validation/licensing questions that must be resolved before production use.

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

## 2. Cork / Ireland starter sources

### Cork local-authority parking data

Potential uses:

- known parking locations;
- car-park capacity/availability where published;
- parking zones;
- accessible parking;
- tariffs/rules where available.

Required checks:

- exact endpoint/data format;
- update cadence;
- licence/attribution;
- geographic coverage;
- field stability;
- historical availability.

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

## 3. Dynamic contextual data

Potential future categories:

### Traffic

Supports:

- arrival ETA;
- driving-time comparison;
- congestion-aware parking recommendations.

### Events

Supports:

- stadium/venue parking pressure;
- abnormal demand forecasting;
- temporary routing strategies.

### Weather

Supports:

- demand forecasting;
- walking-cost/preferences;
- model context.

Weather should be used as a feature only if it demonstrates predictive value.

## 4. Operator integrations

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

## 5. User/geolocation evidence

Potential uses:

- repeated parking-stop detection;
- validation of parking use;
- actual arrival outcomes;
- search-time estimation;
- recommendation feedback.

Production use requires privacy-by-design review including:

- consent;
- aggregation;
- minimisation;
- retention;
- re-identification risk;
- user controls;
- lawful basis.

## 6. Imagery restrictions

Do not use a map/imagery provider for computer vision, bulk extraction or dataset creation merely because images are visible in a consumer map.

Before use, document:

- whether machine analysis is allowed;
- whether images may be cached/stored;
- whether derived geodata can be retained;
- model-training rights;
- attribution;
- geographic/use limitations;
- commercial-use terms.

## 7. Source-quality metadata

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
- APPROVED
- DEGRADED
- RETIRED

## 8. Data-source acceptance checklist

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

## 9. Next data-research task

For the Cork MVP, convert this register from source categories into an executable inventory containing:

- exact dataset/API URL;
- licence;
- sample schema;
- refresh cadence;
- access method;
- expected parking attributes;
- known limitations;
- ingestion priority.
