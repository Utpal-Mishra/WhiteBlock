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
})();

function loadWhiteblockInventoryCoverage() {
  if (document.querySelector('script[data-whiteblock-inventory-coverage]')) return;
  const script = document.createElement('script');
  script.src = './inventory-coverage.js?v=20260919-kildare1';
  script.defer = true;
  script.dataset.whiteblockInventoryCoverage = 'true';
  document.body.appendChild(script);
}

// Multi-region parking inventory is loaded after the base application has defined
// its Cork data contract. Inventory Coverage then reads both Cork and Kildare
// regional inventories without changing the recommendation truth model.
window.addEventListener('DOMContentLoaded', () => {
  const existing = document.querySelector('script[data-whiteblock-region-network]');
  if (existing) {
    if (typeof state !== 'undefined' && state.regionInventories) loadWhiteblockInventoryCoverage();
    else existing.addEventListener('load', loadWhiteblockInventoryCoverage, { once: true });
    return;
  }

  const script = document.createElement('script');
  script.src = './region-network.js?v=20260919-kildare1';
  script.defer = true;
  script.dataset.whiteblockRegionNetwork = 'true';
  script.addEventListener('load', loadWhiteblockInventoryCoverage, { once: true });
  document.body.appendChild(script);
});
