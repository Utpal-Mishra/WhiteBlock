// WHITEBLOCK map adapter.
// Default Street view now mirrors XPLORE's stable architecture:
// Leaflet owns the map/overlays while MapLibre + OpenFreeMap render the basemap.
// Raster tiles remain only for explicit Terrain/Satellite modes and emergency fallback.

(() => {
  if (typeof L === "undefined" || typeof state === "undefined" || !state.map) return;

  const map = state.map;
  const mapEl = document.getElementById("map");
  if (!mapEl) return;

  const VECTOR_STYLE = "https://tiles.openfreemap.org/styles/dark";
  const MAPLIBRE_CSS = "https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.css";
  const MAPLIBRE_JS = "https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.js";
  const LEAFLET_MAPLIBRE_JS = "https://unpkg.com/@maplibre/maplibre-gl-leaflet/leaflet-maplibre-gl.js";

  const OSM = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  const OPENTOPO = "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png";
  const ESRI_IMAGERY = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

  const layerDefinitions = {
    street: { label: "Street", className: "wb-map-street", kind: "vector" },
    terrain: {
      label: "Terrain",
      className: "wb-map-terrain",
      kind: "raster",
      url: OPENTOPO,
      maxZoom: 17,
      attribution: 'Map data &copy; OpenStreetMap contributors, SRTM | Map style &copy; OpenTopoMap'
    },
    satellite: {
      label: "Satellite",
      className: "wb-map-satellite",
      kind: "raster",
      url: ESRI_IMAGERY,
      maxZoom: 19,
      attribution: "Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community"
    }
  };

  let activeLayerKey = "street";
  let activeBasemapLayer = null;
  let vectorEnginePromise = null;
  let vectorAttributionAdded = false;
  let parkingContextLayer = null;
  let destinationContextLayer = null;
  let coverageTintLayer = null;
  let repairTimer = null;
  let resizeTimer = null;

  function ensureContextStyles() {
    if (!document.querySelector('link[data-wb-map-context]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "./map-context.css";
      link.dataset.wbMapContext = "true";
      document.head.appendChild(link);
    }

    if (!document.getElementById("wb-maplibre-css")) {
      const link = document.createElement("link");
      link.id = "wb-maplibre-css";
      link.rel = "stylesheet";
      link.href = MAPLIBRE_CSS;
      document.head.appendChild(link);
    }
  }

  function loadScript(src, id) {
    return new Promise((resolve, reject) => {
      const existing = document.getElementById(id);
      if (existing) {
        if (existing.dataset.loaded === "true") return resolve();
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.id = id;
      script.src = src;
      script.async = true;
      script.addEventListener("load", () => {
        script.dataset.loaded = "true";
        resolve();
      }, { once: true });
      script.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
      document.head.appendChild(script);
    });
  }

  function ensureVectorEngine() {
    if (typeof L.maplibreGL === "function") return Promise.resolve();
    if (vectorEnginePromise) return vectorEnginePromise;

    vectorEnginePromise = (async () => {
      ensureContextStyles();
      if (typeof window.maplibregl === "undefined") {
        await loadScript(MAPLIBRE_JS, "wb-maplibre-js");
      }
      if (typeof L.maplibreGL !== "function") {
        await loadScript(LEAFLET_MAPLIBRE_JS, "wb-leaflet-maplibre-js");
      }
      if (typeof L.maplibreGL !== "function") throw new Error("MapLibre Leaflet adapter unavailable");
    })();

    return vectorEnginePromise;
  }

  function removeBasemap() {
    if (activeBasemapLayer && map.hasLayer(activeBasemapLayer)) {
      map.removeLayer(activeBasemapLayer);
    }
    activeBasemapLayer = null;

    // Remove only raster basemaps; parking markers, circles and guidance layers remain.
    map.eachLayer(layer => {
      if (layer instanceof L.TileLayer) map.removeLayer(layer);
    });
  }

  function updateLayerButtons(key) {
    document.querySelectorAll(".wb-map-layer-button").forEach(button => {
      const active = button.dataset.layer === key;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function applyMapTheme(key) {
    Object.values(layerDefinitions).forEach(definition => mapEl.classList.remove(definition.className));
    mapEl.classList.add(layerDefinitions[key].className);
    mapEl.classList.toggle("wb-map-vector", key === "street");
  }

  function addVectorAttribution() {
    if (vectorAttributionAdded || !map.attributionControl) return;
    map.attributionControl.addAttribution('&copy; <a href="https://openfreemap.org/">OpenFreeMap</a> · &copy; OpenStreetMap contributors');
    vectorAttributionAdded = true;
  }

  function buildRasterLayer(definition) {
    const layer = L.tileLayer(definition.url, {
      maxZoom: definition.maxZoom || 19,
      maxNativeZoom: definition.maxZoom || 19,
      detectRetina: false,
      updateWhenIdle: true,
      updateWhenZooming: false,
      keepBuffer: 1,
      attribution: definition.attribution
    });

    layer.on("loading", () => mapEl.classList.add("wb-map-repairing"));
    layer.on("load", () => mapEl.classList.remove("wb-map-repairing"));
    return layer;
  }

  async function activateStreetVector() {
    activeLayerKey = "street";
    updateLayerButtons("street");
    applyMapTheme("street");
    mapEl.classList.add("wb-map-repairing");
    removeBasemap();

    try {
      await ensureVectorEngine();
      if (activeLayerKey !== "street") return;

      activeBasemapLayer = L.maplibreGL({ style: VECTOR_STYLE });
      activeBasemapLayer.addTo(map);
      addVectorAttribution();
      mapEl.dataset.basemapEngine = "vector";
      mapEl.classList.remove("wb-map-repairing");
      scheduleMapRepair();
    } catch (error) {
      console.warn("WHITEBLOCK vector basemap unavailable; using raster fallback.", error);
      if (activeLayerKey !== "street") return;

      activeBasemapLayer = L.tileLayer(OSM, {
        maxZoom: 19,
        detectRetina: false,
        updateWhenIdle: true,
        updateWhenZooming: false,
        keepBuffer: 1,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);
      mapEl.dataset.basemapEngine = "raster-fallback";
      mapEl.classList.remove("wb-map-repairing");
      scheduleMapRepair();
    }
  }

  function activateRasterLayer(key) {
    const definition = layerDefinitions[key];
    if (!definition || definition.kind !== "raster") return;

    activeLayerKey = key;
    removeBasemap();
    activeBasemapLayer = buildRasterLayer(definition).addTo(map);
    if (typeof activeBasemapLayer.bringToBack === "function") activeBasemapLayer.bringToBack();
    updateLayerButtons(key);
    applyMapTheme(key);
    mapEl.dataset.basemapEngine = "raster";
    scheduleMapRepair();
  }

  function activateLayer(key) {
    if (key === "street") {
      void activateStreetVector();
      return;
    }
    activateRasterLayer(key);
  }

  function statusColour(item) {
    if (item.available == null || item.capacity == null || item.capacity <= 0) return "#8FA39A";
    const ratio = item.available / item.capacity;
    if (ratio >= 0.25) return "#52D98D";
    if (ratio >= 0.12) return "#C8F56B";
    return "#F1C46B";
  }

  function refreshParkingContext() {
    if (parkingContextLayer) map.removeLayer(parkingContextLayer);
    parkingContextLayer = L.layerGroup().addTo(map);

    if (typeof parkingData === "undefined") return;
    parkingData.forEach(item => {
      if (!Number.isFinite(item.lat) || !Number.isFinite(item.lng)) return;
      const colour = statusColour(item);
      L.circle([item.lat, item.lng], {
        radius: 180,
        color: colour,
        weight: 1.2,
        opacity: 0.72,
        fillColor: colour,
        fillOpacity: 0.13,
        className: "wb-context-halo",
        interactive: false
      }).addTo(parkingContextLayer);
    });
  }

  function refreshDestinationContext() {
    if (destinationContextLayer) map.removeLayer(destinationContextLayer);
    destinationContextLayer = L.layerGroup().addTo(map);

    if (!state.destination) return;
    L.circle([state.destination.lat, state.destination.lng], {
      radius: 500,
      color: "#78E6AA",
      dashArray: "6 7",
      weight: 1.4,
      opacity: 0.75,
      fillColor: "#78E6AA",
      fillOpacity: 0.04,
      interactive: false
    }).addTo(destinationContextLayer);
  }

  function clearCoverageTint() {
    if (!coverageTintLayer) return;
    map.removeLayer(coverageTintLayer);
    coverageTintLayer = null;
  }

  function renderCoverageTint() {
    clearCoverageTint();
    if (typeof coverageAreas === "undefined") return;

    coverageTintLayer = L.layerGroup().addTo(map);
    const colours = { live: "#52D98D", next: "#C8F56B", planned: "#F1C46B" };

    coverageAreas.forEach(area => {
      const colour = colours[area.status] || "#8FA39A";
      L.circle([area.lat, area.lng], {
        radius: area.status === "live" ? 26000 : 18000,
        color: colour,
        weight: 1.3,
        opacity: 0.72,
        fillColor: colour,
        fillOpacity: area.status === "live" ? 0.10 : 0.055,
        className: "wb-coverage-tint",
        interactive: false
      }).addTo(coverageTintLayer);
    });
  }

  function selectedParking() {
    if (typeof parkingData === "undefined") return null;
    return parkingData.find(item => item.id === state.selectedId) || null;
  }

  function streetViewFocus() {
    const destination = state.destination || null;
    const selected = selectedParking();
    const inPilot = destination && typeof isInCorkPilot === "function"
      ? isInCorkPilot(destination.lat, destination.lng)
      : true;

    if (selected && inPilot) return { lat: selected.lat, lng: selected.lng, label: selected.name };
    if (destination) return { lat: destination.lat, lng: destination.lng, label: destination.primary || destination.label || "Destination" };
    return selected ? { lat: selected.lat, lng: selected.lng, label: selected.name } : null;
  }

  function openStreetView() {
    const point = streetViewFocus();
    if (!point) return;
    const url = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${encodeURIComponent(point.lat)},${encodeURIComponent(point.lng)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function createToolbar() {
    if (document.querySelector(".wb-map-toolbar")) return;

    const toolbar = document.createElement("div");
    toolbar.className = "wb-map-toolbar";
    toolbar.setAttribute("aria-label", "Map layers and street context");

    Object.entries(layerDefinitions).forEach(([key, definition]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "wb-map-layer-button";
      button.dataset.layer = key;
      button.textContent = definition.label;
      button.setAttribute("aria-pressed", String(key === activeLayerKey));
      button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        activateLayer(key);
      });
      toolbar.appendChild(button);
    });

    const streetButton = document.createElement("button");
    streetButton.type = "button";
    streetButton.className = "wb-street-view-button";
    streetButton.textContent = "Street View ↗";
    streetButton.title = "Open Street View near the selected parking location or destination";
    streetButton.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      openStreetView();
    });
    toolbar.appendChild(streetButton);
    mapEl.appendChild(toolbar);

    L.DomEvent.disableClickPropagation(toolbar);
    L.DomEvent.disableScrollPropagation(toolbar);
  }

  function createStateLegend() {
    if (document.querySelector(".wb-map-state-legend")) return;
    const legend = document.createElement("div");
    legend.className = "wb-map-state-legend";
    legend.setAttribute("aria-label", "Parking availability colour legend");
    legend.innerHTML = `
      <span><i class="good"></i>Good</span>
      <span><i class="moderate"></i>Moderate</span>
      <span><i class="pressure"></i>Pressure</span>`;
    mapEl.appendChild(legend);
    L.DomEvent.disableClickPropagation(legend);
  }

  function resizeVectorCanvas() {
    if (!activeBasemapLayer || activeLayerKey !== "street") return;
    try {
      if (typeof activeBasemapLayer.getMaplibreMap === "function") {
        activeBasemapLayer.getMaplibreMap()?.resize?.();
      } else if (activeBasemapLayer._glMap?.resize) {
        activeBasemapLayer._glMap.resize();
      }
    } catch (error) {
      console.debug("WHITEBLOCK vector resize skipped", error);
    }
  }

  function repairMap() {
    if (!map || !mapEl.isConnected) return;
    window.requestAnimationFrame(() => {
      map.invalidateSize({ pan: false, animate: false, debounceMoveend: true });
      resizeVectorCanvas();
    });
  }

  function scheduleMapRepair() {
    if (repairTimer) window.clearTimeout(repairTimer);
    repairMap();
    repairTimer = window.setTimeout(() => {
      repairMap();
      mapEl.classList.remove("wb-map-repairing");
    }, 180);
  }

  function scheduleResizeRepair() {
    if (resizeTimer) window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(scheduleMapRepair, 120);
  }

  function fitRecommendationContext() {
    clearCoverageTint();
    const destination = state.destination || null;
    const inPilot = destination && typeof isInCorkPilot === "function"
      ? isInCorkPilot(destination.lat, destination.lng)
      : true;

    if (destination && !inPilot) {
      map.setView([destination.lat, destination.lng], 15, { animate: false });
      return;
    }

    if (typeof parkingData === "undefined" || !parkingData.length) return;
    const points = parkingData
      .filter(item => Number.isFinite(item.lat) && Number.isFinite(item.lng))
      .map(item => [item.lat, item.lng]);
    if (destination) points.push([destination.lat, destination.lng]);
    if (!points.length) return;
    map.fitBounds(L.latLngBounds(points), { padding: [32, 32], maxZoom: 15, animate: false });
  }

  function focusSelectedParking() {
    const selected = selectedParking();
    if (!selected) return;
    clearCoverageTint();
    map.setView([selected.lat, selected.lng], 16, { animate: false });
    refreshDestinationContext();
    scheduleMapRepair();
  }

  function normalizeIrelandCoverageLabel() {
    const overviewButton = document.getElementById("ireland-overview-button");
    if (overviewButton && overviewButton.textContent.trim() !== "Ireland Coverage View") {
      overviewButton.textContent = "Ireland Coverage View";
    }

    const status = document.getElementById("map-status-title");
    const current = status?.textContent.trim() || "";
    if (status && current.toLowerCase() === "ireland coverage view" && current !== "Ireland Coverage View") {
      status.textContent = "Ireland Coverage View";
    }
  }

  function loadGuidanceIntelligenceLayer() {
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

  const statusTitle = document.getElementById("map-status-title");
  if (statusTitle) {
    new MutationObserver(normalizeIrelandCoverageLabel).observe(statusTitle, {
      childList: true,
      characterData: true,
      subtree: true
    });
  }

  document.addEventListener("click", event => {
    const parkingCard = event.target.closest?.(".parking-card");
    if (parkingCard) {
      window.setTimeout(focusSelectedParking, 70);
      return;
    }

    if (event.target.closest?.("#search-button") || event.target.closest?.("#destination-suggestions")) {
      window.setTimeout(() => {
        refreshDestinationContext();
        fitRecommendationContext();
        scheduleMapRepair();
      }, 620);
    }

    if (event.target.closest?.("#ireland-overview-button")) {
      window.setTimeout(() => {
        renderCoverageTint();
        if (typeof IRELAND_BOUNDS !== "undefined") {
          map.fitBounds(IRELAND_BOUNDS, { padding: [22, 22], maxZoom: 7, animate: false });
        }
        normalizeIrelandCoverageLabel();
        scheduleMapRepair();
      }, 50);
    }
  });

  document.addEventListener("whiteblock:data-ready", () => {
    refreshParkingContext();
    refreshDestinationContext();
    fitRecommendationContext();
    scheduleMapRepair();
  });

  document.getElementById("destination")?.addEventListener("change", () => {
    window.setTimeout(() => {
      refreshDestinationContext();
      fitRecommendationContext();
      scheduleMapRepair();
    }, 140);
  });

  window.addEventListener("resize", scheduleResizeRepair, { passive: true });
  window.addEventListener("orientationchange", () => window.setTimeout(scheduleMapRepair, 180), { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) window.setTimeout(scheduleMapRepair, 100);
  });

  if (typeof ResizeObserver !== "undefined") {
    const resizeObserver = new ResizeObserver(scheduleResizeRepair);
    resizeObserver.observe(mapEl);
  }

  map.options.zoomAnimation = false;
  map.options.fadeAnimation = false;

  ensureContextStyles();
  createToolbar();
  createStateLegend();
  refreshParkingContext();
  refreshDestinationContext();
  normalizeIrelandCoverageLabel();
  loadGuidanceIntelligenceLayer();
  void activateStreetVector();
})();
