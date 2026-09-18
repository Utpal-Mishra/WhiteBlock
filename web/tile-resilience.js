// WHITEBLOCK resilient map tile delivery.
// This adapter is intentionally loaded after the main Leaflet map setup.
// It replaces the default Street layer with a lower-churn provider strategy,
// throttles repeated map invalidation on mobile, and retries failed tiles across
// independent providers before allowing an empty map square to remain.

(() => {
  if (typeof L === "undefined" || typeof state === "undefined" || !state.map) return;
  if (window.__WHITEBLOCK_TILE_RESILIENCE__) return;
  window.__WHITEBLOCK_TILE_RESILIENCE__ = true;

  const map = state.map;
  const mapEl = document.getElementById("map");
  if (!mapEl) return;

  const ESRI_STREET = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";
  const CARTO_LIGHT = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png";
  const OSM = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  const ATTRIBUTION = 'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · tiles &copy; Esri / CARTO';

  let managedStreetLayer = null;
  let replacingStreetLayer = false;
  let lastInvalidateAt = 0;
  let finalFailures = 0;

  function ensureRenderingStyles() {
    if (document.getElementById("wb-tile-resilience-style")) return;
    const style = document.createElement("style");
    style.id = "wb-tile-resilience-style";
    style.textContent = `
      #map .leaflet-tile {
        -webkit-backface-visibility: visible !important;
        backface-visibility: visible !important;
        image-rendering: auto !important;
      }
      #map .leaflet-tile-container {
        will-change: auto !important;
      }
    `;
    document.head.appendChild(style);
  }

  function isStreetSource(url) {
    const value = String(url || "");
    return value.includes("tile.openstreetmap.org") ||
      value.includes("World_Street_Map") ||
      value.includes("basemaps.cartocdn.com/light_all");
  }

  function isOriginalStreetSource(url) {
    return String(url || "").includes("tile.openstreetmap.org");
  }

  function tileUrl(template, coords) {
    if (!template || !coords) return null;
    const subdomains = template.includes("cartocdn.com") ? ["a", "b", "c", "d"] : ["a", "b", "c"];
    const subdomain = subdomains[Math.abs(coords.x + coords.y) % subdomains.length];
    return template
      .replace("{s}", subdomain)
      .replace("{z}", String(coords.z))
      .replace("{x}", String(coords.x))
      .replace("{y}", String(coords.y));
  }

  function hardenTileLayer(layer) {
    if (!layer || layer.__whiteblockHardened) return layer;
    layer.__whiteblockHardened = true;
    layer.options.detectRetina = false;
    layer.options.updateWhenIdle = true;
    layer.options.updateWhenZooming = false;
    layer.options.keepBuffer = 1;
    return layer;
  }

  function markMapRecovered() {
    mapEl.classList.remove("wb-map-repairing");
    finalFailures = 0;
  }

  function buildManagedStreetLayer() {
    const layer = L.tileLayer(ESRI_STREET, {
      maxZoom: 19,
      maxNativeZoom: 19,
      tileSize: 256,
      detectRetina: false,
      updateWhenIdle: true,
      updateWhenZooming: false,
      keepBuffer: 1,
      crossOrigin: true,
      attribution: ATTRIBUTION
    });

    layer.__whiteblockManagedStreet = true;
    layer.__whiteblockHardened = true;

    layer.on("loading", () => mapEl.classList.add("wb-map-repairing"));
    layer.on("load", markMapRecovered);
    layer.on("tileload", markMapRecovered);
    layer.on("tileerror", event => {
      const tile = event.tile;
      if (!tile || !event.coords) return;

      const attempt = Number(tile.dataset.wbRecoveryAttempt || "0");
      const fallbacks = [CARTO_LIGHT, OSM, ESRI_STREET];

      if (attempt >= fallbacks.length) {
        finalFailures += 1;
        tile.classList.add("wb-tile-final-failure");
        if (finalFailures >= 2 && typeof setMapStatus === "function") {
          setMapStatus("Map connection degraded", "Retrying missing street tiles automatically");
        }
        return;
      }

      const replacement = tileUrl(fallbacks[attempt], event.coords);
      if (!replacement) return;
      tile.dataset.wbRecoveryAttempt = String(attempt + 1);

      const delay = 120 * (attempt + 1);
      window.setTimeout(() => {
        if (tile.isConnected) tile.src = replacement;
      }, delay);
    });

    return layer;
  }

  function installManagedStreetLayer() {
    if (replacingStreetLayer) return;
    replacingStreetLayer = true;

    try {
      map.eachLayer(layer => {
        if (!(layer instanceof L.TileLayer)) return;
        if (layer === managedStreetLayer) return;
        if (isOriginalStreetSource(layer._url)) map.removeLayer(layer);
      });

      if (managedStreetLayer && map.hasLayer(managedStreetLayer)) {
        hardenTileLayer(managedStreetLayer);
        managedStreetLayer.bringToBack();
        return;
      }

      managedStreetLayer = buildManagedStreetLayer();
      managedStreetLayer.addTo(map);
      managedStreetLayer.bringToBack();
    } finally {
      replacingStreetLayer = false;
    }
  }

  function removeManagedStreetLayer() {
    if (managedStreetLayer && map.hasLayer(managedStreetLayer)) {
      map.removeLayer(managedStreetLayer);
    }
  }

  function handleLayerAdded(event) {
    const layer = event.layer;
    if (!(layer instanceof L.TileLayer)) return;
    if (layer === managedStreetLayer || layer.__whiteblockManagedStreet) return;

    hardenTileLayer(layer);
    const url = String(layer._url || "");

    if (isOriginalStreetSource(url)) {
      window.setTimeout(() => {
        if (map.hasLayer(layer)) map.removeLayer(layer);
        installManagedStreetLayer();
      }, 0);
      return;
    }

    // Terrain and satellite layers are explicit user choices. Remove the managed
    // Street layer while those are active so basemaps never stack on each other.
    if (!isStreetSource(url)) removeManagedStreetLayer();
  }

  function throttleMapInvalidation() {
    const originalInvalidateSize = map.invalidateSize.bind(map);
    map.invalidateSize = function invalidateSizeResilient(options = {}) {
      const now = Date.now();
      if (now - lastInvalidateAt < 180) return this;
      lastInvalidateAt = now;
      return originalInvalidateSize({ ...options, animate: false });
    };

    const originalFitBounds = map.fitBounds.bind(map);
    map.fitBounds = function fitBoundsResilient(bounds, options = {}) {
      return originalFitBounds(bounds, { ...options, animate: false });
    };

    map.flyTo = function flyToResilient(latlng, zoom) {
      return map.setView(latlng, zoom, { animate: false });
    };
  }

  function restoreStreetAfterToolbarClick(event) {
    const button = event.target.closest?.(".wb-map-layer-button");
    if (!button || button.dataset.layer !== "street") return;
    window.setTimeout(installManagedStreetLayer, 30);
  }

  ensureRenderingStyles();
  throttleMapInvalidation();
  map.on("layeradd", handleLayerAdded);
  document.addEventListener("click", restoreStreetAfterToolbarClick);

  // Replace the existing Street layer immediately. This removes the aggressive
  // tile burst created by the original layer before the user has to interact.
  installManagedStreetLayer();

  window.addEventListener("online", () => {
    if (mapEl.classList.contains("wb-map-street")) installManagedStreetLayer();
  }, { passive: true });
})();
