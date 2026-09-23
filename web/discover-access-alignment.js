// WHITEBLOCK Discover/access taxonomy bridge.
// Discover predates the shared access intelligence layer. This bridge keeps its
// inventory filters and cards aligned with WBParkingAccess without duplicating
// eligibility semantics or changing source evidence.

(() => {
  if (typeof state === "undefined" || !window.WBParkingAccess) return;

  const accessApi = window.WBParkingAccess;
  let observer = null;
  let rerendering = false;

  function accessFilterGroup() {
    return document.querySelector('[data-discover-filter-group="access"]');
  }

  function alignFilterLabels() {
    const group = accessFilterGroup();
    if (!group) return;

    const customer = group.querySelector('[data-discover-filter="customer"]');
    if (customer) customer.textContent = "Customer / destination";

    // Discover previously exposed Permit as a separate class. Permit belongs to
    // the shared Restricted group; reuse the existing control for Permissive so
    // the five product surfaces share one taxonomy.
    const permit = group.querySelector('[data-discover-filter="permit"]');
    if (permit) {
      permit.dataset.discoverFilter = "conditional";
      permit.textContent = "Permissive";
    }

    const restricted = group.querySelector('[data-discover-filter="restricted"]');
    if (restricted) restricted.textContent = "Private / permit";
  }

  function alignInventory() {
    if (!Array.isArray(state.discoveryInventory)) return false;
    let changed = false;
    state.discoveryInventory.forEach(item => {
      const next = accessApi.classify(item);
      if (item.discoverAccessState !== next) {
        item.discoverAccessState = next;
        changed = true;
      }
    });
    return changed;
  }

  function maxStayLabel(item) {
    const raw = item?.maxStayMinutes ?? item?.maximumStayMinutes ?? item?.maximum_stay_minutes;
    const value = Number(raw);
    return Number.isFinite(value) ? `${Math.round(value).toLocaleString("en-IE")} min max` : null;
  }

  function annotateCards() {
    if (!Array.isArray(state.discoveryInventory)) return;
    const byId = new Map(state.discoveryInventory.map(item => [String(item.id || ""), item]));
    document.querySelectorAll(".discover-location-card[data-discover-parking-id]").forEach(card => {
      const item = byId.get(String(card.dataset.discoverParkingId || ""));
      if (!item) return;
      const info = accessApi.describe(item);
      card.dataset.accessGroup = info.group;
      const line = card.querySelector(".discover-rule-line");
      if (!line) return;
      const copy = [
        info.label,
        maxStayLabel(item),
        item.openingHoursRaw || item.opening_hours_raw ? "Hours published" : null
      ].filter(Boolean).join(" · ");
      if (line.textContent !== copy) line.textContent = copy;
    });
  }

  function rerenderDiscoverIfPossible() {
    if (rerendering) return;
    const group = accessFilterGroup();
    const active = group?.querySelector("[data-discover-filter].active");
    if (!active) {
      annotateCards();
      return;
    }
    rerendering = true;
    active.click();
    window.setTimeout(() => {
      rerendering = false;
      annotateCards();
    }, 0);
  }

  function align({ rerender = false } = {}) {
    alignFilterLabels();
    const changed = alignInventory();
    if (rerender && changed) rerenderDiscoverIfPossible();
    else annotateCards();
  }

  function observeDiscoverList() {
    const list = document.getElementById("discover-location-list");
    if (!list || observer) return;
    observer = new MutationObserver(() => annotateCards());
    observer.observe(list, { childList: true, subtree: true });
  }

  function scheduleAlignment(rerender = true) {
    window.setTimeout(() => {
      observeDiscoverList();
      align({ rerender });
    }, 0);
  }

  document.addEventListener("whiteblock:region-inventory-ready", () => scheduleAlignment(true));
  document.addEventListener("whiteblock:data-ready", () => scheduleAlignment(true));
  document.addEventListener("click", event => {
    if (event.target.closest('[data-discover-filter-group="access"] [data-discover-filter]')) {
      window.setTimeout(() => align({ rerender: false }), 0);
    }
  });

  window.addEventListener("DOMContentLoaded", () => scheduleAlignment(true));
})();
