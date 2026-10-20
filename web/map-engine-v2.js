// WHITEBLOCK map engine v3 (kept at the v2 filename for deployment compatibility).
//
// The previous implementation recreated MapLibre layers and forced the WebGL
// container into Leaflet's tilePane. That was fragile on Android Chrome: Leaflet
// overlays survived while the basemap canvas could disappear. This version mirrors
// the stable XPLORE pattern: one persistent L.maplibreGL layer is added normally,
// and Street / Terrain / Satellite switch styles inside that same MapLibre map.
// Leaflet remains responsible for destinations, clusters and parking polygons.

(() => {
  if (window.__WHITEBLOCK_MAP_ENGINE_V3__) return;
  if (typeof L === "undefined" || typeof state === "undefined" || !state.map) return;
  if (typeof L.maplibreGL !== "function") return;

  window.__WHITEBLOCK_MAP_ENGINE_V3__ = true;
  window.__WHITEBLOCK_MAP_ENGINE_V2__ = true;
  // Prevent the retired raster retry adapter from claiming the map later.
  window.__WHITEBLOCK_TILE_RESILIENCE__ = true;

  const map = state.map;
  const mapEl = document.getElementById("map");
  if (!mapEl) return;

  const STREET_STYLE = "https://tiles.openfreemap.org/styles/liberty";
  const TERRAIN_TILE = "https://a.tile.opentopomap.org/{z}/{x}/{y}.png";
  const SATELLITE_TILE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
  const STREET_RASTER_TILE = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  const STREET_BACKUP_TILE = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png";
  const OVERPASS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter"
  ];

  const LAYER_LABELS = { street: "Street", terrain: "Terrain", satellite: "Satellite" };
  let basemapLayer = null;
  let glMap = null;
  let rasterFallbackLayer = null;
  let rasterFallbackSource = null;
  let fallbackGeneration = 0;
  let activeBasemap = "street";
  let styleGeneration = 0;
  let styleHealthTimer = null;
  let styleErrors = 0;
  let rasterLoadWatchdog = null;
  let mapRepairTimer = null;
  let parkingAreaLayer = null;
  let selectedFootprintLayer = null;
  let destinationContextLayer = null;
  let coverageContextLayer = null;
  let footprintRequest = 0;
  const footprintCache = new Map();

  function ensureStylesheet() {
    if (document.querySelector('link[data-whiteblock-map-engine-v3]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "./map-engine-v2.css?v=20260921-3";
    link.dataset.whiteblockMapEngineV3 = "true";
    document.head.appendChild(link);
  }

  function rasterStyle(id, tileUrl, attribution, background, maxzoom = 19) {
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
      layers: [
        { id: `${id}-background`, type: "background", paint: { "background-color": background } },
        { id: `${id}-base`, type: "raster", source: id, minzoom: 0, maxzoom: 22 }
      ]
    };
  }

  function styleFor(key) {
    if (key === "terrain") {
      return rasterStyle(
        "whiteblock-terrain",
        TERRAIN_TILE,
        "© OpenStreetMap contributors · SRTM · OpenTopoMap",
        "#e7e1cf",
        17
      );
    }
    if (key === "satellite") {
      return rasterStyle(
        "whiteblock-satellite",
        SATELLITE_TILE,
        "Tiles © Esri, Maxar, Earthstar Geographics and GIS User Community",
        "#111914",
        19
      );
    }
    return STREET_STYLE;
  }

  function isMapLibreLayer(layer) {
    return Boolean(layer) && (typeof layer.getMaplibreMap === "function" || Boolean(layer._glMap));
  }

  function getGlMap(layer = basemapLayer) {
    try {
      if (typeof layer?.getMaplibreMap === "function") return layer.getMaplibreMap();
      return layer?._glMap || null;
    } catch (_) {
      return null;
    }
  }

  function removeLegacyBasemaps() {
    map.eachLayer(layer => {
      if (layer === basemapLayer || layer === rasterFallbackLayer) return;
      if (!(layer instanceof L.TileLayer) && !isMapLibreLayer(layer)) return;
      try { map.removeLayer(layer); } catch (_) {}
    });
  }

  function updateToolbar(key) {
    document.querySelectorAll(".wb-map-layer-button[data-layer]").forEach(button => {
      const active = button.dataset.layer === key;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function updateMapTheme(key) {
    activeBasemap = key;
    mapEl.dataset.basemapEngine = "maplibre-v3";
    mapEl.dataset.basemap = key;
    mapEl.classList.remove("wb-map-street", "wb-map-terrain", "wb-map-satellite");
    mapEl.classList.add(`wb-map-${key}`);
    updateToolbar(key);
  }

  function resizeBasemap() {
    const gl = glMap || getGlMap();
    if (!gl?.resize) return;
    try { gl.resize(); } catch (_) {}
  }

  function repairMapGeometry(delay = 0) {
    if (mapRepairTimer) window.clearTimeout(mapRepairTimer);
    mapRepairTimer = window.setTimeout(() => {
      mapRepairTimer = null;
      window.requestAnimationFrame(() => {
        try { map.invalidateSize({ pan: false, animate: false, debounceMoveend: true }); } catch (_) {}
        resizeBasemap();
      });
    }, delay);
  }

  function clearRasterLoadWatchdog() {
    if (rasterLoadWatchdog) window.clearTimeout(rasterLoadWatchdog);
    rasterLoadWatchdog = null;
  }

  // When WebGL or a vector style cannot load on a mobile browser, continue
  // showing a *geographical* Leaflet tile map. A schematic must never replace
  // the real map without an explicit user request.
  function activateRasterFallback(reason, key = "street") {
    const generation = ++fallbackGeneration;
    ++styleGeneration; // invalidate style health callbacks from the failed GL map
    clearStyleHealthTimer();
    const selected = LAYER_LABELS[key] ? key : "street";
    const source = selected === "terrain" ? "terrain"
      : selected === "satellite" ? "satellite" : "street";
    const configs = {
      street: {
        url: STREET_RASTER_TILE, maxNativeZoom: 19, maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors"
      },
      backup: {
        url: STREET_BACKUP_TILE, maxNativeZoom: 19, maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors &copy; CARTO"
      },
      terrain: {
        url: TERRAIN_TILE, maxNativeZoom: 17, maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors &copy; OpenTopoMap"
      },
      satellite: {
        url: SATELLITE_TILE, maxNativeZoom: 19, maxZoom: 19,
        attribution: "Tiles &copy; Esri and contributors"
      }
    };
    function attachTiles(provider) {
      if (generation !== fallbackGeneration) return;
      clearRasterLoadWatchdog();
      if (rasterFallbackLayer && map.hasLayer(rasterFallbackLayer)) map.removeLayer(rasterFallbackLayer);
      rasterFallbackLayer = null;
      if (basemapLayer && map.hasLayer(basemapLayer)) {
        try { map.removeLayer(basemapLayer); } catch (_) {}
      }
      basemapLayer = null;
      glMap = null;
      const config = configs[provider];
      const layer = L.tileLayer(config.url, {
        maxZoom: config.maxZoom,
        maxNativeZoom: config.maxNativeZoom,
        updateWhenIdle: false,
        updateWhenZooming: false,
        keepBuffer: 3,
        attribution: config.attribution
      });
      rasterFallbackLayer = layer; // assigned before layeradd fires
      rasterFallbackSource = provider;
      let tileErrors = 0;
      let tileLoads = 0;
      let complete = false;

      layer.on("tileload", () => {
        if (layer === rasterFallbackLayer && generation === fallbackGeneration) tileLoads += 1;
      });
      layer.on("tileerror", () => {
        if (layer !== rasterFallbackLayer || generation !== fallbackGeneration) return;
        tileErrors += 1;
        if (tileErrors >= 2 && provider === "street") {
          // Do not leave a checkerboard on screen: switch provider as soon as
          // the primary street tile grid proves incomplete.
          attachTiles("backup");
        } else if (tileErrors >= 2 && (provider === "terrain" || provider === "satellite")) {
          activateRasterFallback(LAYER_LABELS[selected] + " tiles unavailable · switched to Street", "street");
        } else if (tileErrors >= 2 && provider === "backup" && typeof setMapStatus === "function") {
          setMapStatus("Street tiles unavailable", "Both street-map tile sources failed · check network connectivity");
        }
      });
      layer.on("load", () => {
        if (layer !== rasterFallbackLayer || generation !== fallbackGeneration) return;
        complete = true;
        clearRasterLoadWatchdog();
        mapEl.classList.remove("wb-map-repairing");
        repairMapGeometry(0);
      });

      layer.addTo(map);
      updateMapTheme(selected);
      mapEl.dataset.basemapEngine = "raster-fallback";
      mapEl.dataset.basemapSource = provider;
      mapEl.classList.add("wb-map-repairing");
      if (typeof setMapStatus === "function") {
        setMapStatus(selected === "street" ? "Street map · compatibility mode" : LAYER_LABELS[selected] + " map",
          reason || "Geographical basemap shown without WebGL");
      }
      repairMapGeometry(0);

      // Some Android/network failures leave requests hanging without emitting
      // enough tileerror events. A provider can therefore display one or two
      // tiles indefinitely. Require the visible tile grid to complete within a
      // bounded time and fail over even when requests merely stall.
      rasterLoadWatchdog = window.setTimeout(() => {
        if (complete || layer !== rasterFallbackLayer || generation !== fallbackGeneration) return;
        if (provider === "street") {
          attachTiles("backup");
          return;
        }
        if (provider === "terrain" || provider === "satellite") {
          activateRasterFallback(LAYER_LABELS[selected] + " tile grid incomplete · switched to Street", "street");
          return;
        }
        mapEl.classList.remove("wb-map-repairing");
        repairMapGeometry(0);
        if (typeof setMapStatus === "function") {
          const detail = tileLoads
            ? `Street map partially loaded (${tileLoads} tiles) · retry or check network connectivity`
            : "Street map could not load tiles · check network connectivity";
          setMapStatus("Street map source incomplete", detail);
        }
      }, 3200);
    }
    attachTiles(source);
  }

  function clearStyleHealthTimer() {
    if (styleHealthTimer) window.clearTimeout(styleHealthTimer);
    styleHealthTimer = null;
  }

  function armStyleHealth(key, generation) {
    clearStyleHealthTimer();
    styleErrors = 0;
    mapEl.classList.add("wb-map-repairing");

    const recovered = () => {
      if (generation !== styleGeneration) return;
      clearStyleHealthTimer();
      styleErrors = 0;
      mapEl.classList.remove("wb-map-repairing");
      window.requestAnimationFrame(resizeBasemap);
    };

    const currentGl = glMap;
    currentGl?.once?.("style.load", recovered);
    currentGl?.once?.("idle", recovered);

    styleHealthTimer = window.setTimeout(() => {
      if (generation !== styleGeneration) return;
      let loaded = false;
      try { loaded = Boolean(currentGl?.isStyleLoaded?.()); } catch (_) {}
      if (loaded) return recovered();

      if (key !== "street") {
        if (typeof setMapStatus === "function") {
          setMapStatus(`${LAYER_LABELS[key]} temporarily unavailable`, "Returning to Street map");
        }
        switchBasemap("street", { quiet: true });
      } else {
        activateRasterFallback("Vector map unavailable · OpenStreetMap street tiles shown");
      }
    }, 4500);
  }

  function bindGlHealth() {
    if (!glMap || glMap.__whiteblockHealthBound) return;
    glMap.__whiteblockHealthBound = true;
    glMap.on?.("error", event => {
      // MapLibre can report isolated glyph/tile errors while the map remains usable.
      // Only act after a sustained burst from the currently selected non-Street style.
      styleErrors += 1;
      if (styleErrors >= 16 && activeBasemap !== "street") {
        switchBasemap("street", { quiet: true });
      }
      if (event?.error) console.debug("WHITEBLOCK map source warning", event.error.message || event.error);
    });
  }

  function createPersistentBasemap() {
    removeLegacyBasemaps();
    try {
      // Intentionally mirrors XPLORE: no custom pane and no custom canvas sizing.
      basemapLayer = L.maplibreGL({
        style: STREET_STYLE,
        interactive: false,
        attributionControl: false
      });
      basemapLayer.__whiteblockMapEngineV3 = true;
      basemapLayer.addTo(map);
    } catch (error) {
      console.warn("WHITEBLOCK MapLibre could not initialise", error);
      activateRasterFallback("MapLibre could not start · showing geographical street tiles");
      return false;
    }

    const connect = (attempt = 0) => {
      glMap = getGlMap();
      if (!glMap) {
        if (attempt < 80) return window.setTimeout(() => connect(attempt + 1), 50);
        activateRasterFallback("Map canvas unavailable · showing geographical street tiles");
        return;
      }
      bindGlHealth();
      const generation = ++styleGeneration;
      updateMapTheme("street");
      armStyleHealth("street", generation);
      repairMapGeometry(0);
    };
    connect();
    return true;
  }

  function switchBasemap(key, { quiet = false } = {}) {
    if (!LAYER_LABELS[key]) key = "street";
    // The toolbar always restores an actual map, even after a GL failure.
    document.dispatchEvent(new CustomEvent("whiteblock:map-basemap-selected", { detail: { key } }));
    if (!glMap) {
      activateRasterFallback(LAYER_LABELS[key] + " geographic map", key);
      return;
    }

    const generation = ++styleGeneration;
    updateMapTheme(key);
    try {
      glMap.setStyle(styleFor(key), { diff: false });
      armStyleHealth(key, generation);
      if (!quiet && typeof setMapStatus === "function") {
        const currentTitle = document.getElementById("map-status-title")?.textContent || "Parking map";
        const currentCopy = document.getElementById("map-status-copy")?.textContent || "";
        if (/map renderer unavailable|temporarily unavailable/i.test(currentTitle)) {
          setMapStatus(`${LAYER_LABELS[key]} map`, "Parking overlays remain active on this layer");
        } else if (!currentCopy) {
          setMapStatus(currentTitle, `${LAYER_LABELS[key]} basemap · parking overlays active`);
        }
      }
    } catch (error) {
      console.warn(`WHITEBLOCK could not switch to ${key}`, error);
      if (key !== "street") switchBasemap("street", { quiet: true });
      else activateRasterFallback("Street vector style failed · showing geographical street tiles");
    }
    window.requestAnimationFrame(resizeBasemap);
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
        if (Array.isArray(rows)) {
          return rows.filter(item => Number.isFinite(Number(item?.lat)) && Number.isFinite(Number(item?.lng)));
        }
      }
    } catch (_) {}
    return Array.isArray(parkingData)
      ? parkingData.filter(item => Number.isFinite(Number(item?.lat)) && Number.isFinite(Number(item?.lng))).slice(0, 12)
      : [];
  }

  function footprintRadius(item) {
    const capacity = Number(item?.capacity);
    if (!Number.isFinite(capacity) || capacity <= 0) return 42;
    // Visual estimate only: 28 m² per space including circulation, capped so a
    // capacity value can never create an implausibly huge UI polygon.
    return Math.max(30, Math.min(110, Math.sqrt((capacity * 28) / Math.PI)));
  }

  function approximatePolygon(lat, lng, radiusMeters, points = 20) {
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
    const panes = [
      ["wbParkingAreaPane", "455"],
      ["wbSelectedAreaPane", "485"],
      ["wbParkingPointPane", "645"]
    ];
    panes.forEach(([name, zIndex]) => {
      if (map.getPane(name)) return;
      const pane = map.createPane(name);
      pane.style.zIndex = zIndex;
      pane.style.pointerEvents = "auto";
    });
  }

  function clearLayer(layer) {
    if (!layer) return;
    try { if (map.hasLayer(layer)) map.removeLayer(layer); } catch (_) {}
  }

  function renderParkingAreas() {
    ensurePanes();
    clearLayer(parkingAreaLayer);
    parkingAreaLayer = null;
    const policy = window.WHITEBLOCK_MARKER_POLICY;
    // The MapLibre ranked overlay owns all numbers, circles and polygons when
    // available. Never draw a second set of Leaflet markers beneath it.
    if (policy.browseActive(state) || !state.destination ||
        window.__WHITEBLOCK_PARKING_GL_OVERLAY__) return;
    const rows = resultItems();
    const zoom = map.getZoom();
    const groups = policy.groupNearby(rows, zoom,
      item => map.project(L.latLng(Number(item.lat), Number(item.lng)), zoom),
      { radiusPx: policy.rankedRadiusPx, detailZoom: policy.detailZoom });
    parkingAreaLayer = L.layerGroup().addTo(map);
    if (zoom < policy.detailZoom) {
      // Fallback renderer if the GL overlay has not loaded: one zoomable
      // aggregate per nearby group, never seven overlapping raw points.
      groups.forEach(indices => {
        const members = indices.map(index => rows[index]);
        const lat = members.reduce((sum, item) => sum + Number(item.lat), 0) / members.length;
        const lng = members.reduce((sum, item) => sum + Number(item.lng), 0) / members.length;
        const count = members.length;
        L.marker([lat, lng], {
          icon: L.divIcon({
            className: "wb-parking-cluster-wrapper",
            html: `<div class="wb-parking-cluster"><span>${count}</span><small>parking</small></div>`,
            iconSize: [54, 54], iconAnchor: [27, 27]
          })
        }).addTo(parkingAreaLayer)
          .bindTooltip(count + " mapped parking locations · tap to zoom", { className: "wb-tooltip" })
          .on("click", () => map.flyTo([lat, lng], Math.min(policy.detailZoom, zoom + 2), { duration: .7 }));
      });
      return;
    }

    rows.forEach((item, index) => {
      const selected = item.id === state.selectedId;
      const colour = statusColour(item);
      const lat = Number(item.lat);
      const lng = Number(item.lng);
      const polygon = L.polygon(approximatePolygon(lat, lng, footprintRadius(item)), {
        pane: "wbParkingAreaPane",
        color: selected ? "#EDF7F1" : colour,
        weight: selected ? 3 : 1.7,
        opacity: selected ? 1 : 0.9,
        fillColor: colour,
        fillOpacity: selected ? 0.32 : 0.16,
        dashArray: selected ? null : "6 5",
        interactive: true
      }).addTo(parkingAreaLayer);
      polygon.bindTooltip(
        `<strong>${escapeHtml(item.name || "Parking")}</strong><br>${selected ? "Selected parking" : `Option ${index + 1}`} · estimated footprint`,
        { sticky: true, className: "wb-tooltip" }
      );
      polygon.on("click", () => typeof selectParking === "function" && selectParking(item.id));

      L.circleMarker([lat, lng], {
        pane: "wbParkingPointPane",
        radius: selected ? 9 : 6.5,
        color: "#07110D",
        weight: 2.5,
        fillColor: colour,
        fillOpacity: 1,
        interactive: true
      }).bindTooltip(`${escapeHtml(item.name || "Parking")} · option ${index + 1}`, {
        direction: "top",
        offset: [0, -10],
        className: "wb-tooltip"
      }).on("click", () => typeof selectParking === "function" && selectParking(item.id))
        .addTo(parkingAreaLayer);
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
    const result = coords.length >= 3 ? { coords, osmId: winner.element.id } : null;
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
      color: "#FFFFFF",
      weight: 3.2,
      opacity: 1,
      fillColor: colour,
      fillOpacity: 0.36,
      interactive: true
    }).addTo(selectedFootprintLayer);
    polygon.bindTooltip(
      `<strong>${escapeHtml(item.name || "Selected parking")}</strong><br>Mapped parking footprint · OpenStreetMap`,
      { sticky: true, className: "wb-tooltip" }
    );
    try { map.fitBounds(polygon.getBounds(), { padding: [52, 52], maxZoom: 18, animate: false }); } catch (_) {}
  }

  function renderDestinationContext() {
    clearLayer(destinationContextLayer);
    destinationContextLayer = L.layerGroup().addTo(map);
    const destination = state.destination;
    if (!destination || !Number.isFinite(Number(destination.lat)) || !Number.isFinite(Number(destination.lng))) return;
    L.circle([Number(destination.lat), Number(destination.lng)], {
      pane: "wbParkingAreaPane",
      radius: 150,
      color: "#EDF7F1",
      dashArray: "5 7",
      weight: 1.6,
      opacity: 0.9,
      fillColor: "#78E6AA",
      fillOpacity: 0.06,
      interactive: false
    }).addTo(destinationContextLayer);
  }

  function selectedParking() {
    return Array.isArray(parkingData) ? parkingData.find(item => item.id === state.selectedId) || null : null;
  }

  function focusSelectedParking() {
    const item = selectedParking();
    if (!item) return;
    try { map.setView([Number(item.lat), Number(item.lng)], 17, { animate: false }); } catch (_) {}
    renderParkingAreas();
    window.setTimeout(resizeBasemap, 40);
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
    if (!toolbar || toolbar.dataset.mapEngineV3 === "true") return;
    toolbar.dataset.mapEngineV3 = "true";
    toolbar.setAttribute("aria-label", "Map views and parking context");
    toolbar.addEventListener("click", event => {
      const layerButton = event.target.closest?.(".wb-map-layer-button[data-layer]");
      if (layerButton) {
        event.preventDefault();
        event.stopImmediatePropagation();
        switchBasemap(layerButton.dataset.layer);
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
    clearLayer(coverageContextLayer);
    coverageContextLayer = L.layerGroup().addTo(map);
    if (typeof coverageAreas === "undefined") return;
    coverageAreas.forEach(area => {
      const colour = area.status === "live" ? "#52D98D" : area.status === "next" ? "#C8F56B" : "#F1C46B";
      L.circle([area.lat, area.lng], {
        pane: "wbParkingAreaPane",
        radius: area.status === "live" ? 24000 : 16000,
        color: colour,
        weight: 1.5,
        dashArray: area.status === "live" ? null : "8 7",
        fillColor: colour,
        fillOpacity: area.status === "live" ? 0.10 : 0.04,
        interactive: false
      }).addTo(coverageContextLayer);
    });
  }

  function wrapSelection() {
    if (typeof selectParking !== "function" || selectParking.__wbMapEngineV3Wrapped) return;
    const base = selectParking;
    const wrapped = function whiteblockMapEngineV3Select(id, ...args) {
      const result = base.call(this, id, ...args);
      window.setTimeout(focusSelectedParking, 0);
      return result;
    };
    wrapped.__wbMapEngineV3Wrapped = true;
    selectParking = wrapped;
  }

  ensureStylesheet();
  ensurePanes();
  takeoverToolbar();
  wrapSelection();

  map.on("layeradd", event => {
    const layer = event.layer;
    if (layer === basemapLayer) return;
    if (layer instanceof L.TileLayer || isMapLibreLayer(layer)) {
      window.setTimeout(() => {
        if (layer === basemapLayer || layer === rasterFallbackLayer) return;
        try { if (map.hasLayer(layer)) map.removeLayer(layer); } catch (_) {}
      }, 0);
    }
  });

  document.addEventListener("whiteblock:data-ready", () => {
    wrapSelection();
    renderDestinationContext();
    renderParkingAreas();
    window.setTimeout(resizeBasemap, 40);
  });
  document.addEventListener("whiteblock:coverage-browse", () => {
    // Ireland/region browsing owns the visible overlay while there is no
    // destination. Remove stale recommendation footprints from the prior search.
    clearLayer(parkingAreaLayer);
    clearLayer(selectedFootprintLayer);
    clearLayer(destinationContextLayer);
    parkingAreaLayer = null;
    selectedFootprintLayer = null;
    destinationContextLayer = null;
    window.setTimeout(resizeBasemap, 30);
  });
  document.addEventListener("whiteblock:kildare-attributes-ready", renderParkingAreas);
  document.addEventListener("whiteblock:ranked-gl-overlay-ready", renderParkingAreas);
  map.on("zoomend", renderParkingAreas);
  document.addEventListener("whiteblock:inventory-map-ready", () => window.setTimeout(resizeBasemap, 30));

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
        renderDestinationContext();
        renderParkingAreas();
        resizeBasemap();
      }, 520);
    }
  });

  window.addEventListener("resize", () => repairMapGeometry(100), { passive: true });
  window.addEventListener("orientationchange", () => repairMapGeometry(180), { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) repairMapGeometry(100);
  });

  if (typeof ResizeObserver !== "undefined") {
    const resizeObserver = new ResizeObserver(() => repairMapGeometry(80));
    resizeObserver.observe(mapEl);
  }

  createPersistentBasemap();
  renderDestinationContext();
  renderParkingAreas();
})();
