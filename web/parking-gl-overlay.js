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
  const POINT_CIRCLE = "whiteblock-ranked-parking-point";
  const POINT_LABEL = "whiteblock-ranked-parking-label";
  const MAX_RESULTS = 10;
  const OVERPASS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter"
  ];

  let glMap = null;
  let renderGeneration = 0;
  const geometryCache = new Map();
  let latestFeatureCollection = { type: "FeatureCollection", features: [] };
  let selectionWrapped = false;

  function currentResults() {
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

  function featureCollection(rows, mapped = new Map()) {
    const features = [];
    rows.forEach((item, index) => {
      const coords = mapped.get(item.id) || estimatedRing(item);
      const isMapped = mapped.has(item.id);
      const rank = String(index + 1).padStart(2, "0");
      const selected = item.id === state.selectedId;
      const colour = statusColour(item);
      features.push({
        type: "Feature",
        properties: {
          kind: "polygon",
          parking_id: item.id,
          rank,
          name: item.name || "Parking",
          selected: selected ? 1 : 0,
          mapped: isMapped ? 1 : 0,
          colour
        },
        geometry: { type: "Polygon", coordinates: [coords] }
      });
      features.push({
        type: "Feature",
        properties: {
          kind: "point",
          parking_id: item.id,
          rank,
          name: item.name || "Parking",
          selected: selected ? 1 : 0,
          mapped: isMapped ? 1 : 0,
          colour
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
      if (!layerExists(POINT_CIRCLE)) {
        glMap.addLayer({
          id: POINT_CIRCLE,
          type: "circle",
          source: SOURCE_ID,
          filter: ["==", ["get", "kind"], "point"],
          paint: {
            "circle-radius": ["case", ["==", ["get", "selected"], 1], 18, 15],
            "circle-color": ["get", "colour"],
            "circle-stroke-color": ["case", ["==", ["get", "selected"], 1], "#FFFFFF", "#07110D"],
            "circle-stroke-width": ["case", ["==", ["get", "selected"], 1], 4, 3],
            "circle-opacity": 1
          }
        });
      }
      if (!layerExists(POINT_LABEL)) {
        glMap.addLayer({
          id: POINT_LABEL,
          type: "symbol",
          source: SOURCE_ID,
          filter: ["==", ["get", "kind"], "point"],
          layout: {
            "text-field": ["get", "rank"],
            "text-size": 13,
            "text-allow-overlap": true,
            "text-ignore-placement": true
          },
          paint: {
            "text-color": "#07110D",
            "text-halo-color": "rgba(255,255,255,0.45)",
            "text-halo-width": 0.6
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
      updateSource({ type: "FeatureCollection", features: [] });
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
      ensureGlLayers();
      updateSource(latestFeatureCollection);
    };
    glMap.on?.("style.load", onStyleReady);
    glMap.on?.("idle", onStyleReady);
    window.setTimeout(onStyleReady, 100);
    wrapSelection();
    renderOverlay({ fit: true });
  }

  document.addEventListener("whiteblock:data-ready", () => window.setTimeout(() => {
    wrapSelection();
    renderOverlay({ fit: true });
  }, 120));
  document.addEventListener("whiteblock:kildare-attributes-ready", () => window.setTimeout(() => renderOverlay({ fit: false }), 100));
  document.addEventListener("click", event => {
    if (event.target.closest?.("#search-button") || event.target.closest?.("#destination-suggestions") || event.target.closest?.(".chip")) {
      window.setTimeout(() => renderOverlay({ fit: true }), 650);
    }
  });
  leafMap.on("zoomend", () => window.setTimeout(() => renderOverlay({ fit: false }), 40));

  connect();
})();
