// WHITEBLOCK map engine v2.
// One MapLibre/Leaflet rendering path for Street, Terrain and Satellite.
// Leaflet owns parking/destination overlays; MapLibre stays below them in tilePane.
// Selected parking is given a visible area footprint. If OSM exposes a nearby
// parking polygon, the selected estimate is upgraded to mapped geometry.

(() => {
  if (window.__WHITEBLOCK_MAP_ENGINE_V2__) return;
  if (typeof L === "undefined" || typeof state === "undefined" || !state.map) return;
  if (typeof L.maplibreGL !== "function") return;

  window.__WHITEBLOCK_MAP_ENGINE_V2__ = true;
  // Prevent the retired raster-retry adapter from taking ownership if it is loaded later.
  window.__WHITEBLOCK_TILE_RESILIENCE__ = true;

  const map = state.map;
  const mapEl = document.getElementById("map");
  if (!mapEl) return;

  const STREET_STYLE = "https://tiles.openfreemap.org/styles/liberty";
  const TERRAIN_TILE = "https://a.tile.opentopomap.org/{z}/{x}/{y}.png";
  const SATELLITE_TILE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
  const OVERPASS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter"
  ];

  const LAYER_LABELS = { street: "Street", terrain: "Terrain", satellite: "Satellite" };
  let basemap = null;
  let basemapKey = "street";
  let basemapGeneration = 0;
  let parkingAreaLayer = null;
  let selectedFootprintLayer = null;
  let destinationLayer = null;
  let coverageLayer = null;
  let footprintRequest = 0;
  const footprintCache = new Map();

  function loadStyle() {
    if (document.querySelector('link[data-whiteblock-map-engine-v2]')) return;
    const style = document.createElement("link");
    style.rel = "stylesheet";
    style.href = "./map-engine-v2.css?v=20260921-2";
    style.dataset.whiteblockMapEngineV2 = "true";
    document.head.appendChild(style);
  }

  function rasterStyle(id, tileUrl, attribution, maxzoom = 19) {
    return {
      version: 8,
      sources: {
        [id]: {
          type: "raster",
          tiles: [tileUrl],
          tileSize: 256,
          minzoom: 0,
          maxzoom,
          attribution
        }
      },
      layers: [{ id: `${id}-base`, type: "raster", source: id, minzoom: 0, maxzoom: 22 }]
    };
  }

  function styleFor(key) {
    if (key === "terrain") {
      return rasterStyle(
        "whiteblock-terrain",
        TERRAIN_TILE,
        "© OpenStreetMap contributors · SRTM · OpenTopoMap",
        17
      );
    }
    if (key === "satellite") {
      return rasterStyle(
        "whiteblock-satellite",
        SATELLITE_TILE,
        "Tiles © Esri, Maxar, Earthstar Geographics and GIS User Community",
        19
      );
    }
    return STREET_STYLE;
  }

  function isLegacyBasemap(layer) {
    if (!layer) return false;
    if (layer.__whiteblockMapEngineV2) return false;
    if (layer instanceof L.TileLayer) return true;
    return typeof layer.getMaplibreMap === "function" || Boolean(layer._glMap);
  }

  function removeLegacyBasemaps() {
    map.eachLayer(layer => {
      if (!isLegacyBasemap(layer)) return;
      try { map.removeLayer(layer); } catch (_) {}
    });
  }

  function maplibreMap(layer) {
    try {
      if (typeof layer?.getMaplibreMap === "function") return layer.getMaplibreMap();
      return layer?._glMap || null;
    } catch (_) {
      return null;
    }
  }

  function updateToolbar(key) {
    document.querySelectorAll(".wb-map-layer-button[data-layer]").forEach(button => {
      const active = button.dataset.layer === key;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function setBasemapStatus(key, suffix = "") {
    mapEl.dataset.basemapEngine = "maplibre-v2";
    mapEl.dataset.basemap = key;
    mapEl.classList.remove("wb-map-street", "wb-map-terrain", "wb-map-satellite");
    mapEl.classList.add(`wb-map-${key}`);
    if (suffix && typeof setMapStatus === "function") {
      setMapStatus(`${LAYER_LABELS[key]} map`, suffix);
    }
  }

  function resizeBasemap() {
    const gl = maplibreMap(basemap);
    if (gl?.resize) {
      try { gl.resize(); } catch (_) {}
    }
  }

  function activateBasemap(key, { quiet = false } = {}) {
    if (!LAYER_LABELS[key]) key = "street";
    const generation = ++basemapGeneration;
    basemapKey = key;
    updateToolbar(key);
    mapEl.classList.add("wb-map-repairing");

    if (basemap) {
      try { if (map.hasLayer(basemap)) map.removeLayer(basemap); } catch (_) {}
      basemap = null;
    }
    removeLegacyBasemaps();

    try {
      basemap = L.maplibreGL({
        style: styleFor(key),
        pane: "tilePane",
        interactive: false,
        attributionControl: false
      });
      basemap.__whiteblockMapEngineV2 = true;
      basemap.addTo(map);
    } catch (error) {
      console.warn(`WHITEBLOCK ${key} basemap could not start`, error);
      mapEl.classList.remove("wb-map-repairing");
      if (key !== "street") activateBasemap("street", { quiet: true });
      return;
    }

    const connectHealth = () => {
      if (generation !== basemapGeneration || !basemap) return;
      const gl = maplibreMap(basemap);
      if (!gl) {
        window.setTimeout(connectHealth, 50);
        return;
      }

      let errors = 0;
      const recovered = () => {
        if (generation !== basemapGeneration) return;
        errors = 0;
        mapEl.classList.remove("wb-map-repairing");
      };

      gl.on?.("load", recovered);
      gl.on?.("idle", recovered);
      gl.on?.("error", () => {
        if (generation !== basemapGeneration) return;
        errors += 1;
        // A single raster/vector tile failure is recoverable. Repeated failures
        // indicate a provider/device incompatibility; fall back to Street rather
        // than leaving a checkerboard/black map visible.
        if (errors >= 8 && key !== "street") {
          if (typeof setMapStatus === "function") {
            setMapStatus(`${LAYER_LABELS[key]} temporarily unavailable`, "Showing the stable Street map instead");
          }
          activateBasemap("street", { quiet: true });
        }
      });
      window.setTimeout(recovered, 1200);
    };
    connectHealth();

    setBasemapStatus(key, quiet ? "" : "Parking overlays remain active on every layer");
    window.requestAnimationFrame(() => {
      map.invalidateSize({ pan: false, animate: false });
      resizeBasemap();
      renderParkingAreas();
    });
  }

  function statusColour(item) {
    if (item?.available == null || item?.capacity == null || Number(item.capacity) <= 0) return "#78E6AA";
    const ratio = Number(item.available) / Number(item.capacity);
    if (ratio >= 0.25) return "#52D98D";
    if (ratio >= 0.12) return "#C8F56B";
    return "#F1C46B";
  }

  function resultItems() {
    try {
      if (typeof currentData === "function") {
        const rows = currentData();
        if (Array.isArray(rows)) return rows.filter(item => Number.isFinite(item?.lat) && Number.isFinite(item?.lng));
      }
    } catch (_) {}
    return Array.isArray(parkingData)
      ? parkingData.filter(item => Number.isFinite(item?.lat) && Number.isFinite(item?.lng)).slice(0, 12)
      : [];
  }

  function footprintRadius(item) {
    const capacity = Number(item?.capacity);
    if (!Number.isFinite(capacity) || capacity <= 0) return 38;
    // 28 m²/space is used only to size a visual estimate including circulation.
    // It is not stored as verified geometry and is deliberately capped.
    return Math.max(28, Math.min(105, Math.sqrt((capacity * 28) / Math.PI)));
  }

  function approximatePolygon(lat, lng, radiusMeters, points = 18) {
    const coords = [];
    const latScale = 111320;
    const lngScale = Math.max(25000, 111320 * Math.cos(lat * Math.PI / 180));
    for (let i = 0; i < points; i += 1) {
      const angle = (Math.PI * 2 * i) / points;
      coords.push([
        lat + (Math.sin(angle) * radiusMeters) / latScale,
        lng + (Math.cos(angle) * radiusMeters) / lngScale
      ]);
    }
    return coords;
  }

  function ensurePanes() {
    if (!map.getPane("wbParkingAreaPane")) {
      const pane = map.createPane("wbParkingAreaPane");
      pane.style.zIndex = "430";
      pane.style.pointerEvents = "auto";
    }
    if (!map.getPane("wbSelectedAreaPane")) {
      const pane = map.createPane("wbSelectedAreaPane");
      pane.style.zIndex = "470";
      pane.style.pointerEvents = "auto";
    }
    if (!map.getPane("wbParkingPointPane")) {
      const pane = map.createPane("wbParkingPointPane");
      pane.style.zIndex = "640";
      pane.style.pointerEvents = "auto";
    }
  }

  function clearLayer(layer) {
    if (!layer) return;
    try { if (map.hasLayer(layer)) map.removeLayer(layer); } catch (_) {}
  }

  function renderParkingAreas() {
    ensurePanes();
    clearLayer(parkingAreaLayer);
    parkingAreaLayer = L.layerGroup().addTo(map);
    const rows = resultItems();

    rows.forEach((item, index) => {
      const selected = item.id === state.selectedId;
      const colour = statusColour(item);
      const polygon = L.polygon(
        approximatePolygon(Number(item.lat), Number(item.lng), footprintRadius(item)),
        {
          pane: "wbParkingAreaPane",
          color: colour,
          weight: selected ? 2.5 : 1.4,
          opacity: selected ? 1 : 0.76,
          fillColor: colour,
          fillOpacity: selected ? 0.22 : 0.10,
          dashArray: selected ? null : "5 5",
          interactive: true
        }
      ).addTo(parkingAreaLayer);
      polygon.bindTooltip(
        `<strong>${escapeHtml(item.name || "Parking")}</strong><br>${selected ? "Selected parking" : `Option ${index + 1}`} · estimated display footprint`,
        { sticky: true, className: "wb-tooltip" }
      );
      polygon.on("click", () => {
        if (typeof selectParking === "function") selectParking(item.id);
      });

      L.circleMarker([Number(item.lat), Number(item.lng)], {
        pane: "wbParkingPointPane",
        radius: selected ? 8 : 6,
        color: "#07110D",
        weight: 2,
        fillColor: colour,
        fillOpacity: 1,
        interactive: true
      }).bindTooltip(`${escapeHtml(item.name || "Parking")} · option ${index + 1}`, {
        direction: "top",
        offset: [0, -9],
        className: "wb-tooltip"
      }).on("click", () => {
        if (typeof selectParking === "function") selectParking(item.id);
      }).addTo(parkingAreaLayer);
    });

    if (state.selectedId) void upgradeSelectedFootprint(state.selectedId);
  }

  function tokenSet(value) {
    return new Set(String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter(token => token.length > 2 && !["car", "park", "parking", "the", "and"].includes(token)));
  }

  function nameOverlap(a, b) {
    const aa = tokenSet(a);
    const bb = tokenSet(b);
    if (!aa.size || !bb.size) return 0;
    let common = 0;
    aa.forEach(token => { if (bb.has(token)) common += 1; });
    return common / Math.max(aa.size, bb.size);
  }

  function centroid(element) {
    if (element?.center?.lat != null && element?.center?.lon != null) {
      return { lat: Number(element.center.lat), lng: Number(element.center.lon) };
    }
    const geometry = Array.isArray(element?.geometry) ? element.geometry : [];
    if (!geometry.length) return null;
    const valid = geometry.filter(point => Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lon)));
    if (!valid.length) return null;
    return {
      lat: valid.reduce((sum, point) => sum + Number(point.lat), 0) / valid.length,
      lng: valid.reduce((sum, point) => sum + Number(point.lon), 0) / valid.length
    };
  }

  async function fetchMappedFootprint(item) {
    if (footprintCache.has(item.id)) return footprintCache.get(item.id);
    const lat = Number(item.lat);
    const lng = Number(item.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    const query = `[out:json][timeout:12];(way(around:180,${lat},${lng})["amenity"="parking"];way(around:180,${lat},${lng})["parking"];);out tags center geom;`;
    const body = new URLSearchParams({ data: query }).toString();
    let payload = null;

    for (const endpoint of OVERPASS) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8", Accept: "application/json" },
          body
        });
        if (!response.ok) continue;
        payload = await response.json();
        if (Array.isArray(payload?.elements)) break;
      } catch (_) {}
    }

    const candidates = (payload?.elements || [])
      .filter(element => Array.isArray(element.geometry) && element.geometry.length >= 3)
      .map(element => {
        const center = centroid(element);
        const distance = center && typeof haversineKm === "function"
          ? haversineKm(lat, lng, center.lat, center.lng)
          : 999;
        const overlap = nameOverlap(item.name, element?.tags?.name || element?.tags?.operator || "");
        return { element, distance, overlap, score: distance - overlap * 0.12 };
      })
      .filter(candidate => candidate.distance <= 0.22)
      .sort((a, b) => a.score - b.score);

    const winner = candidates[0];
    if (!winner) {
      footprintCache.set(item.id, null);
      return null;
    }

    const coords = winner.element.geometry
      .filter(point => Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lon)))
      .map(point => [Number(point.lat), Number(point.lon)]);
    const result = coords.length >= 3 ? {
      coords,
      osmId: winner.element.id,
      name: winner.element?.tags?.name || null
    } : null;
    footprintCache.set(item.id, result);
    return result;
  }

  async function upgradeSelectedFootprint(id) {
    const request = ++footprintRequest;
    clearLayer(selectedFootprintLayer);
    selectedFootprintLayer = L.layerGroup().addTo(map);
    const item = Array.isArray(parkingData) ? parkingData.find(row => row.id === id) : null;
    if (!item) return;

    const mapped = await fetchMappedFootprint(item);
    if (request !== footprintRequest || state.selectedId !== id || !mapped) return;

    const colour = statusColour(item);
    const polygon = L.polygon(mapped.coords, {
      pane: "wbSelectedAreaPane",
      color: "#EDF7F1",
      weight: 2.5,
      opacity: 0.95,
      fillColor: colour,
      fillOpacity: 0.28,
      interactive: true
    }).addTo(selectedFootprintLayer);
    polygon.bindTooltip(
      `<strong>${escapeHtml(item.name || "Selected parking")}</strong><br>Mapped parking footprint · OpenStreetMap`,
      { sticky: true, className: "wb-tooltip" }
    );
    try {
      map.fitBounds(polygon.getBounds(), { padding: [52, 52], maxZoom: 18, animate: false });
    } catch (_) {}
  }

  function renderDestination() {
    clearLayer(destinationLayer);
    destinationLayer = L.layerGroup().addTo(map);
    const destination = state.destination;
    if (!destination || !Number.isFinite(destination.lat) || !Number.isFinite(destination.lng)) return;
    L.circle([destination.lat, destination.lng], {
      pane: "wbParkingAreaPane",
      radius: 180,
      color: "#EDF7F1",
      dashArray: "5 7",
      weight: 1.5,
      opacity: 0.75,
      fillColor: "#78E6AA",
      fillOpacity: 0.035,
      interactive: false
    }).addTo(destinationLayer);
  }

  function selectedParking() {
    return Array.isArray(parkingData) ? parkingData.find(item => item.id === state.selectedId) || null : null;
  }

  function focusSelectedParking() {
    const item = selectedParking();
    if (!item) return;
    try { map.setView([Number(item.lat), Number(item.lng)], 17, { animate: false }); } catch (_) {}
    renderParkingAreas();
    window.setTimeout(resizeBasemap, 20);
  }

  function openStreetView() {
    const item = selectedParking();
    const point = item || state.destination;
    if (!point) return;
    const lat = Number(item ? item.lat : point.lat);
    const lng = Number(item ? item.lng : point.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    window.open(`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${encodeURIComponent(lat)},${encodeURIComponent(lng)}`, "_blank", "noopener,noreferrer");
  }

  function takeoverToolbar() {
    const toolbar = document.querySelector(".wb-map-toolbar");
    if (!toolbar || toolbar.dataset.mapEngineV2 === "true") return;
    toolbar.dataset.mapEngineV2 = "true";
    toolbar.setAttribute("aria-label", "Map views and parking context");

    // Capture layer clicks before the legacy handlers. Parking Layout has no
    // data-layer attribute, so its existing behaviour is preserved.
    toolbar.addEventListener("click", event => {
      const layerButton = event.target.closest?.(".wb-map-layer-button[data-layer]");
      if (layerButton) {
        event.preventDefault();
        event.stopImmediatePropagation();
        activateBasemap(layerButton.dataset.layer);
        return;
      }
      const streetView = event.target.closest?.(".wb-street-view-button");
      if (streetView) {
        event.preventDefault();
        event.stopImmediatePropagation();
        openStreetView();
      }
    }, true);
  }

  function renderCoverage() {
    clearLayer(coverageLayer);
    coverageLayer = L.layerGroup().addTo(map);
    if (typeof coverageAreas === "undefined") return;
    coverageAreas.forEach(area => {
      const colour = area.status === "live" ? "#52D98D" : area.status === "next" ? "#C8F56B" : "#F1C46B";
      L.circle([area.lat, area.lng], {
        pane: "wbParkingAreaPane",
        radius: area.status === "live" ? 24000 : 16000,
        color: colour,
        weight: 1.4,
        dashArray: area.status === "live" ? null : "8 7",
        fillColor: colour,
        fillOpacity: area.status === "live" ? 0.08 : 0.035,
        interactive: false
      }).addTo(coverageLayer);
    });
  }

  function wrapSelection() {
    if (typeof selectParking !== "function" || selectParking.__wbMapEngineV2Wrapped) return;
    const base = selectParking;
    const wrapped = function whiteblockMapEngineV2Select(id, ...args) {
      const result = base.call(this, id, ...args);
      window.setTimeout(focusSelectedParking, 0);
      return result;
    };
    wrapped.__wbMapEngineV2Wrapped = true;
    selectParking = wrapped;
  }

  function loadGuidanceLayer() {
    if (!document.querySelector('link[data-wb-guidance-style]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "./guidance-layer.css";
      link.dataset.wbGuidanceStyle = "true";
      document.head.appendChild(link);
    }
    if (!document.querySelector('script[data-wb-guidance-script]')) {
      const script = document.createElement("script");
      script.src = "./guidance-layer.js";
      script.defer = true;
      script.dataset.wbGuidanceScript = "true";
      document.body.appendChild(script);
    }
  }

  loadStyle();
  ensurePanes();
  takeoverToolbar();
  wrapSelection();
  loadGuidanceLayer();

  // Kill any late Leaflet raster basemap. MapLibre raster/vector sources render
  // inside one canvas; parking markers and SVG polygons remain above it.
  map.on("layeradd", event => {
    const layer = event.layer;
    if (layer instanceof L.TileLayer) {
      window.setTimeout(() => {
        try { if (map.hasLayer(layer)) map.removeLayer(layer); } catch (_) {}
      }, 0);
    }
  });

  document.addEventListener("whiteblock:data-ready", () => {
    wrapSelection();
    renderDestination();
    renderParkingAreas();
    window.setTimeout(resizeBasemap, 30);
  });
  document.addEventListener("whiteblock:kildare-attributes-ready", () => {
    renderParkingAreas();
  });
  document.addEventListener("whiteblock:inventory-map-ready", () => {
    // Inventory clusters are Leaflet markers; pane ordering keeps them above MapLibre.
    window.setTimeout(resizeBasemap, 20);
  });

  document.addEventListener("click", event => {
    if (event.target.closest?.("#ireland-overview-button")) {
      window.setTimeout(() => {
        renderCoverage();
        if (typeof IRELAND_BOUNDS !== "undefined") {
          map.fitBounds(IRELAND_BOUNDS, { padding: [24, 24], maxZoom: 7, animate: false });
        }
        resizeBasemap();
      }, 20);
    }
    if (event.target.closest?.("#search-button") || event.target.closest?.("#destination-suggestions") || event.target.closest?.(".chip")) {
      window.setTimeout(() => {
        renderDestination();
        renderParkingAreas();
        resizeBasemap();
      }, 520);
    }
  });

  window.addEventListener("resize", () => window.setTimeout(resizeBasemap, 80), { passive: true });
  window.addEventListener("orientationchange", () => window.setTimeout(resizeBasemap, 160), { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) window.setTimeout(resizeBasemap, 80);
  });

  // Street is deliberately the default again: readable vector streets plus strong
  // parking overlays. Terrain/Satellite remain available through the same engine.
  activateBasemap("street", { quiet: true });
  renderDestination();
  renderParkingAreas();
})();
