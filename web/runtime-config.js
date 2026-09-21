window.WHITEBLOCK_CONFIG = window.WHITEBLOCK_CONFIG || {
  apiBaseUrl: null
};

// Product UI enhancement for ARRIVE / STAY. Loaded here so the underlying form
// contract stays unchanged for the session eligibility engine.
(() => {
  if (!document.querySelector('link[data-whiteblock-session-controls]')) {
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = './session-controls.css?v=20260917-1';
    style.dataset.whiteblockSessionControls = 'true';
    document.head.appendChild(style);
  }

  if (!document.querySelector('script[data-whiteblock-session-controls]')) {
    const script = document.createElement('script');
    script.src = './session-controls.js?v=20260917-1';
    script.async = false;
    script.dataset.whiteblockSessionControls = 'true';
    document.body.appendChild(script);
  }

  if (!document.querySelector('link[data-whiteblock-mobile-result-cards]')) {
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = './mobile-result-cards.css?v=20260919-1';
    style.dataset.whiteblockMobileResultCards = 'true';
    document.head.appendChild(style);
  }

  if (!document.querySelector('script[data-whiteblock-result-card-polish]')) {
    const script = document.createElement('script');
    script.src = './result-card-polish.js?v=20260919-1';
    script.defer = true;
    script.dataset.whiteblockResultCardPolish = 'true';
    document.body.appendChild(script);
  }
})();

function loadWhiteblockParkingGeometry() {
  if (document.querySelector('script[data-whiteblock-parking-gl-overlay]')) return;
  const script = document.createElement('script');
  // Parking geometry is rendered inside the same MapLibre canvas as the basemap.
  // This avoids Android/Chrome pane-stacking failures between Leaflet SVG layers
  // and the WebGL basemap.
  script.src = './parking-gl-overlay.js?v=20260921-2';
  script.defer = true;
  script.dataset.whiteblockParkingGlOverlay = 'true';
  document.body.appendChild(script);
}

function loadWhiteblockMapEngineV2() {
  const existing = document.querySelector('script[data-whiteblock-map-engine-v2]');
  if (existing) {
    if (window.__WHITEBLOCK_MAP_ENGINE_V3__) loadWhiteblockParkingGeometry();
    else existing.addEventListener('load', loadWhiteblockParkingGeometry, { once: true });
    return;
  }
  const script = document.createElement('script');
  // v3 implementation intentionally keeps the v2 filename so GitHub Pages and
  // existing references stay compatible. The version query prevents stale mobile
  // browsers from reusing the blank-canvas implementation.
  script.src = './map-engine-v2.js?v=20260921-3';
  script.async = false;
  script.dataset.whiteblockMapEngineV2 = 'true';
  script.addEventListener('load', loadWhiteblockParkingGeometry, { once: true });
  document.body.appendChild(script);
}

function loadWhiteblockInventoryMapLayer() {
  if (document.querySelector('script[data-whiteblock-inventory-map]')) return;
  const script = document.createElement('script');
  script.src = './inventory-map-layer.js?v=20260921-1';
  script.defer = true;
  script.dataset.whiteblockInventoryMap = 'true';
  document.body.appendChild(script);
}

function loadWhiteblockInventoryCoverage() {
  if (!document.querySelector('script[data-whiteblock-inventory-coverage]')) {
    const script = document.createElement('script');
    script.src = './inventory-coverage.js?v=20260919-kildare1';
    script.defer = true;
    script.dataset.whiteblockInventoryCoverage = 'true';
    document.body.appendChild(script);
  }
  loadWhiteblockInventoryMapLayer();
}

function loadWhiteblockKildareAttributes() {
  const existing = document.querySelector('script[data-whiteblock-kildare-attributes]');
  if (existing) {
    loadWhiteblockInventoryCoverage();
    return;
  }
  const script = document.createElement('script');
  script.src = './kildare-asset-enrichment.js?v=20260919-1';
  script.defer = true;
  script.dataset.whiteblockKildareAttributes = 'true';
  script.addEventListener('load', loadWhiteblockInventoryCoverage, { once: true });
  document.body.appendChild(script);
}

// The map engine is loaded after Leaflet/MapLibre and the base application have
// initialised. Parking geometry then attaches directly to the MapLibre style so
// polygons and ranked labels cannot disappear behind the WebGL canvas.
window.addEventListener('DOMContentLoaded', () => {
  loadWhiteblockMapEngineV2();
});

// Multi-region parking inventory is loaded after the base application has defined
// its Cork data contract. Kildare attribute enrichment restores access/type/EV/
// accessibility fields from the evidence snapshot. Inventory Coverage and the
// clustered map layer then consume the complete connected inventory.
window.addEventListener('DOMContentLoaded', () => {
  const existing = document.querySelector('script[data-whiteblock-region-network]');
  if (existing) {
    if (typeof state !== 'undefined' && state.regionInventories) loadWhiteblockKildareAttributes();
    else existing.addEventListener('load', loadWhiteblockKildareAttributes, { once: true });
    return;
  }

  const script = document.createElement('script');
  script.src = './region-network.js?v=20260919-kildare1';
  script.defer = true;
  script.dataset.whiteblockRegionNetwork = 'true';
  script.addEventListener('load', loadWhiteblockKildareAttributes, { once: true });
  document.body.appendChild(script);
});
