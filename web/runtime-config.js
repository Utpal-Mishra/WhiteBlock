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
  script.src = './parking-gl-overlay.js?v=20260921-3';
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
  script.src = './map-engine-v2.js?v=20260921-3';
  script.async = false;
  script.dataset.whiteblockMapEngineV2 = 'true';
  script.addEventListener('load', loadWhiteblockParkingGeometry, { once: true });
  document.body.appendChild(script);
}

function loadWhiteblockInventoryMapLayer() {
  if (document.querySelector('script[data-whiteblock-inventory-map]')) return;
  const script = document.createElement('script');
  script.src = './inventory-map-layer.js?v=20260923-dublin1';
  script.defer = true;
  script.dataset.whiteblockInventoryMap = 'true';
  document.body.appendChild(script);
}

function loadWhiteblockInventoryCoverage() {
  if (!document.querySelector('script[data-whiteblock-inventory-coverage]')) {
    const script = document.createElement('script');
    script.src = './inventory-coverage.js?v=20260922-dublin3';
    script.defer = true;
    script.dataset.whiteblockInventoryCoverage = 'true';
    document.body.appendChild(script);
  }
  loadWhiteblockInventoryMapLayer();
}

function loadWhiteblockDestinationParkingFocus() {
  const existing = document.querySelector('script[data-whiteblock-destination-parking-focus]');
  if (existing) {
    loadWhiteblockInventoryCoverage();
    return;
  }
  const script = document.createElement('script');
  script.src = './destination-parking-focus.js?v=20260923-1';
  script.defer = true;
  script.dataset.whiteblockDestinationParkingFocus = 'true';
  script.addEventListener('load', loadWhiteblockInventoryCoverage, { once: true });
  document.body.appendChild(script);
}

function loadWhiteblockDublinVenueKnowledge() {
  const existing = document.querySelector('script[data-whiteblock-dublin-venue-knowledge]');
  if (existing) {
    if (typeof state !== 'undefined' && state.dublinVenueKnowledgeStatus) loadWhiteblockDestinationParkingFocus();
    else existing.addEventListener('load', loadWhiteblockDestinationParkingFocus, { once: true });
    return;
  }
  const script = document.createElement('script');
  script.src = './dublin-venue-knowledge.js?v=20260923-1';
  script.defer = true;
  script.dataset.whiteblockDublinVenueKnowledge = 'true';
  script.addEventListener('load', loadWhiteblockDestinationParkingFocus, { once: true });
  document.body.appendChild(script);
}

function loadWhiteblockDublinRestrictionIntegration() {
  const existing = document.querySelector('script[data-whiteblock-dublin-restriction-integration]');
  if (existing) {
    if (typeof state !== 'undefined' && state.dublinRestrictionAuditStatus) loadWhiteblockDublinVenueKnowledge();
    else existing.addEventListener('load', loadWhiteblockDublinVenueKnowledge, { once: true });
    return;
  }
  const script = document.createElement('script');
  script.src = './dublin-restriction-integration.js?v=20260922-1';
  script.defer = true;
  script.dataset.whiteblockDublinRestrictionIntegration = 'true';
  script.addEventListener('load', loadWhiteblockDublinVenueKnowledge, { once: true });
  document.body.appendChild(script);
}

function loadWhiteblockDublinSettlementIntegration() {
  const existing = document.querySelector('script[data-whiteblock-dublin-settlement-integration]');
  if (existing) {
    if (typeof state !== 'undefined' && state.dublinSettlementAuditStatus) loadWhiteblockDublinRestrictionIntegration();
    else existing.addEventListener('load', loadWhiteblockDublinRestrictionIntegration, { once: true });
    return;
  }
  const script = document.createElement('script');
  script.src = './dublin-settlement-integration.js?v=20260922-1';
  script.defer = true;
  script.dataset.whiteblockDublinSettlementIntegration = 'true';
  script.addEventListener('load', loadWhiteblockDublinRestrictionIntegration, { once: true });
  document.body.appendChild(script);
}

function loadWhiteblockDublinNetwork() {
  const existing = document.querySelector('script[data-whiteblock-dublin-network]');
  if (existing) {
    loadWhiteblockDublinSettlementIntegration();
    return;
  }
  const script = document.createElement('script');
  script.src = './dublin-network.js?v=20260922-2';
  script.defer = true;
  script.dataset.whiteblockDublinNetwork = 'true';
  script.addEventListener('load', loadWhiteblockDublinSettlementIntegration, { once: true });
  document.body.appendChild(script);
}

function loadWhiteblockKildareAttributes() {
  const existing = document.querySelector('script[data-whiteblock-kildare-attributes]');
  if (existing) {
    loadWhiteblockDublinNetwork();
    return;
  }
  const script = document.createElement('script');
  script.src = './kildare-asset-enrichment.js?v=20260919-1';
  script.defer = true;
  script.dataset.whiteblockKildareAttributes = 'true';
  script.addEventListener('load', loadWhiteblockDublinNetwork, { once: true });
  document.body.appendChild(script);
}

function loadWhiteblockRegionNetwork() {
  const existing = document.querySelector('script[data-whiteblock-region-network]');
  if (existing) {
    if (typeof state !== 'undefined' && state.regionInventories) loadWhiteblockKildareAttributes();
    else existing.addEventListener('load', loadWhiteblockKildareAttributes, { once: true });
    return;
  }
  const script = document.createElement('script');
  script.src = './region-network.js?v=20260922-kildarecounty1';
  script.defer = true;
  script.dataset.whiteblockRegionNetwork = 'true';
  script.addEventListener('load', loadWhiteblockKildareAttributes, { once: true });
  document.body.appendChild(script);
}

function loadWhiteblockCorkCountyNetwork() {
  const existing = document.querySelector('script[data-whiteblock-cork-county-network]');
  if (existing) {
    if (window.__WHITEBLOCK_CORK_COUNTY_NETWORK__) loadWhiteblockRegionNetwork();
    else existing.addEventListener('load', loadWhiteblockRegionNetwork, { once: true });
    return;
  }
  const script = document.createElement('script');
  script.src = './cork-county-network.js?v=20260921-1';
  script.defer = true;
  script.dataset.whiteblockCorkCountyNetwork = 'true';
  script.addEventListener('load', loadWhiteblockRegionNetwork, { once: true });
  document.body.appendChild(script);
}

window.addEventListener('DOMContentLoaded', () => {
  loadWhiteblockMapEngineV2();
});

// Cork County extends the legacy Cork coverage gate before region-network.js
// captures it. This lets the existing regional adapter treat all County Cork
// destinations as connected while retaining Cork City live-data semantics.
window.addEventListener('DOMContentLoaded', () => {
  loadWhiteblockCorkCountyNetwork();
});