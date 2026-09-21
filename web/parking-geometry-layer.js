// WHITEBLOCK ranked parking geometry layer.
// Makes the ranked results visible on the map. Mapped OSM parking geometry is
// preferred; a dashed display estimate is used only when mapped geometry is absent.

(() => {
  if (window.__WHITEBLOCK_PARKING_GEOMETRY_V2__) return;
  if (typeof L === "undefined" || typeof state === "undefined" || !state.map) return;
  window.__WHITEBLOCK_PARKING_GEOMETRY_V2__ = true;

  const map = state.map;
  const OVERPASS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter"
  ];
  const MAX_RESULTS = 10;
  const geometryCache = new Map();
  let rankedLayer = null;
  let legendControl = null;
  let renderGeneration = 0;
  let wrappedSelectParking = null;

  function escapeGeometryHtml(value) {
    if (typeof escapeHtml === "function") return escapeHtml(value);
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function ensurePanes() {
    if (!map.getPane("wbRankedParkingPolygonPane")) {
      const pane = map.createPane("wbRankedParkingPolygonPane");
      pane.style.zIndex = "510";
      pane.style.pointerEvents = "auto";
    }
    if (!map.getPane("wbRankedParkingLabelPane")) {
      const pane = map.createPane("wbRankedParkingLabelPane");
      pane.style.zIndex = "665";
      pane.style.pointerEvents = "auto";
    }
  }

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

  function colourFor(item) {
    if (item?.available == null || item?.capacity == null || Number(item.capacity) <= 0) return "#78E6AA";
    const ratio = Number(item.available) / Number(item.capacity);
    if (ratio >= 0.25) return "#52D98D";
    if (ratio >= 0.12) return "#C8F56B";
    return "#F1C46B";
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
    const query = `[out:json][timeout:14];(way(around:4500,${lat},${lng})["amenity"="parking"];way(around:4500,${lat},${lng})["parking"];);out tags center geom;`;
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
      const accessBonus = element?.tags?.access === "public" || element?.tags?.access === "yes" ? 0.015 : 0;
      const score = distance - overlap * 0.18 - accessBonus;
      return { element, centre, distance, overlap, score };
    }).filter(Boolean)
      .filter(candidate => !usedIds.has(candidate.element.id))
      .filter(candidate => candidate.distance <= 0.28 || (candidate.overlap >= 0.5 && candidate.distance <= 0.55))
      .sort((a, b) => a.score - b.score);

    const winner = candidates[0];
    if (!winner) return null;
    usedIds.add(winner.element.id);
    return winner.element.geometry
      .filter(point => Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lon)))
      .map(point => [Number(point.lat), Number(point.lon)]);
  }

  function estimateRadius(item) {
    const capacity = Number(item?.capacity);
    const capacityRadius = Number.isFinite(capacity) && capacity > 0
      ? Math.sqrt((capacity * 28) / Math.PI)
      : 45;
    const zoom = map.getZoom();
    const visibilityFloor = zoom <= 12 ? 170 : zoom <= 13 ? 125 : zoom <= 14 ? 85 : zoom <= 15 ? 58 : 38;
    return Math.max(visibilityFloor, Math.min(125, capacityRadius));
  }

  function estimatePolygon(item) {
    const lat = Number(item.lat);
    const lng = Number(item.lng);
    const radius = estimateRadius(item);
    const latScale = 111320;
    const lngScale = Math.max(25000, 111320 * Math.cos(lat * Math.PI / 180));
    const points = [];
    for (let index = 0; index < 20; index += 1) {
      const angle = Math.PI * 2 * index / 20;
      points.push([
        lat + Math.sin(angle) * radius / latScale,
        lng + Math.cos(angle) * radius / lngScale
      ]);
    }
    return points;
  }

  function rankIcon(index, selected, mapped, colour) {
    const number = String(index + 1).padStart(2, "0");
    return L.divIcon({
      className: "wb-ranked-parking-icon-wrapper",
      html: `<div class="wb-ranked-parking-icon ${selected ? "selected" : ""} ${mapped ? "mapped" : "estimated"}" style="--wb-rank-colour:${colour}"><strong>${number}</strong><small>${mapped ? "MAP" : "EST"}</small></div>`,
      iconSize: [44, 44],
      iconAnchor: [22, 22]
    });
  }

  function selectItem(item) {
    if (typeof selectParking === "function") selectParking(item.id);
  }

  function addResultGeometry(item, index, mappedCoords) {
    const selected = item.id === state.selectedId;
    const colour = colourFor(item);
    const coords = mappedCoords?.length >= 3 ? mappedCoords : estimatePolygon(item);
    const mapped = Boolean(mappedCoords?.length >= 3);

    const polygon = L.polygon(coords, {
      pane: "wbRankedParkingPolygonPane",
      color: selected ? "#FFFFFF" : colour,
      weight: selected ? 4 : mapped ? 2.8 : 2.1,
      opacity: 1,
      fillColor: colour,
      fillOpacity: selected ? 0.34 : mapped ? 0.22 : 0.13,
      dashArray: mapped ? null : "8 6",
      interactive: true
    }).addTo(rankedLayer);
    polygon.bindTooltip(
      `<strong>${String(index + 1).padStart(2, "0")} · ${escapeGeometryHtml(item.name || "Parking")}</strong><br>${mapped ? "Mapped parking area · OpenStreetMap" : "Estimated display area · geometry not verified"}`,
      { sticky: true, className: "wb-tooltip wb-parking-geometry-tooltip" }
    );
    polygon.on("click", () => selectItem(item));

    const marker = L.marker([Number(item.lat), Number(item.lng)], {
      pane: "wbRankedParkingLabelPane",
      icon: rankIcon(index, selected, mapped, colour),
      keyboard: true,
      riseOnHover: true
    }).addTo(rankedLayer);
    marker.bindTooltip(
      `<strong>${String(index + 1).padStart(2, "0")} · ${escapeGeometryHtml(item.name || "Parking")}</strong><br>${mapped ? "Mapped parking polygon" : "Estimated footprint"}`,
      { direction: "top", offset: [0, -24], className: "wb-tooltip" }
    );
    marker.on("click", () => selectItem(item));

    return polygon;
  }

  function ensureLegend() {
    if (legendControl) return;
    const GeometryLegend = L.Control.extend({
      options: { position: "bottomleft" },
      onAdd() {
        const node = L.DomUtil.create("div", "wb-parking-geometry-legend");
        node.innerHTML = `<span><i class="solid"></i>Mapped area</span><span><i class="dashed"></i>Estimated</span>`;
        L.DomEvent.disableClickPropagation(node);
        return node;
      }
    });
    legendControl = new GeometryLegend();
    legendControl.addTo(map);
  }

  function fitResultBounds(rows) {
    if (!rows.length || mapElLayoutActive()) return;
    const bounds = L.latLngBounds(rows.map(item => [Number(item.lat), Number(item.lng)]));
    const destination = state.destination;
    if (destination && Number.isFinite(Number(destination.lat)) && Number.isFinite(Number(destination.lng))) {
      bounds.extend([Number(destination.lat), Number(destination.lng)]);
    }
    if (!bounds.isValid()) return;
    try {
      map.fitBounds(bounds.pad(0.18), { paddingTopLeft: [28, 74], paddingBottomRight: [28, 46], maxZoom: 15, animate: false });
    } catch (_) {}
  }

  function mapElLayoutActive() {
    return document.getElementById("map")?.classList.contains("layout-active");
  }

  async function renderRankedGeometry({ fit = false } = {}) {
    ensurePanes();
    ensureLegend();
    const generation = ++renderGeneration;
    const rows = currentResults();
    if (rankedLayer) {
      try { if (map.hasLayer(rankedLayer)) map.removeLayer(rankedLayer); } catch (_) {}
    }
    rankedLayer = L.layerGroup().addTo(map);
    if (!rows.length) return;

    // Always draw immediately so parking is visible even if Overpass is slow.
    rows.forEach((item, index) => addResultGeometry(item, index, null));
    if (fit) fitResultBounds(rows);

    const elements = await fetchParkingGeometry();
    if (generation !== renderGeneration || !elements.length) return;

    try { if (map.hasLayer(rankedLayer)) map.removeLayer(rankedLayer); } catch (_) {}
    rankedLayer = L.layerGroup().addTo(map);
    const usedIds = new Set();
    rows.forEach((item, index) => {
      const geometry = matchGeometry(item, elements, usedIds);
      addResultGeometry(item, index, geometry);
    });
  }

  function focusSelected(id) {
    const rows = currentResults();
    const index = rows.findIndex(item => item.id === id);
    const item = index >= 0 ? rows[index] : null;
    if (!item) return;
    try { map.setView([Number(item.lat), Number(item.lng)], 17, { animate: false }); } catch (_) {}
    window.setTimeout(() => renderRankedGeometry({ fit: false }), 20);
  }

  function wrapSelection() {
    if (typeof selectParking !== "function") return false;
    if (selectParking.__wbRankedGeometryWrapped) return true;
    const base = selectParking;
    const wrapped = function whiteblockRankedGeometrySelect(id, ...args) {
      const result = base.call(this, id, ...args);
      window.setTimeout(() => focusSelected(id), 0);
      return result;
    };
    wrapped.__wbRankedGeometryWrapped = true;
    wrappedSelectParking = wrapped;
    selectParking = wrapped;
    return true;
  }

  function installSelectionWrapper() {
    let attempts = 0;
    const attempt = () => {
      attempts += 1;
      if (wrapSelection()) return;
      if (attempts < 40) window.setTimeout(attempt, 100);
    };
    attempt();
  }

  ensurePanes();
  installSelectionWrapper();

  document.addEventListener("whiteblock:data-ready", () => {
    window.setTimeout(() => {
      wrapSelection();
      renderRankedGeometry({ fit: true });
    }, 120);
  });
  document.addEventListener("whiteblock:kildare-attributes-ready", () => window.setTimeout(() => renderRankedGeometry({ fit: false }), 100));
  document.addEventListener("click", event => {
    if (event.target.closest?.("#search-button") || event.target.closest?.("#destination-suggestions") || event.target.closest?.(".chip")) {
      window.setTimeout(() => renderRankedGeometry({ fit: true }), 620);
    }
  });
  map.on("zoomend", () => window.setTimeout(() => renderRankedGeometry({ fit: false }), 40));

  window.setTimeout(() => renderRankedGeometry({ fit: true }), 450);
})();
