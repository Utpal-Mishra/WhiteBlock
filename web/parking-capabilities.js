// WHITEBLOCK parking capability badges.
// Keeps EV/accessibility/free/weekend context visible in normal recommendations,
// not only when a filter is selected.
(() => {
  const install = () => {
    if (window.__WHITEBLOCK_CAPABILITY_BADGES__ || typeof parkingCard !== "function") return;
    window.__WHITEBLOCK_CAPABILITY_BADGES__ = true;

    const baseParkingCard = parkingCard;
    parkingCard = function parkingCardWithCapabilities(item, index, options = {}) {
      let html = baseParkingCard(item, index, options);
      const chips = [];
      const pricing = String(item.pricingRaw || item.pricing_raw || "");

      if (item.accessible === true) {
        chips.push('<span class="parking-capability-chip accessible">♿ Accessible</span>');
      }
      if (item.ev === true) {
        chips.push('<span class="parking-capability-chip ev">⚡ EV charging</span>');
      }
      if (/complimentary guest parking/i.test(pricing)) {
        chips.push('<span class="parking-capability-chip free">Free guest parking</span>');
      }
      if (/no council traffic-warden parking enforcement on saturday|no kcc enforcement on saturday/i.test(pricing)) {
        chips.push('<span class="parking-capability-chip weekend">Weekend rule</span>');
      }

      if (!chips.length) return html;
      const row = `<div class="parking-capability-row">${chips.join("")}</div>`;
      html = html.replace('<div class="parking-meta">', `${row}<div class="parking-meta">`);
      return html;
    };

    if (typeof renderParkingList === "function") renderParkingList();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => window.setTimeout(install, 0), { once: true });
  } else {
    window.setTimeout(install, 0);
  }
})();
