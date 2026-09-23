# Dublin Venue Parking Knowledge Layer

## Purpose

WHITEBLOCK now treats selected real-world venues as **conditional parking opportunities** rather than assuming that every nearby car park is public or that a venue's opening hours are parking permission.

Initial venue classes:

- fuel stations
- motorway/service areas and rest areas
- supermarkets
- shopping centres
- department stores
- named retail areas / retail parks

The layer is built across the same exact four Dublin local-authority relations used by the parking inventory:

- Dublin City — OSM relation `1109531`
- Fingal — OSM relation `1114164`
- Dún Laoghaire–Rathdown — OSM relation `1115720`
- South Dublin — OSM relation `1117469`

Coverage claim remains:

`complete_boundary_traversal_not_complete_real_world_inventory`

## Core rule

**Venue open =/=> parking permitted.**

A fuel station may be open 24/7 while its forecourt/customer spaces are unsuitable for leaving a vehicle unattended. A shopping centre may have extensive parking but impose customer-only access, opening-hour controls, enforcement conditions or a maximum stay.

Therefore WHITEBLOCK keeps these facts separate:

1. venue opening hours
2. physical parking existence
3. venue/parking association confidence
4. parking access type
5. customer-only status
6. maximum stay
7. parking opening hours
8. price/tariff
9. live availability

Live availability remains `null` unless an actual occupancy/free-space source publishes it.

## Discovery model

`scripts/build_dublin_venue_knowledge.py` queries the exact Dublin authority boundaries for the target venue classes and relates those venue anchors to the enriched Dublin parking snapshot.

A nearby parking feature can have one of several knowledge states:

- **name/operator match** — stronger source-supported spatial association
- **proximity only** — candidate association; does not prove ownership or permission
- **public parking nearby** — potentially useful to a visitor but not necessarily venue-owned
- **conditional customer parking** — usable only within customer/stay restrictions
- **access unknown** — not promoted to public parking
- **private/permit/restricted** — not general-user parking

Fuel/service venues default to `short_customer_stop_only` until explicit evidence supports longer stays.

## Search behaviour

Named venues from this layer are added as Dublin destination/search anchors. Searching a known venue can therefore surface the mapped parking supply around it through the destination parking focus layer.

The knowledge layer does **not** create a new parking marker solely because a fuel station, supermarket or shopping centre exists.

## Imagery review queue

Where mapped parking is absent or the venue association/access is weak, the venue is added to an imagery-review queue.

Imagery can be used to identify or validate a **physical parking footprint**, especially open-air parking, but the resulting record remains a candidate until access and stay rules are separately verified.

Required progression:

`venue -> mapped/source parking check -> imagery candidate if needed -> access/stay verification -> parking inventory -> availability feed (if available)`

WHITEBLOCK must never use:

`imagery -> public parking recommendation`

without the evidence steps in between.

## Imagery source strategy

For Ireland, Tailte Éireann / GeoHive is the preferred authoritative reference layer where licensing and access permit the intended analysis. Tailte Éireann publishes high-resolution aerial imagery products, including 15 cm Greater Dublin coverage from several capture years and broader national imagery products.

Copernicus Sentinel-2 can support frequent coarse change detection, but its 10 m spatial resolution is not treated as sufficient evidence for individual parking bays or reliable vehicle counting.

If WHITEBLOCK later requires both high spatial resolution and frequent refresh, a licensed commercial imagery source should be evaluated. Even then, imagery should support **candidate discovery/change detection**, not live occupancy claims.

## Dublin regulatory knowledge

The venue layer sits above the existing Dublin settlement and restriction evidence layers. Council parking controls continue to take precedence:

- Dublin City parking operating times and restrictions are location/sign specific.
- Fingal pay-and-display operating hours can vary by area and signage.
- Dún Laoghaire–Rathdown maximum parking periods and hours are indicated locally.
- South Dublin operates paid parking across named locations and retains local parking controls.

These rules reinforce why venue opening hours cannot be substituted for parking permission.

## Output

Generated sidecar:

`web/data/dublin_venue_knowledge.json`

Browser integration:

`web/dublin-venue-knowledge.js`

The JSON includes:

- venue inventory
- venue category
- local-authority provenance
- raw venue opening hours
- 24/7 venue flag
- linked mapped parking evidence
- access/max-stay/opening-hour evidence carried from parking records
- suggestion state
- imagery review priority
- imagery candidate queue
- explicit precision rules

## Next evidence improvements

1. Add operator/venue-owned parking pages where available.
2. Extract store-specific maximum-stay and enforcement rules.
3. Prioritise imagery review for high-demand venues with no mapped parking geometry.
4. Add point-in-polygon venue/parking association where source geometries support it.
5. Add live occupancy only from VMS, sensors, operator feeds or other source-published observations.
