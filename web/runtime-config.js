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

function loadWhiteblockMapEngineV2() {
  if (document.querySelector('script[data-whiteblock-map-engine-v2]')) return;
  const script = document.createElement('script');
  script.src = './map-engine-v2.js?v=20260921-2';
  script.async = false;
  script.dataset.whiteblockMapEngineV2 = 'true';
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

// Map engine v2 takes ownership only after the static Leaflet/MapLibre setup and
// Parking Layout control have been created. It then removes legacy raster basemaps
// and keeps every basemap below the parking/destination overlay panes.
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
