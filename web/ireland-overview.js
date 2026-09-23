// WHITEBLOCK Ireland-first landing and connected-region focus layer.
//
// The default product state is national coverage awareness, not an implicit Cork
// destination.  Regional inventory totals are evidence summaries: live
// availability is summed only where a source actually reports it.

(() => {
  if (typeof state === "undefined") return;

  const IRELAND_VIEW_BOUNDS = [[51.25, -10.85], [55.45, -5.55]];
  const CONNECTED_REGIONS = {
    cork: {
      label: "Cork",
      detail: "Cork City + County Cork",
      center: [51.90, -8.48],
      zoom: 8.4,
      mode: "City live + county mapped"
    },
    kildare: {
      label: "Kildare",
      detail: "County Kildare",
      center: [53.20, -6.78],
      zoom: 9.2,
      mode: "Exact-county mapped network"
    },
    dublin: {
      label: "Dublin",
      detail: "Dublin region",
      center: [53.35, -6.26],
      zoom: 9.2,
      mode: "Four-authority exact-boundary network"
    }
  };

  state.regionInventories = state.regionInventories || {};
  state.regionSnapshots = state.regionSnapshots || {};
  state.overviewMode = true;
  state.regionFocus = null;
  state.irelandOverviewLayer = null;

  const baseRenderParkingList = typeof renderParkingList === "function" ? renderParkingList : null;
  const baseSelectAddressSuggestion = typeof selectAddressSuggestion === "function" ? selectAddressSuggestion : null;

  function numeric(value) {
    if (value == null || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function formatInteger(value) {
    const number = numeric(value);
    return number == null ? "—" : Math.round(number).toLocaleString("en-IE");
  }

  function inventoryFor(key) {
    const inventory = state.regionInventories?.[key];
    if (Array.isArray(inventory) && inventory.length) return inventory;
    if (key === "cork" && Array.isArray(parkingData) && parkingData.length && String(state.activeRegion || "cork") === "cork") {
      return parkingData;
    }
    return [];
  }

  function snapshotFor(key) {
    if (key === "cork") return state.regionSnapshots?.corkCounty || state.regionSnapshots?.cork || null;
    return state.regionSnapshots?.[key] || null;
  }

  function regionStats(key) {
    const inventory = inventoryFor(key);
    let capacity = 0;
    let capacityAssets = 0;
    let available = 0;
    let availableAssets = 0;
    let unknownAccess = 0;

    inventory.forEach(item => {
      const cap = numeric(item.capacity);
      if (cap != null && cap >= 0) {
        capacity += cap;
        capacityAssets += 1;
      }
      const free = numeric(item.available);
      if (free != null && free >= 0) {
        available += free;
        availableAssets += 1;
      }
      const access = String(item.accessType || item.access_type || "unknown").toLowerCase();
      if (["unknown", "designated", ""].includes(access)) unknownAccess += 1;
    });

    return {
      locations: inventory.length,
      capacity,
      capacityAssets,
      available: availableAssets ? available : null,
      availableAssets,
      unknownAccess,
      loaded: inventory.length > 0
    };
  }

  function nationalStats() {
    const keys = Object.keys(CONNECTED_REGIONS);
    const perRegion = Object.fromEntries(keys.map(key => [key, regionStats(key)]));
    return {
      perRegion,
      loadedRegions: keys.filter(key => perRegion[key].loaded).length,
      locations: keys.reduce((sum, key) => sum + perRegion[key].locations, 0),
      capacity: keys.reduce((sum, key) => sum + perRegion[key].capacity, 0),
      capacityAssets: keys.reduce((sum, key) => sum + perRegion[key].capacityAssets, 0),
      available: keys.reduce((sum, key) => sum + (perRegion[key].available ?? 0), 0),
      availableAssets: keys.reduce((sum, key) => sum + perRegion[key].availableAssets, 0),
      reportingRegions: keys.filter(key => perRegion[key].availableAssets > 0)
    };
  }

  function setKpiCard(key, label, value, copy) {
    const valueEl = document.getElementById(`kpi-${key}-value`);
    const copyEl = document.getElementById(`kpi-${key}-copy`);
    const card = valueEl?.closest(".kpi");
    const labelEl = card?.querySelector("span");
    if (labelEl) labelEl.textContent = label;
    if (valueEl) valueEl.textContent = value;
    if (copyEl) copyEl.textContent = copy;
  }

  function updateNationalKpis() {
    const stats = nationalStats();
    const reportingLabel = stats.reportingRegions.length
      ? `${stats.reportingRegions.map(key => CONNECTED_REGIONS[key].label).join(" + ")} live-reporting assets only`
      : "no live occupancy feeds loaded yet";

    setKpiCard("coverage", "Connected inventory", formatInteger(stats.locations), "Cork + Kildare + Dublin evidence-backed assets");
    setKpiCard("availability", "Reported available now", stats.availableAssets ? formatInteger(stats.available) : "—", reportingLabel);
    setKpiCard("confidence", "Published capacity", stats.capacityAssets ? formatInteger(stats.capacity) : "—", "known capacity only · missing capacity is not estimated");
    setKpiCard("pressure", "Connected regions", "3", `${stats.loadedRegions}/3 regional inventories loaded`);
  }

  function updateRegionKpis(key) {
    const stats = regionStats(key);
    const region = CONNECTED_REGIONS[key];
    setKpiCard("coverage", "Regional inventory", stats.loaded ? formatInteger(stats.locations) : "Loading", `${region.detail} mapped/evidence-backed assets`);
    setKpiCard("availability", "Reported available now", stats.availableAssets ? formatInteger(stats.available) : "—", stats.availableAssets ? `${formatInteger(stats.availableAssets)} assets currently report availability` : "live occupancy is not inferred where no feed is published");
    setKpiCard("confidence", "Published capacity", stats.capacityAssets ? formatInteger(stats.capacity) : "—", `${formatInteger(stats.capacityAssets)} assets publish capacity`);
    setKpiCard("pressure", "Access research", formatInteger(stats.unknownAccess), "assets whose access remains unresolved/ambiguous");
  }

  function clearDetailedMarkers() {
    if (!state.map || !state.markers) return;
    state.markers.forEach(marker => {
      try { state.map.removeLayer(marker); } catch (_) { /* no-op */ }
    });
    state.markers.clear();
  }

  function clearOverviewLayer() {
    if (state.map && state.irelandOverviewLayer) {
      try { state.map.removeLayer(state.irelandOverviewLayer); } catch (_) { /* no-op */ }
      state.irelandOverviewLayer = null;
    }
  }

  function regionNodeHtml(key, stats) {
    const region = CONNECTED_REGIONS[key];
    const count = stats.loaded ? formatInteger(stats.locations) : "…";
    return `<div class="wb-ireland-region-node"><strong>${escapeHtml(region.label)}</strong><span>${escapeHtml(count)}</span></div>`;
  }

  function renderNationalRegionNodes() {
    if (!state.map || typeof L === "undefined") return;
    clearOverviewLayer();
    state.irelandOverviewLayer = L.layerGroup().addTo(state.map);

    Object.entries(CONNECTED_REGIONS).forEach(([key, region]) => {
      const stats = regionStats(key);
      const icon = L.divIcon({
        className: "wb-ireland-region-wrapper",
        html: regionNodeHtml(key, stats),
        iconSize: [92, 52],
        iconAnchor: [46, 26]
      });
      const marker = L.marker(region.center, { icon, keyboard: true }).addTo(state.irelandOverviewLayer);
      const availabilityCopy = stats.availableAssets
        ? `${formatInteger(stats.available)} spaces currently reported free`
        : "live availability not published/inferred";
      marker.bindTooltip(`${region.detail} · ${stats.loaded ? `${formatInteger(stats.locations)} assets` : "loading inventory"} · ${availabilityCopy}`, {
        direction: "top",
        offset: [0, -24],
        className: "wb-tooltip"
      });
      marker.on("click", () => focusRegion(key));
    });
  }

  function updateSwitcher() {
    document.querySelectorAll("[data-ireland-scope]").forEach(button => {
      const scope = button.dataset.irelandScope;
      const active = state.overviewMode ? scope === "ireland" : scope === state.regionFocus;
      button.classList.toggle("active", active);
    });
  }

  function ensureRegionSwitcher() {
    if (document.getElementById("ireland-region-switcher")) return;
    const support = document.querySelector("#view-find .search-support-row");
    const target = support || document.querySelector("#view-find .quick-filters");
    if (!target) return;

    const switcher = document.createElement("div");
    switcher.id = "ireland-region-switcher";
    switcher.className = "ireland-region-switcher";
    switcher.setAttribute("aria-label", "Connected parking regions");
    switcher.innerHTML = `
      <span class="ireland-region-switcher-label">Coverage</span>
      <button type="button" class="ireland-region-button active" data-ireland-scope="ireland">Ireland</button>
      <button type="button" class="ireland-region-button" data-ireland-scope="cork">Cork</button>
      <button type="button" class="ireland-region-button" data-ireland-scope="kildare">Kildare</button>
      <button type="button" class="ireland-region-button" data-ireland-scope="dublin">Dublin</button>`;
    target.insertAdjacentElement("afterend", switcher);

    switcher.addEventListener("click", event => {
      const button = event.target.closest("[data-ireland-scope]");
      if (!button) return;
      const scope = button.dataset.irelandScope;
      if (scope === "ireland") showIrelandNetworkOverview();
      else focusRegion(scope);
    });
  }

  function updateStaticChrome() {
    const eyebrow = document.querySelector(".topbar .eyebrow");
    if (eyebrow && state.overviewMode) eyebrow.textContent = "Ireland · Connected parking intelligence";

    const pilotCard = document.querySelector(".sidebar-foot .pilot-card");
    if (pilotCard) {
      const strong = pilotCard.querySelector("strong");
      const small = pilotCard.querySelector("small");
      if (strong) strong.textContent = "Ireland Network";
      if (small) small.textContent = "Cork · Kildare · Dublin connected";
    }

    const legend = document.querySelector(".map-head .legend");
    if (legend) legend.innerHTML = '<span><i class="dot available"></i>Connected</span><span><i class="dot pressure"></i>Planned</span>';
  }

  function clearDestinationForBrowse() {
    state.destination = null;
    state.committedDestinationLabel = "";
    if (state.destinationMarker && state.map) {
      try { state.map.removeLayer(state.destinationMarker); } catch (_) { /* no-op */ }
      state.destinationMarker = null;
    }
    const input = document.getElementById("destination");
    if (input) input.value = "";
  }

  function nationalResultsHtml() {
    const stats = nationalStats();
    return Object.entries(CONNECTED_REGIONS).map(([key, region]) => {
      const item = stats.perRegion[key];
      const availability = item.availableAssets ? `${formatInteger(item.available)} reported free` : "Live availability not connected";
      return `
        <article class="surface wb-national-region-card" data-region-focus-card="${key}">
          <div class="wb-national-region-top">
            <div><p class="eyebrow">Connected region</p><h3>${escapeHtml(region.label)}</h3><small>${escapeHtml(region.detail)}</small></div>
            <span class="discover-status">${item.loaded ? "Active" : "Loading"}</span>
          </div>
          <div class="wb-national-region-stats">
            <span><small>Inventory</small><strong>${item.loaded ? formatInteger(item.locations) : "—"}</strong></span>
            <span><small>Capacity</small><strong>${item.capacityAssets ? formatInteger(item.capacity) : "—"}</strong></span>
            <span><small>Availability</small><strong>${escapeHtml(availability)}</strong></span>
          </div>
          <div class="wb-national-region-foot"><span>${escapeHtml(region.mode)}</span><button type="button" data-region-focus="${key}">Focus region →</button></div>
        </article>`;
    }).join("");
  }

  function regionBrowseHtml(key) {
    const region = CONNECTED_REGIONS[key];
    const stats = regionStats(key);
    return `
      <article class="surface wb-region-browse-message">
        <p class="eyebrow">${escapeHtml(region.label)} coverage</p>
        <h3>${stats.loaded ? `${formatInteger(stats.locations)} mapped/evidence-backed parking assets` : "Regional inventory is loading"}</h3>
        <p>You are viewing the ${escapeHtml(region.detail)} network. Search a destination above to apply walking distance, stay, access and pricing rules before recommendations are ranked.</p>
        <div class="wb-region-browse-stats">
          <span><small>Published capacity</small><strong>${stats.capacityAssets ? formatInteger(stats.capacity) : "—"}</strong></span>
          <span><small>Reported available now</small><strong>${stats.availableAssets ? formatInteger(stats.available) : "—"}</strong></span>
          <span><small>Unresolved access</small><strong>${formatInteger(stats.unknownAccess)}</strong></span>
        </div>
      </article>`;
  }

  function bindNationalResults() {
    document.querySelectorAll("[data-region-focus]").forEach(button => {
      button.addEventListener("click", () => focusRegion(button.dataset.regionFocus));
    });
  }

  function renderBrowseResults() {
    const list = document.getElementById("parking-list");
    const excluded = document.getElementById("parking-ineligible");
    const coverageMessage = document.getElementById("coverage-message");
    const count = document.querySelector(".result-count");
    if (!list) return;
    if (excluded) excluded.innerHTML = "";
    if (coverageMessage) coverageMessage.hidden = true;

    if (state.overviewMode) {
      list.innerHTML = nationalResultsHtml();
      if (count) count.textContent = "3 connected";
      bindNationalResults();
      return;
    }
    if (state.regionFocus && !state.destination) {
      list.innerHTML = regionBrowseHtml(state.regionFocus);
      if (count) count.textContent = "Choose destination";
    }
  }

  if (baseRenderParkingList) {
    renderParkingList = function renderParkingListIrelandAware(...args) {
      if (state.overviewMode || (state.regionFocus && !state.destination)) {
        renderBrowseResults();
        return;
      }
      return baseRenderParkingList(...args);
    };
  }

  if (baseSelectAddressSuggestion) {
    selectAddressSuggestion = function selectAddressSuggestionIrelandAware(item, options = {}) {
      state.overviewMode = false;
      state.regionFocus = null;
      clearOverviewLayer();
      updateSwitcher();
      return baseSelectAddressSuggestion(item, options);
    };
  }

  function showIrelandNetworkOverview({ animate = true } = {}) {
    state.overviewMode = true;
    state.regionFocus = null;
    clearDestinationForBrowse();
    clearDetailedMarkers();
    updateStaticChrome();
    updateSwitcher();
    updateNationalKpis();
    renderBrowseResults();
    renderNationalRegionNodes();

    const mapTitle = document.getElementById("map-title");
    if (mapTitle) mapTitle.textContent = "Connected parking across Ireland";
    if (typeof setMapStatus === "function") {
      const stats = nationalStats();
      setMapStatus(
        "Ireland connected coverage",
        `${formatInteger(stats.locations)} mapped/evidence-backed assets across Cork, Kildare and Dublin · availability shown only where reported`
      );
    }
    const title = document.getElementById("view-title");
    if (title) title.textContent = "Find the best place to park.";

    if (state.map) {
      if (animate && typeof state.map.flyToBounds === "function") state.map.flyToBounds(IRELAND_VIEW_BOUNDS, { padding: [24, 24], duration: 0.9 });
      else state.map.fitBounds(IRELAND_VIEW_BOUNDS, { padding: [24, 24] });
    }
  }

  function focusRegion(key) {
    const region = CONNECTED_REGIONS[key];
    if (!region || !state.map) return;
    state.overviewMode = false;
    state.regionFocus = key;
    state.activeRegion = key;
    clearDestinationForBrowse();
    clearDetailedMarkers();
    clearOverviewLayer();
    updateSwitcher();
    updateRegionKpis(key);
    renderBrowseResults();

    const eyebrow = document.querySelector(".topbar .eyebrow");
    if (eyebrow) eyebrow.textContent = `Ireland · ${region.detail} connected coverage`;
    const mapTitle = document.getElementById("map-title");
    if (mapTitle) mapTitle.textContent = `${region.detail} parking network`;
    if (typeof setMapStatus === "function") {
      const stats = regionStats(key);
      setMapStatus(
        `${region.detail} coverage`,
        `${stats.loaded ? formatInteger(stats.locations) : "Loading"} mapped/evidence-backed assets · choose a destination to rank suitable parking`
      );
    }

    const input = document.getElementById("destination");
    if (input) input.placeholder = `Search a destination in ${region.label} or anywhere in Ireland`;

    // Region-level focus deliberately does not manufacture a destination.  This
    // keeps regional inventory browsing separate from destination suitability.
    state.map.flyTo(region.center, region.zoom, { duration: 1.0 });
    if (typeof L !== "undefined") {
      state.irelandOverviewLayer = L.layerGroup().addTo(state.map);
      const stats = regionStats(key);
      const icon = L.divIcon({
        className: "wb-ireland-region-wrapper focused",
        html: regionNodeHtml(key, stats),
        iconSize: [104, 58],
        iconAnchor: [52, 29]
      });
      L.marker(region.center, { icon }).bindTooltip(`${region.detail} · region overview`, { direction: "top" }).addTo(state.irelandOverviewLayer);
    }
  }

  // Replace the legacy Cork-era Ireland overview action with the connected
  // national network view.  Existing button bindings resolve this global at click
  // time, so changing it here updates both desktop and future callers.
  showIrelandOverview = showIrelandNetworkOverview;
  window.WHITEBLOCK_IRELAND_OVERVIEW = {
    show: showIrelandNetworkOverview,
    focusRegion,
    stats: nationalStats
  };

  ensureRegionSwitcher();
  updateStaticChrome();

  // Regional adapters load asynchronously.  Refresh totals and explicitly emit a
  // common inventory-ready event when each connected inventory first appears so
  // Discover cannot remain stuck in its initial Cork-only render.
  const announced = new Set();
  let checks = 0;
  const regionalWatcher = window.setInterval(() => {
    checks += 1;
    Object.keys(CONNECTED_REGIONS).forEach(key => {
      const stats = regionStats(key);
      if (stats.loaded && !announced.has(key)) {
        announced.add(key);
        document.dispatchEvent(new CustomEvent("whiteblock:region-inventory-ready", {
          detail: { region: key, locations: stats.locations, source: "ireland-overview" }
        }));
      }
    });

    if (state.overviewMode) showIrelandNetworkOverview({ animate: false });
    else if (state.regionFocus) {
      updateRegionKpis(state.regionFocus);
      renderBrowseResults();
    }

    const resolved = [state.corkCountyNetworkStatus, state.kildareNetworkStatus, state.dublinNetworkStatus]
      .filter(value => value != null)
      .every(value => value !== "loading");
    if ((announced.size === 3 && resolved) || checks >= 120) window.clearInterval(regionalWatcher);
  }, 500);

  document.addEventListener("whiteblock:data-ready", () => {
    if (state.overviewMode) showIrelandNetworkOverview({ animate: false });
  });
  document.addEventListener("whiteblock:region-inventory-ready", () => {
    if (state.overviewMode) showIrelandNetworkOverview({ animate: false });
  });

  // The base app boots with the historical Cork default.  Replace that state once
  // all static scripts have initialized; no Cork destination is silently assumed.
  window.setTimeout(() => showIrelandNetworkOverview({ animate: false }), 0);
})();