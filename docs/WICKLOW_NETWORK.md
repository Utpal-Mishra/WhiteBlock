# County Wicklow mapped parking network — 19 October 2026

## Expansion status and scope

WHITEBLOCK's Wicklow County overlay complements the existing independently curated **Bray seafront** pilot. An automated OpenStreetMap (OSM) exact-county inventory provides mapped parking locations in the rest of the county; the Bray pilot continues to cover its 5 km radius. Both contribute to **one County Wicklow** national overview, county-level Discover filter and Inventory Coverage filter. Bray appears as a **locality within Wicklow**, not a standalone fifth region. Source inventories remain separate internally to preserve the curated pilot's evidence and avoid duplicated mapped OSM records inside its circle.

**Important:** county-wide query coverage is **not** a claim that every physically existing or legally usable parking space is recorded. This is a mapped inventory layer. No live occupancy, actual vacant bay counts, unrestricted-public-access claims or official partner relationships are inferred.

## Core towns and high-demand corridors to audit

- Bray: existing seafront, station and adjacent pilot records, reconciled separately against OSM.
- Greystones, Kilcoole, Newtownmountkennedy, Enniskerry: commuter rail, retail and coastal areas.
- Wicklow Town, Rathnew, Ashford: town centres, Murrough, rail and local parking.
- Arklow, Avoca, Aughrim, Rathdrum: town and visitor corridors.
- Glendalough / Laragh, Roundwood, Brittas Bay: seasonal visitor parking and environmental access.
- Blessington, Baltinglass, Dunlavin, Carnew, Tinahely, Shillelagh: inland/rural coverage.

Town coordinates in the browser are **navigation hubs only**. They are not parking locations, measured parking supply or official town boundary polygons. OSM records are assigned to a locality using explicit OSM address tags where available, otherwise the nearest known hub (approximate).

## Data and source of truth

- The County Wicklow ingestion script queries OSM relation [282760](https://www.openstreetmap.org/relation/282760), County Wicklow, administrative level 6. Only matching parking nodes, ways and relations are included.
- The JSON browser snapshot is generated during GitHub Pages deployment. The job refuses an empty or malformed snapshot. An Overpass outage removes the optional county snapshot, and the browser reports source unavailable.
- The Wicklow browser adapter consumes and validates the snapshot, connects Find, mapped markers and regional inventories. The existing Bray adapter remains in charge of its local pilot.
- Ireland Overview, Discover and Inventory Coverage expose **four geographic county-level regions**: Cork, Kildare, Dublin and Wicklow. Bray is grouped beneath Wicklow as a drill-down locality, while its own source provenance and evidence remain intact.
- OSM credit and terms: OpenStreetMap contributors, [ODbL](https://www.openstreetmap.org/copyright). County by-law documents are source references only; there is no automated blanket assignment of their rates to every mapped parking record.

Known unknowns remain null: current available spaces, occupancy, untagged capacity, untagged access class, pricing, opening hours and maximum stay. Mapped public/private/customer/permit access is populated only from source fields.

## Official parking-rule references for future reconciliation

- [Wicklow County Council parking by-laws](https://www.wicklow.ie/Living/Services/Roads-Transport/Road-Policy/Parking-Bye-Laws): cover Bray, Greystones, Wicklow and Arklow; permits and zones are location-specific. On-site signage prevails.
- [Greystones Council pay parking](https://www.wicklow.ie/Living/Your-Council/Municipal-Districts/Greystones/Pay-Parking): paid-parking framework and free all-day Mill Road Park and Ride. Recheck current applicability before setting rates or stay limits.
- [Wicklow Town parking guide](https://wicklowtown.ie/find-us): Murrough and other car parks with differing day-stay and short-stay provisions.
- [Glendalough visitor parking](https://glendalough.ie/transport/parking-in-glendalough/): Upper Lake paid parking and Laragh visitor parking; seasonal terms and on-site signs require rechecking.
- [Historic Bray council car-park list](https://bray.ie/wicklow-county-council-will-reopen-a-number-of-car-parks/): a historical discovery reference, not current operating verification.

## QA and acceptance

1. Query is clipped by exact OSM relation 282760, never a rectangular bounding box.
2. Exclude OSM records within 5 km of Bray's pilot centre to avoid double-counting its separately maintained inventory.
3. Render unknown availability as unknown; do not infer it from capacities or aerial imagery.
4. Validate schema, non-live fields, relation ID, non-exhaustive claim and Bray exclusion before deployment.
5. Check destinations in Wicklow Town, Greystones, Arklow, Blessington and Glendalough and verify markers and locality drill-down.
6. Review restricted, private, customer and permit parking before use in driver recommendations.
7. Queue potential missing spots from licensed imagery as candidates until physical supply and legal use are checked.
8. Maintain partnership/on-site verification as a later separate workstream, not a prerequisite to recording existing mapped locations.

## Next improvements

- County Wicklow summary totals must aggregate the independently ingested county snapshot and the curated Bray evidence inventory once each. **Do not treat Bray as a fifth county or a separate region filter.**
- Inspect successful deployments for actual counts, polygons and access classifications. **No unsupported asset count is claimed.**
- Add official Wicklow car-park coordinates, Park & Ride, accessible bays and verified entrances as additional evidence.
- Normalize place-specific tariffs, maximum-stay, payment instructions and source timestamps.
- Extend permitted imagery review to missing rural, coastal and retail parking candidates.
- Add occupancy/availability feeds only when genuinely published or contractually available.
