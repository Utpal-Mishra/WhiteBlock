// WHITEBLOCK prototype map adapter.
// Adds keyless colour basemaps, parking/coverage context, mobile resize repair,
// recommendation-aware camera behaviour and an external Google Street View action.
// Production should move to managed map/geocoding providers with explicit SLA,
// caching, privacy, licensing and quota policies.

(() => {
  if (typeof L === "undefined" || typeof state === "undefined" || !state.map) return;

  const map = state.map;
  const mapEl = document.getElementById("map");
  if (!mapEl) return;

  function ensureContextStyles() {
    if (document.querySelector('link[data-wb-map-context]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "./map-context.css";
    link.dataset.wbMapContext = "true";
    document.head.appendChild(link);
  }

  ensureContextStyles();

  map.eachLayer(layer => {
    if (layer instanceof L.TileLayer) map.removeLayer(layer);
  });

  const OSM = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  const OSM_FALLBACK = "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png";
  const OPENTOPO = "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png";
  const ESRI_IMAGERY = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

  const layerDefinitions = {
    street: {
      label: "Street",
      url: OSM,
      fallbackUrl: OSM_FALLBACK,
      className: "wb-map-street",
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    },
    terrain: {
      label: "Terrain",
      url: OPENTOPO,
      fallbackUrl: OSM,
      className: "wb-map-terrain",
      maxZoom: 17,
      attribution: 'Map data &copy; OpenStreetMap contributors, SRTM | Map style &copy; OpenTopoMap'
    },
    satellite: {
      label: "Satellite",
      url: ESRI_IMAGERY,
      fallbackUrl: OSM,
      className: "wb-map-satellite",
      maxZoom: 19,
      attribution: "Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community"
    }
  };

  let activeLayerKey = "street";
  let activeTileLayer = null;
  let parkingContextLayer = null;
  let destinationContextLayer = null;
  let coverageTintLayer = null;
  let repairTimer = null;
  let resizeTimer = null;

  function tileUrl(template, coords) {
    if (!template || !coords) return null;
    const subdomain = ["a", "b", "c"][Math.abs(coords.x + coords.y) % 3];
    return template
      .replace("{s}", subdomain)
      .replace("{z}", String(coords.z))
      .replace("{x}", String(coords.x))
      .replace("{y}", String(coords.y));
  }

  function buildTileLayer(definition) {
    const layer = L.tileLayer(definition.url, {
      maxZoom: definition.maxZoom || 19,
      maxNativeZoom: definition.maxZoom || 19,
      detectRetina: false,
      updateWhenIdle: false,
      updateWhenZooming: false,
      keepBuffer: 4,
      attribution: definition.attribution
    });

    layer.on("loading", () => mapEl.classList.add("wb-map-repairing"));
    layer.on("load", () => mapEl.classList.remove("wb-map-repairing"));
    layer.on("tileerror", event => {
      const tile = event.tile;
      if (!tile || tile.dataset.wbFallbackAttempted === "true") return;
      const fallback = tileUrl(definition.fallbackUrl, event.coords);
      if (!fallback) return;
      tile.dataset.wbFallbackAttempted = "true";
      tile.src = fallback;
    });

    return layer;
  }

  function applyMapTheme(key) {
    Object.values(layerDefinitions).forEach(definition => mapEl.classList.remove(definition.className));
    mapEl.classList.add(layerDefinitions[key].className);
  }

  function activateLayer(key) {
    if (!layerDefinitions[key]) return;
    if (activeTileLayer) map.removeLayer(activeTileLayer);

    activeLayerKey = key;
    activeTileLayer = buildTileLayer(layerDefinitions[key]).addTo(map);
    activeTileLayer.bringToBack();
    applyMapTheme(key);

    document.querySelectorAll(".wb-map-layer-button").forEach(button => {
      const active = button.dataset.layer === key;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    scheduleMapRepair();
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
    if (coverageTintLayer) {
      map.removeLayer(coverageTintLayer);
      coverageTintLayer = null;
    }
  }

  function renderCoverageTint() {
    clearCoverageTint();
    if (typeof coverageAreas === "undefined") return;

    coverageTintLayer = L.layerGroup().addTo(map);
    const colours = {
      live: "#52D98D",
      next: "#C8F56B",
      planned: "#F1C46B"
    };

    coverageAreas.forEach(area => {
      const colour = colours[area.status] || "#8FA39A";
      const radius = area.status === "live" ? 26000 : 18000;
      L.circle([area.lat, area.lng], {
        radius,
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

  function repairMap() {
    if (!map || !mapEl.isConnected) return;
    window.requestAnimationFrame(() => {
      map.invalidateSize({ pan: false, animate: false, debounceMoveend: true });
    });
  }

  function scheduleMapRepair() {
    if (repairTimer) window.clearTimeout(repairTimer);
    repairMap();
    [90, 260, 700].forEach(delay => window.setTimeout(repairMap, delay));
    repairTimer = window.setTimeout(() => mapEl.classList.remove("wb-map-repairing"), 1400);
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
      map.flyTo([destination.lat, destination.lng], 15, { duration: 0.5 });
      return;
    }

    if (typeof parkingData === "undefined" || !parkingData.length) return;
    const points = parkingData.map(item => [item.lat, item.lng]);
    if (destination) points.push([destination.lat, destination.lng]);
    map.fitBounds(L.latLngBounds(points), { padding: [32, 32], maxZoom: 15, animate: true });
  }

  function focusSelectedParking() {
    const selected = selectedParking();
    if (!selected) return;
    clearCoverageTint();
    map.flyTo([selected.lat, selected.lng], 16, { duration: 0.4 });
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
    new MutationObserver(normalizeIrelandCoverageLabel).observe(statusTitle, { childList: true, characterData: true, subtree: true });
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
          map.fitBounds(IRELAND_BOUNDS, { padding: [22, 22], maxZoom: 7, animate: true });
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

  createToolbar();
  createStateLegend();
  refreshParkingContext();
  refreshDestinationContext();
  activateLayer("street");
  normalizeIrelandCoverageLabel();
  scheduleMapRepair();
  loadGuidanceIntelligenceLayer();
})();
