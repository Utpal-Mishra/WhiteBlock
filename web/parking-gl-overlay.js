// WHITEBLOCK MapLibre-native ranked parking overlay.
// Parking polygons and ranked points render inside the same MapLibre canvas as
// the basemap so Android browsers cannot hide them behind WebGL/Leaflet panes.

(() => {
  if (window.__WHITEBLOCK_PARKING_GL_OVERLAY__) return;
  if (typeof L === "undefined" || typeof state === "undefined" || !state.map) return;
  window.__WHITEBLOCK_PARKING_GL_OVERLAY__ = true;

  const leafMap = state.map;
  const SOURCE_ID = "whiteblock-ranked-parking";
  const POLYGON_FILL = "whiteblock-ranked-parking-fill";
  const POLYGON_LINE_MAPPED = "whiteblock-ranked-parking-line-mapped";
  const POLYGON_LINE_ESTIMATED = "whiteblock-ranked-parking-line-estimated";
  const POINT_CLUSTER_RING = "whiteblock-ranked-parking-cluster-ring";
  const POINT_CIRCLE = "whiteblock-ranked-parking-point";
  const POINT_LABEL = "whiteblock-ranked-parking-label";
  const POINT_CLUSTER_CAPTION = "whiteblock-ranked-parking-cluster-caption";
  const POINT_AVAILABILITY = "whiteblock-ranked-parking-availability";
  const MAX_RESULTS = 10;
  const POLICY = window.WHITEBLOCK_MARKER_POLICY;
  const INDIVIDUAL_MARKER_ZOOM = POLICY.detailZoom;
  const FOOTPRINT_MIN_ZOOM = POLICY.minimumFootprintZoom;
  const EMPTY_FEATURES = () => ({ type: "FeatureCollection", features: [] });
  const OVERPASS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter"
  ];

  let glMap = null;
  let renderGeneration = 0;
  const geometryCache = new Map();
  let latestFeatureCollection = { type: "FeatureCollection", features: [] };
  let selectionWrapped = false;
  let glSourceAnnounced = false;

  function currentResults() {
    // County and Ireland browsing show county/locality aggregates, never the
    // previously ranked Cork destination markers or their footprint polygons.
    if (!state.destination || POLICY.browseActive(state)) return [];
    let rows = [];
    try {
      if (typeof currentData === "function") rows = currentData() || [];
    } catch (_) {}
    if (!Array.isArray(rows) || !rows.length) rows = Array.isArray(parkingData) ? parkingData : [];
    return rows
      .filter(item => Number.isFinite(Number(item?.lat)) && Number.isFinite(Number(item?.lng)))
      .slice(0, MAX_RESULTS);
  }

  function statusColour(item) {
    if (item?.available == null || item?.capacity == null || Number(item.capacity) <= 0) return "#78E6AA";
    const ratio = Number(item.available) / Number(item.capacity);
    if (ratio >= 0.25) return "#52D98D";
    if (ratio >= 0.12) return "#C8F56B";
    return "#F1C46B";
  }

  function availabilityLabel(item) {
    const available = Number(item?.available);
    return Number.isFinite(available) && available >= 0
      ? `${Math.round(available)} FREE`
      : "LIVE —";
  }

  function estimateRadius(item) {
    const capacity = Number(item?.capacity);
    const capacityRadius = Number.isFinite(capacity) && capacity > 0
      ? Math.sqrt((capacity * 28) / Math.PI)
      : 45;
    const zoom = leafMap.getZoom();
    const visibilityFloor = zoom <= 12 ? 190 : zoom <= 13 ? 145 : zoom <= 14 ? 100 : zoom <= 15 ? 70 : 45;
    return Math.max(visibilityFloor, Math.min(145, capacityRadius));
  }

  function estimatedRing(item) {
    const lat = Number(item.lat);
    const lng = Number(item.lng);
    const radius = estimateRadius(item);
    const latScale = 111320;
    const lngScale = Math.max(25000, 111320 * Math.cos(lat * Math.PI / 180));
    const coords = [];
    for (let index = 0; index < 24; index += 1) {
      const angle = Math.PI * 2 * index / 24;
      coords.push([
        lng + Math.cos(angle) * radius / lngScale,
        lat + Math.sin(angle) * radius / latScale
      ]);
    }
    coords.push(coords[0]);
    return coords;
  }

  function distanceKm(aLat, aLng, bLat, bLng) {
    if (typeof haversineKm === "function") return haversineKm(aLat, aLng, bLat, bLng);
    const R = 6371;
    const toRad = value => value * Math.PI / 180;
    const dLat = toRad(bLat - aLat);
    const dLng = toRad(bLng - aLng);
    const lat1 = toRad(aLat);
    const lat2 = toRad(bLat);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function tokens(value) {
    return new Set(String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter(token => token.length > 2 && !["car", "park", "parking", "the", "and", "street", "road"].includes(token)));
  }

  function nameOverlap(a, b) {
    const aa = tokens(a);
    const bb = tokens(b);
    if (!aa.size || !bb.size) return 0;
    let common = 0;
    aa.forEach(token => { if (bb.has(token)) common += 1; });
    return common / Math.max(aa.size, bb.size);
  }

  function elementCentre(element) {
    if (element?.center?.lat != null && element?.center?.lon != null) {
      return { lat: Number(element.center.lat), lng: Number(element.center.lon) };
    }
    const geometry = Array.isArray(element?.geometry) ? element.geometry : [];
    const valid = geometry.filter(point => Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lon)));
    if (!valid.length) return null;
    return {
      lat: valid.reduce((sum, point) => sum + Number(point.lat), 0) / valid.length,
      lng: valid.reduce((sum, point) => sum + Number(point.lon), 0) / valid.length
    };
  }

  function destinationKey() {
    const destination = state.destination;
    if (!destination || !Number.isFinite(Number(destination.lat)) || !Number.isFinite(Number(destination.lng))) return null;
    return `${Number(destination.lat).toFixed(3)},${Number(destination.lng).toFixed(3)}`;
  }

  async function fetchParkingGeometry() {
    const key = destinationKey();
    if (!key) return [];
    if (geometryCache.has(key)) return geometryCache.get(key);

    const destination = state.destination;
    const lat = Number(destination.lat);
    const lng = Number(destination.lng);
    const query = `[out:json][timeout:12];(way(around:4500,${lat},${lng})["amenity"="parking"];way(around:4500,${lat},${lng})["parking"];);out tags center geom;`;
    const body = new URLSearchParams({ data: query }).toString();
    let elements = [];

    for (const endpoint of OVERPASS) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8", Accept: "application/json" },
          body
        });
        if (!response.ok) continue;
        const payload = await response.json();
        if (Array.isArray(payload?.elements)) {
          elements = payload.elements.filter(element => Array.isArray(element.geometry) && element.geometry.length >= 3);
          break;
        }
      } catch (_) {}
    }

    geometryCache.set(key, elements);
    return elements;
  }

  function matchGeometry(item, elements, usedIds) {
    const lat = Number(item.lat);
    const lng = Number(item.lng);
    const candidates = elements.map(element => {
      const centre = elementCentre(element);
      if (!centre) return null;
      const distance = distanceKm(lat, lng, centre.lat, centre.lng);
      const overlap = nameOverlap(item.name, element?.tags?.name || element?.tags?.operator || "");
      return { element, distance, overlap, score: distance - overlap * 0.2 };
    }).filter(Boolean)
      .filter(candidate => !usedIds.has(candidate.element.id))
      .filter(candidate => candidate.distance <= 0.30 || (candidate.overlap >= 0.5 && candidate.distance <= 0.60))
      .sort((a, b) => a.score - b.score);

    const winner = candidates[0];
    if (!winner) return null;
    usedIds.add(winner.element.id);
    const coords = winner.element.geometry
      .filter(point => Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lon)))
      .map(point => [Number(point.lon), Number(point.lat)]);
    if (coords.length < 3) return null;
    if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) coords.push(coords[0]);
    return coords;
  }

  function rankedGroupsAtZoom(rows) {
    return POLICY.groupNearby(rows, leafMap.getZoom(),
      item => leafMap.project(L.latLng(Number(item.lat), Number(item.lng)), leafMap.getZoom()),
      { radiusPx: POLICY.rankedRadiusPx, detailZoom: INDIVIDUAL_MARKER_ZOOM });
  }

  function featureCollection(rows, mapped = new Map()) {
    const features = [];
    const zoom = leafMap.getZoom();
    const groups = rankedGroupsAtZoom(rows);

    groups.forEach(members => {
      if (members.length > 1) {
        const membersRows = members.map(index => rows[index]);
        const lat = membersRows.reduce((sum, item) => sum + Number(item.lat), 0) / membersRows.length;
        const lng = membersRows.reduce((sum, item) => sum + Number(item.lng), 0) / membersRows.length;
        features.push({
          type: "Feature",
          properties: {
            kind: "cluster",
            count: members.length,
            rank: String(members.length),
            display_rank: String(members.length),
            caption: "OPTIONS",
            availability_label: "",
            colour: "#0B1712",
            stroke_colour: "#C8F56B",
            label_colour: "#EDF7F1"
          },
          geometry: { type: "Point", coordinates: [lng, lat] }
        });
        return;
      }

      const index = members[0];
      const item = rows[index];
      const coords = mapped.get(item.id) || estimatedRing(item);
      const isMapped = mapped.has(item.id);
      const rank = String(index + 1).padStart(2, "0");
      const displayRank = `#${index + 1}`;
      const selected = item.id === state.selectedId;
      const colour = statusColour(item);
      const freeLabel = availabilityLabel(item);
      if (zoom >= FOOTPRINT_MIN_ZOOM) {
        features.push({
          type: "Feature",
          properties: {
            kind: "polygon",
            parking_id: item.id,
            rank,
            display_rank: displayRank,
            name: item.name || "Parking",
            selected: selected ? 1 : 0,
            mapped: isMapped ? 1 : 0,
            colour
          },
          geometry: { type: "Polygon", coordinates: [coords] }
        });
      }
      features.push({
        type: "Feature",
        properties: {
          kind: "point",
          parking_id: item.id,
          rank,
          display_rank: displayRank,
          caption: "",
          availability_label: freeLabel,
          name: item.name || "Parking",
          selected: selected ? 1 : 0,
          mapped: isMapped ? 1 : 0,
          colour,
          stroke_colour: selected ? "#FFFFFF" : "#07110D",
          label_colour: "#07110D"
        },
        geometry: { type: "Point", coordinates: [Number(item.lng), Number(item.lat)] }
      });
    });
    return { type: "FeatureCollection", features };
  }

  function findGlMap() {
    let found = null;
    leafMap.eachLayer(layer => {
      if (found) return;
      try {
        if (typeof layer?.getMaplibreMap === "function") found = layer.getMaplibreMap();
        else if (layer?._glMap) found = layer._glMap;
      } catch (_) {}
    });
    return found;
  }

  function layerExists(id) {
    try { return Boolean(glMap?.getLayer?.(id)); } catch (_) { return false; }
  }

  function ensureGlLayers() {
    if (!glMap || !glMap.isStyleLoaded?.()) return false;
    try {
      if (!glMap.getSource(SOURCE_ID)) {
        glMap.addSource(SOURCE_ID, { type: "geojson", data: latestFeatureCollection });
      }
      if (!layerExists(POLYGON_FILL)) {
        glMap.addLayer({
          id: POLYGON_FILL,
          type: "fill",
          source: SOURCE_ID,
          filter: ["==", ["get", "kind"], "polygon"],
          paint: {
            "fill-color": ["get", "colour"],
            "fill-opacity": ["case", ["==", ["get", "selected"], 1], 0.46, ["==", ["get", "mapped"], 1], 0.30, 0.20]
          }
        });
      }
      if (!layerExists(POLYGON_LINE_MAPPED)) {
        glMap.addLayer({
          id: POLYGON_LINE_MAPPED,
          type: "line",
          source: SOURCE_ID,
          filter: ["all", ["==", ["get", "kind"], "polygon"], ["==", ["get", "mapped"], 1]],
          paint: {
            "line-color": ["case", ["==", ["get", "selected"], 1], "#FFFFFF", ["get", "colour"]],
            "line-width": ["case", ["==", ["get", "selected"], 1], 5, 3.5],
            "line-opacity": 1
          }
        });
      }
      if (!layerExists(POLYGON_LINE_ESTIMATED)) {
        glMap.addLayer({
          id: POLYGON_LINE_ESTIMATED,
          type: "line",
          source: SOURCE_ID,
          filter: ["all", ["==", ["get", "kind"], "polygon"], ["==", ["get", "mapped"], 0]],
          paint: {
            "line-color": ["case", ["==", ["get", "selected"], 1], "#FFFFFF", ["get", "colour"]],
            "line-width": ["case", ["==", ["get", "selected"], 1], 5, 3],
            "line-opacity": 1,
            "line-dasharray": [3, 2]
          }
        });
      }
      if (!layerExists(POINT_CLUSTER_RING)) {
        glMap.addLayer({
          id: POINT_CLUSTER_RING,
          type: "circle",
          source: SOURCE_ID,
          filter: ["==", ["get", "kind"], "cluster"],
          paint: {
            "circle-radius": 28,
            "circle-color": "rgba(11,23,18,0)",
            "circle-stroke-color": "rgba(200,245,107,0.34)",
            "circle-stroke-width": 3,
            "circle-opacity": 1
          }
        });
      }
      if (!layerExists(POINT_CIRCLE)) {
        glMap.addLayer({
          id: POINT_CIRCLE,
          type: "circle",
          source: SOURCE_ID,
          filter: ["any", ["==", ["get", "kind"], "point"], ["==", ["get", "kind"], "cluster"]],
          paint: {
            "circle-radius": ["case", ["==", ["get", "kind"], "cluster"], 24, ["==", ["get", "selected"], 1], 18, 16],
            "circle-color": ["get", "colour"],
            "circle-stroke-color": ["get", "stroke_colour"],
            "circle-stroke-width": ["case", ["==", ["get", "kind"], "cluster"], 2.5, ["==", ["get", "selected"], 1], 4, 3],
            "circle-opacity": 1
          }
        });
      }
      if (!layerExists(POINT_LABEL)) {
        glMap.addLayer({
          id: POINT_LABEL,
          type: "symbol",
          source: SOURCE_ID,
          filter: ["any", ["==", ["get", "kind"], "point"], ["==", ["get", "kind"], "cluster"]],
          layout: {
            "text-field": ["get", "display_rank"],
            "text-size": ["case", ["==", ["get", "kind"], "cluster"], 15, 12],
            "text-offset": ["case", ["==", ["get", "kind"], "cluster"], ["literal", [0, -0.24]], ["literal", [0, 0]]],
            "text-allow-overlap": true,
            "text-ignore-placement": true
          },
          paint: {
            "text-color": ["get", "label_colour"],
            "text-halo-color": ["case", ["==", ["get", "kind"], "cluster"], "rgba(7,17,13,0.9)", "rgba(255,255,255,0.42)"],
            "text-halo-width": ["case", ["==", ["get", "kind"], "cluster"], 1, 0.6]
          }
        });
      }
      if (!layerExists(POINT_CLUSTER_CAPTION)) {
        glMap.addLayer({
          id: POINT_CLUSTER_CAPTION,
          type: "symbol",
          source: SOURCE_ID,
          filter: ["==", ["get", "kind"], "cluster"],
          layout: {
            "text-field": ["get", "caption"],
            "text-size": 7.5,
            "text-letter-spacing": 0.08,
            "text-offset": [0, 1.18],
            "text-allow-overlap": true,
            "text-ignore-placement": true
          },
          paint: {
            "text-color": "#C8F56B",
            "text-halo-color": "rgba(7,17,13,0.92)",
            "text-halo-width": 0.8
          }
        });
      }
      if (!layerExists(POINT_AVAILABILITY)) {
        glMap.addLayer({
          id: POINT_AVAILABILITY,
          type: "symbol",
          source: SOURCE_ID,
          minzoom: Math.max(0, INDIVIDUAL_MARKER_ZOOM - 1),
          filter: ["==", ["get", "kind"], "point"],
          layout: {
            "text-field": ["get", "availability_label"],
            "text-size": 9,
            "text-letter-spacing": 0.04,
            "text-offset": [0, 2.65],
            "text-allow-overlap": true,
            "text-ignore-placement": true
          },
          paint: {
            "text-color": "#EDF7F1",
            "text-halo-color": "rgba(7,17,13,0.94)",
            "text-halo-width": 2
          }
        });
      }
      glMap.getSource(SOURCE_ID)?.setData?.(latestFeatureCollection);
      return true;
    } catch (error) {
      console.warn("WHITEBLOCK parking GL overlay could not attach", error);
      return false;
    }
  }

  function updateSource(data) {
    latestFeatureCollection = data;
    if (!ensureGlLayers()) return;
    try { glMap.getSource(SOURCE_ID)?.setData?.(data); } catch (_) {}
  }

  async function renderOverlay({ fit = false } = {}) {
    const generation = ++renderGeneration;
    const rows = currentResults();
    if (!rows.length) {
      updateSource(EMPTY_FEATURES());
      return;
    }

    updateSource(featureCollection(rows));

    if (fit) {
      try {
        const bounds = L.latLngBounds(rows.map(item => [Number(item.lat), Number(item.lng)]));
        if (state.destination && Number.isFinite(Number(state.destination.lat)) && Number.isFinite(Number(state.destination.lng))) {
          bounds.extend([Number(state.destination.lat), Number(state.destination.lng)]);
        }
        if (bounds.isValid()) leafMap.fitBounds(bounds.pad(0.14), { padding: [36, 54], maxZoom: 15, animate: false });
      } catch (_) {}
    }

    const elements = await fetchParkingGeometry();
    if (generation !== renderGeneration || !elements.length) return;
    const used = new Set();
    const mapped = new Map();
    rows.forEach(item => {
      const geometry = matchGeometry(item, elements, used);
      if (geometry) mapped.set(item.id, geometry);
    });
    updateSource(featureCollection(rows, mapped));
  }

  function focusSelected(id) {
    const item = currentResults().find(row => row.id === id);
    if (!item) return;
    try { leafMap.setView([Number(item.lat), Number(item.lng)], 17, { animate: false }); } catch (_) {}
    window.setTimeout(() => renderOverlay({ fit: false }), 30);
  }

  function wrapSelection() {
    if (selectionWrapped || typeof selectParking !== "function") return;
    const base = selectParking;
    selectParking = function whiteblockGlOverlaySelect(id, ...args) {
      const result = base.call(this, id, ...args);
      window.setTimeout(() => focusSelected(id), 0);
      return result;
    };
    selectParking.__wbParkingGlOverlayWrapped = true;
    selectionWrapped = true;
  }

  function connect(attempt = 0) {
    glMap = findGlMap();
    if (!glMap) {
      if (attempt < 120) return window.setTimeout(() => connect(attempt + 1), 50);
      console.warn("WHITEBLOCK parking GL overlay: MapLibre instance not found");
      return;
    }

    const onStyleReady = () => {
      const ready = ensureGlLayers();
      updateSource(latestFeatureCollection);
      if (ready && !glSourceAnnounced) {
        glSourceAnnounced = true;
        // Leaflet's duplicate ranked circles are a fallback only. As soon as
        // native ranked MapLibre overlay is available, remove the fallback.
        document.dispatchEvent?.(new CustomEvent("whiteblock:ranked-gl-overlay-ready"));
      }
    };
    glMap.on?.("style.load", onStyleReady);
    glMap.on?.("idle", onStyleReady);
    glMap.on?.("click", POINT_CIRCLE, event => {
      const feature = event?.features?.[0];
      if (feature?.properties?.kind !== "cluster" || !state.destination || POLICY.browseActive(state)) return;
      const coords = feature.geometry?.coordinates;
      if (!Array.isArray(coords) || coords.length < 2) return;
      // The cluster number is a quantity ("N OPTIONS"), never an ordinal rank.
      // Zoom reveals individual "#1", "#2" recommendation markers.
      leafMap.flyTo([Number(coords[1]), Number(coords[0])], Math.min(INDIVIDUAL_MARKER_ZOOM, leafMap.getZoom() + 2), { animate: true });
    });
    window.setTimeout(onStyleReady, 100);
    wrapSelection();
    renderOverlay({ fit: true });
  }

  document.addEventListener("whiteblock:data-ready", () => window.setTimeout(() => {
    wrapSelection();
    renderOverlay({ fit: true });
  }, 120));
  document.addEventListener("whiteblock:kildare-attributes-ready", () => window.setTimeout(() => renderOverlay({ fit: false }), 100));
  document.addEventListener("whiteblock:coverage-browse", () => {
    // Remove all ranked circles, number labels and inferred footprints at once.
    ++renderGeneration; // Cancel an in-flight geometry fetch from a prior destination.
    updateSource(EMPTY_FEATURES());
  });
  document.addEventListener("click", event => {
    if (event.target.closest?.("#search-button") || event.target.closest?.("#destination-suggestions") || event.target.closest?.(".chip")) {
      window.setTimeout(() => renderOverlay({ fit: true }), 650);
    }
  });
  leafMap.on("zoomend", () => window.setTimeout(() => renderOverlay({ fit: false }), 40));

  connect();
})();
