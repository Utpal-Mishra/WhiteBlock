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

function loadWhiteblockInventoryCoverage() {
  if (document.querySelector('script[data-whiteblock-inventory-coverage]')) return;
  const script = document.createElement('script');
  script.src = './inventory-coverage.js?v=20260919-kildare1';
  script.defer = true;
  script.dataset.whiteblockInventoryCoverage = 'true';
  document.body.appendChild(script);
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

// Multi-region parking inventory is loaded after the base application has defined
// its Cork data contract. Kildare attribute enrichment restores access/type/EV/
// accessibility fields from the evidence snapshot, then Inventory Coverage reads
// the complete regional inventories.
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
