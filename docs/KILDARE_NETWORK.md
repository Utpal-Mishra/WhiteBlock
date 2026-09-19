# Kildare Parking Network

WHITEBLOCK expands from the Cork live-parking pilot into County Kildare as a second operational coverage area.

## Truth model

Kildare is **parking network inventory**, not live occupancy. WHITEBLOCK must not display fabricated free-space counts or pressure estimates for Kildare assets unless a future live source is connected.

Current sources:

1. **Kildare County Council Accessible Parking** — official ArcGIS feature layer, CC BY 4.0. This represents designated accessible parking locations and is not claimed to be exhaustive of all accessible parking in the county.
2. **OpenStreetMap parking inventory** — parking assets mapped in County Kildare, ODbL. Capacity, access, fee and opening-hour fields are used only when explicitly present in OSM tags.

The current Kildare County Council geographic coverage envelope used by WHITEBLOCK is taken from the published open-data metadata:

- south: 52.89292777262258
- west: -7.094685794312817
- north: 53.40546821613401
- east: -6.4849660938960625

This envelope is a coverage gate, not a substitute for an exact statutory county polygon.

## Network hubs

WHITEBLOCK groups Kildare parking inventory around the following town hubs for network analysis and navigation:

- Naas
- Newbridge
- Kildare Town
- Athy
- Maynooth
- Celbridge
- Leixlip
- Clane
- Kilcock
- Sallins
- Kilcullen

The lines shown between hubs in Ireland Coverage View are **logical WHITEBLOCK inventory-network links**, not road routes, public-transport routes, or claims about physical parking connectivity.

## Browser behavior

When a searched destination falls inside connected Kildare coverage:

1. WHITEBLOCK switches from the Cork inventory to the Kildare network snapshot.
2. Nearby parking assets are ranked by distance, evidence confidence and available static attributes.
3. Live availability remains blank unless a live Kildare source is introduced.
4. The Parking Layout mode uses actual asset coordinates relative to the destination.
5. The Network view exposes town-cluster counts.
6. Ireland Coverage View displays the Kildare coverage envelope and hub network.

## Build pipeline

```text
Kildare County Council Accessible Parking
                    +
OpenStreetMap / Overpass parking inventory
                    ↓
scripts/ingest_kildare_parking.py
                    ↓
web/data/kildare_parking_snapshot.json
                    ↓
web/region-network.js
                    ↓
Find + Parking Layout + Network + Coverage views
```

The GitHub Pages workflow rebuilds the browser snapshot and refuses to deploy an empty Kildare dataset. Production should later cache regional network inventories separately from high-frequency live occupancy feeds.

## Next data upgrades

Priority order:

1. Official Kildare public/off-street car-park inventory with stable identifiers.
2. Pay-parking zone geometry and tariff/rule parsing from council bye-laws.
3. Rail-station/Park & Ride capacity and occupancy where published.
4. EV charging and accessible-bay reconciliation.
5. Verified parking-area polygons and entrance/exit geometry.
6. Live occupancy feeds or operator integrations where available.
7. PostGIS ingestion of the Kildare snapshot so Cork and Kildare share one production spatial query layer.
