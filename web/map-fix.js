// WHITEBLOCK prototype map adapter.
// Provides keyless street/satellite basemaps, mobile resize repair, coloured parking context,
// and an external Street View action. Production should use managed map/geocoding providers
// with explicit SLA, caching, privacy and quota policies.

(() => {
  if (typeof L === "undefined" || typeof state === "undefined" || !state.map) return;

  const map = state.map;
  const mapEl = document.getElementById("map");
  if (!mapEl) return;

  // The original app initialises a temporary basemap. Remove raster tile layers only;
  // WHITEBLOCK markers, destination markers and coverage layers stay intact.
  map.eachLayer(layer => {
    if (layer instanceof L.TileLayer) map.removeLayer(layer);
  });

  const tilePane = map.getPane("tilePane");
  if (tilePane) tilePane.style.filter = "";

  const ESRI_STREET = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";
  const ESRI_IMAGERY = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

  const layerDefinitions = {
    dark: {
      label: "Dark",
      url: ESRI_STREET,
      className: "wb-map-dark",
      attribution: "Tiles &copy; Esri"
    },
    street: {
      label: "Street",
      url: ESRI_STREET,
      className: "wb-map-street",
      attribution: "Tiles &copy; Esri"
    },
    satellite: {
      label: "Satellite",
      url: ESRI_IMAGERY,
      className: "wb-map-satellite",
      attribution: "Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community"
    }
  };

  let activeLayerKey = "dark";
  let activeTileLayer = null;
  let parkingContextLayer = null;
  let destinationContextLayer = null;
  let repairTimer = null;

  function buildTileLayer(definition) {
    const layer = L.tileLayer(definition.url, {
      maxZoom: 19,
      maxNativeZoom: 19,
      detectRetina: false,
      updateWhenIdle: false,
      updateWhenZooming: true,
      updateInterval: 120,
      keepBuffer: 5,
      crossOrigin: true,
      attribution: definition.attribution
    });

    layer.on("loading", () => mapEl.classList.add("wb-map-repairing"));
    layer.on("load", () => mapEl.classList.remove("wb-map-repairing"));
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
    const ratio = item.capacity ? item.available / item.capacity : 0;
    if (ratio >= 0.25) return "#52D98D";
    if (ratio >= 0.12) return "#C8F56B";
    return "#F1C46B";
  }

  function refreshParkingContext() {
    if (parkingContextLayer) map.removeLayer(parkingContextLayer);
    parkingContextLayer = L.layerGroup().addTo(map);

    if (typeof parkingData === "undefined") return;
    parkingData.forEach(item => {
      const colour = statusColour(item);
      L.circle([item.lat, item.lng], {
        radius: 180,
        color: colour,
        weight: 1,
        opacity: 0.55,
        fillColor: colour,
        fillOpacity: 0.10,
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
      weight: 1.2,
      opacity: 0.65,
      fillColor: "#78E6AA",
      fillOpacity: 0.035,
      interactive: false
    }).addTo(destinationContextLayer);
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

    if (selected && inPilot) {
      return { lat: selected.lat, lng: selected.lng, label: selected.name };
    }
    if (destination) {
      return { lat: destination.lat, lng: destination.lng, label: destination.primary || destination.label || "Destination" };
    }
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
    streetButton.title = "Open Google Street View near the selected location";
    streetButton.addEventListener("click", event => {
      event.stopPropagation();
      openStreetView();
    });
    toolbar.appendChild(streetButton);
    mapEl.appendChild(toolbar);

    // Keep taps/swipes on map controls from becoming map pan/zoom gestures.
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
    map.invalidateSize({ pan: false, debounceMoveend: true });
    if (activeTileLayer && typeof activeTileLayer.redraw === "function") activeTileLayer.redraw();
  }

  function scheduleMapRepair() {
    if (repairTimer) window.clearTimeout(repairTimer);
    repairMap();
    [90, 260, 650].forEach(delay => window.setTimeout(repairMap, delay));
    repairTimer = window.setTimeout(() => mapEl.classList.remove("wb-map-repairing"), 1000);
  }

  function fitRecommendationContext() {
    const destination = state.destination || null;
    const inPilot = destination && typeof isInCorkPilot === "function"
      ? isInCorkPilot(destination.lat, destination.lng)
      : true;

    if (destination && !inPilot) {
      map.flyTo([destination.lat, destination.lng], 15, { duration: 0.55 });
      return;
    }

    if (typeof parkingData === "undefined" || !parkingData.length) return;
    const points = parkingData.map(item => [item.lat, item.lng]);
    if (destination) points.push([destination.lat, destination.lng]);
    map.fitBounds(L.latLngBounds(points), { padding: [34, 34], maxZoom: 15, animate: true });
  }

  function focusSelectedParking() {
    const selected = selectedParking();
    if (!selected) return;
    map.flyTo([selected.lat, selected.lng], 17, { duration: 0.45 });
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
    if (parkingCard) window.setTimeout(focusSelectedParking, 60);

    if (event.target.closest?.("#search-button") || event.target.closest?.("#destination-suggestions")) {
      window.setTimeout(() => {
        refreshDestinationContext();
        fitRecommendationContext();
        scheduleMapRepair();
      }, 620);
    }

    if (event.target.closest?.("#ireland-overview-button")) {
      window.setTimeout(() => {
        if (typeof IRELAND_BOUNDS !== "undefined") {
          map.fitBounds(IRELAND_BOUNDS, { padding: [18, 18], maxZoom: 7, animate: true });
        }
        normalizeIrelandCoverageLabel();
        scheduleMapRepair();
      }, 40);
    }
  });

  document.getElementById("destination")?.addEventListener("change", () => {
    window.setTimeout(() => {
      refreshDestinationContext();
      fitRecommendationContext();
      scheduleMapRepair();
    }, 120);
  });

  window.addEventListener("resize", scheduleMapRepair, { passive: true });
  window.addEventListener("orientationchange", () => window.setTimeout(scheduleMapRepair, 180), { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) window.setTimeout(scheduleMapRepair, 100);
  });

  if (typeof ResizeObserver !== "undefined") {
    const resizeObserver = new ResizeObserver(() => scheduleMapRepair());
    resizeObserver.observe(mapEl);
  }

  // Improve mobile tile fill/repaint behaviour.
  map.options.zoomAnimation = false;
  map.options.fadeAnimation = false;

  createToolbar();
  createStateLegend();
  refreshParkingContext();
  refreshDestinationContext();
  activateLayer("dark");
  normalizeIrelandCoverageLabel();
  scheduleMapRepair();
  loadGuidanceIntelligenceLayer();
})();
