// WHITEBLOCK unified parking-supply discovery layer.
// Discover is deliberately independent from the currently selected Find region.
// It aggregates the normalized regional inventories, deduplicates conservatively,
// and keeps candidate/inferred supply separate from mapped parking inventory.

(() => {
  if (typeof state === "undefined") return;

  const PAGE_SIZE = 100;
  const GENERIC_NAMES = new Set(["parking", "car park", "surface parking", "street side parking", "lane parking"]);
  const REGION_LABELS = { cork: "Cork", kildare: "Kildare", dublin: "Dublin" };

  state.discoveryInventory = [];
  state.discoveryVisibleLimit = PAGE_SIZE;
  state.discoveryFilters = state.discoveryFilters || {
    region: "all",
    access: "all",
    pricing: "all",
    feature: "all",
    supply: "mapped"
  };

  function numeric(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function formatInteger(value) {
    const number = numeric(value);
    return number == null ? "—" : Math.round(number).toLocaleString("en-IE");
  }

  function normalizedName(value) {
    return String(value || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function freshnessLabel(value) {
    if (!value) return "Freshness varies by source";
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return "Freshness varies by source";
    const minutes = Math.max(0, Math.round((Date.now() - dt.getTime()) / 60000));
    if (minutes < 2) return "Synced just now";
    if (minutes < 60) return `Synced ${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `Synced ${hours}h ago`;
    return `Synced ${Math.round(hours / 24)}d ago`;
  }

  function formatSource(value) {
    if (!value) return "Evidence-backed source";
    return String(value)
      .replaceAll("_", " ")
      .replace(/\b\w/g, letter => letter.toUpperCase());
  }

  function regionSnapshot(key) {
    if (key === "cork") return state.regionSnapshots?.corkCounty || state.regionSnapshots?.cork || null;
    return state.regionSnapshots?.[key] || null;
  }

  function latestSourceTime() {
    const values = ["cork", "kildare", "dublin"]
      .map(key => regionSnapshot(key))
      .flatMap(snapshot => [snapshot?.generated_at, snapshot?.source?.retrieved_at])
      .filter(Boolean)
      .map(value => new Date(value))
      .filter(value => !Number.isNaN(value.getTime()));
    if (!values.length) return null;
    return new Date(Math.max(...values.map(value => value.getTime()))).toISOString();
  }

  function supplyState(item) {
    const id = String(item.id || "").toUpperCase();
    const truth = String(item.truthState || item.truth_state || "").toLowerCase();
    const role = String(item.networkRole || item.network_role || "").toLowerCase();
    if (id.startsWith("WB-CAND-") || truth === "candidate" || truth === "inferred" || role.includes("candidate")) return "candidate";
    return "mapped";
  }

  function pricingState(item) {
    const raw = String(item.pricingRaw || item.pricing_raw || "").toLowerCase();
    if (item.price === 0 || /\b(no fee|free)\b/.test(raw)) return "free";
    if ((numeric(item.price) ?? 0) > 0 || /\b(paid|tariff|eur)\b/.test(raw) || raw.includes("€")) return "paid";
    return "unknown";
  }

  function accessState(item) {
    const value = String(item.accessType || item.access_type || "unknown").toLowerCase();
    if (["yes", "public", "permissive"].includes(value)) return "public";
    if (["customer", "customers"].includes(value)) return "customer";
    if (["private", "permit", "restricted", "no", "destination"].includes(value)) return value === "permit" ? "permit" : "restricted";
    return "unknown";
  }

  function regionSubarea(item, region) {
    return item.settlement || item.area || item.localAuthority || item.local_authority || `County ${region}`;
  }

  function enrichForDiscover(item, regionKey) {
    const region = REGION_LABELS[regionKey] || regionKey;
    return {
      ...item,
      discoverRegionKey: regionKey,
      discoverRegion: region,
      discoverSubregion: regionSubarea(item, region),
      discoverSupplyState: supplyState(item),
      discoverPricingState: pricingState(item),
      discoverAccessState: accessState(item)
    };
  }

  function conservativeSameAsset(a, b) {
    if (a.discoverRegionKey !== b.discoverRegionKey) return false;
    if (!Number.isFinite(a.lat) || !Number.isFinite(a.lng) || !Number.isFinite(b.lat) || !Number.isFinite(b.lng)) return false;
    if (typeof haversineKm !== "function" || haversineKm(a.lat, a.lng, b.lat, b.lng) > 0.04) return false;
    const an = normalizedName(a.name);
    const bn = normalizedName(b.name);
    if (!an || !bn || GENERIC_NAMES.has(an) || GENERIC_NAMES.has(bn)) return false;
    return an === bn;
  }

  function mergeUnique(target, items) {
    const ids = new Map(target.map((item, index) => [String(item.id || ""), index]).filter(([id]) => id));
    items.forEach(item => {
      const id = String(item.id || "");
      if (id && ids.has(id)) {
        const index = ids.get(id);
        target[index] = { ...target[index], ...item };
        return;
      }
      if (target.some(existing => conservativeSameAsset(existing, item))) return;
      if (id) ids.set(id, target.length);
      target.push(item);
    });
  }

  function collectRegionalInventory() {
    const output = [];
    const inventories = state.regionInventories || {};

    // Cork is intentionally taken from the merged `cork` inventory because the
    // County Cork adapter already de-duplicates the Cork City live feed against
    // the county mapped network. Do not add `corkCounty` a second time.
    const cork = Array.isArray(inventories.cork) ? inventories.cork : [];
    if (cork.length) mergeUnique(output, cork.map(item => enrichForDiscover(item, "cork")));

    const kildare = Array.isArray(inventories.kildare) ? inventories.kildare : [];
    if (kildare.length) mergeUnique(output, kildare.map(item => enrichForDiscover(item, "kildare")));

    const dublin = Array.isArray(inventories.dublin) ? inventories.dublin : [];
    if (dublin.length) mergeUnique(output, dublin.map(item => enrichForDiscover(item, "dublin")));

    // Static startup fallback before regional adapters finish. It is replaced as
    // soon as canonical regional inventories become available.
    if (!output.length && Array.isArray(parkingData) && parkingData.length) {
      const active = String(state.activeRegion || state.parkingSnapshot?.coverage?.region || "cork").toLowerCase();
      const key = active.includes("dublin") ? "dublin" : active.includes("kildare") ? "kildare" : "cork";
      mergeUnique(output, parkingData.map(item => enrichForDiscover(item, key)));
    }

    return output;
  }

  function refreshDiscoveryInventory({ resetPage = false } = {}) {
    const next = collectRegionalInventory();
    const oldSignature = `${state.discoveryInventory.length}:${state.discoveryInventory.map(item => item.id).slice(-3).join("|")}`;
    const nextSignature = `${next.length}:${next.map(item => item.id).slice(-3).join("|")}`;
    state.discoveryInventory = next;
    if (resetPage || oldSignature !== nextSignature) state.discoveryVisibleLimit = PAGE_SIZE;
    renderDiscover();
  }

  function regionGroups(items) {
    const groups = new Map();
    items.forEach(item => {
      const region = item.discoverRegion || "Unclassified";
      if (!groups.has(region)) groups.set(region, []);
      groups.get(region).push(item);
    });
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }

  function filterItems(items) {
    const filters = state.discoveryFilters;
    return items.filter(item => {
      if (filters.region !== "all" && item.discoverRegionKey !== filters.region) return false;
      if (filters.access !== "all" && item.discoverAccessState !== filters.access) return false;
      if (filters.pricing !== "all" && item.discoverPricingState !== filters.pricing) return false;
      if (filters.supply !== "all" && item.discoverSupplyState !== filters.supply) return false;
      if (filters.feature === "ev" && item.ev !== true) return false;
      if (filters.feature === "accessible" && item.accessible !== true) return false;
      return true;
    });
  }

  function regionMode(region) {
    if (region === "Cork") return "City live + county mapped";
    if (region === "Dublin") return "Exact-boundary mapped network";
    if (region === "Kildare") return "Exact-county mapped network";
    return "Evidence-backed inventory";
  }

  function renderRegionCards(groups) {
    const container = document.getElementById("discover-region-list");
    if (!container) return;
    if (!groups.length) {
      container.innerHTML = '<div class="discover-empty">No regional parking inventory is available yet.</div>';
      return;
    }

    container.innerHTML = groups.map(([region, items]) => {
      const capacity = items.reduce((sum, item) => sum + (numeric(item.capacity) ?? 0), 0);
      const availableValues = items.map(item => numeric(item.available)).filter(value => value != null);
      const available = availableValues.length ? availableValues.reduce((sum, value) => sum + value, 0) : null;
      const unknownAccess = items.filter(item => item.discoverAccessState === "unknown").length;
      return `
        <article class="surface discover-region-card">
          <div class="discover-region-heading">
            <span class="discover-region-icon">◎</span>
            <div><p class="eyebrow">Regional inventory</p><h3>${escapeHtml(region)}</h3></div>
            <span class="discover-status">Active</span>
          </div>
          <div class="discover-region-stats">
            <span><small>Locations</small><strong>${formatInteger(items.length)}</strong></span>
            <span><small>Capacity</small><strong>${capacity ? formatInteger(capacity) : "—"}</strong></span>
            <span><small>Unknown access</small><strong>${formatInteger(unknownAccess)}</strong></span>
          </div>
          <div class="discover-region-foot"><span>${escapeHtml(regionMode(region))}</span><span>${available == null ? "Availability varies" : `${formatInteger(available)} reported free`}</span></div>
        </article>`;
    }).join("");
  }

  function accessLabel(item) {
    const value = item.discoverAccessState;
    if (value === "public") return "Public";
    if (value === "customer") return "Customers only";
    if (value === "permit") return "Permit";
    if (value === "restricted") return "Restricted";
    return "Access unknown";
  }

  function supplyLabel(item) {
    return item.discoverSupplyState === "candidate" ? "Candidate · not verified" : "Mapped inventory";
  }

  function locationCard(item, index) {
    const capacity = numeric(item.capacity);
    const available = numeric(item.available);
    const confidence = numeric(item.confidence);
    const source = formatSource(item.sourceKey);
    const availability = available == null ? "Unknown" : `${formatInteger(available)} free`;
    const maxStay = numeric(item.maxStayMinutes ?? item.maximumStayMinutes ?? item.maximum_stay_minutes);
    const rule = [accessLabel(item), maxStay != null ? `${formatInteger(maxStay)} min max` : null, item.openingHoursRaw ? "Hours published" : null].filter(Boolean).join(" · ");

    return `
      <article class="surface discover-location-card" data-discover-parking-id="${escapeHtml(item.id)}">
        <div class="discover-location-index">${String(index + 1).padStart(2, "0")}</div>
        <div class="discover-location-main">
          <div class="discover-location-title">
            <div>
              <h3>${escapeHtml(item.name)}</h3>
              <p>${escapeHtml(item.discoverSubregion)} · ${escapeHtml(item.discoverRegion)} · Ireland</p>
            </div>
            <span class="discover-location-state ${item.discoverSupplyState === "candidate" ? "candidate" : ""}">${escapeHtml(supplyLabel(item))}</span>
          </div>
          <div class="discover-rule-line">${escapeHtml(rule)}</div>
          <div class="discover-location-meta">
            <span><small>Asset ID</small><b>${escapeHtml(item.id)}</b></span>
            <span><small>Capacity</small><b>${capacity == null ? "—" : formatInteger(capacity)}</b></span>
            <span><small>Availability</small><b>${escapeHtml(availability)}</b></span>
            <span><small>Confidence</small><b>${confidence == null ? "—" : `${Math.round(confidence)}%`}</b></span>
          </div>
          <div class="discover-location-foot">
            <span>${escapeHtml(source)}</span>
            <button type="button" class="discover-map-button" data-discover-map-id="${escapeHtml(item.id)}">View on map →</button>
          </div>
        </div>
      </article>`;
  }

  function navigateToItem(item) {
    if (!item || !Number.isFinite(item.lat) || !Number.isFinite(item.lng)) return;
    setView("find");
    if (typeof selectAddressSuggestion === "function") {
      selectAddressSuggestion({
        primary: item.name,
        secondary: `${item.discoverSubregion}, ${item.discoverRegion}, Ireland`,
        label: `${item.name}, ${item.discoverSubregion}, ${item.discoverRegion}, Ireland`,
        lat: item.lat,
        lng: item.lng,
        type: "parking",
        source: "WHITEBLOCK unified Discover inventory"
      }, { runRanking: false });
    }
    window.setTimeout(() => {
      if (typeof selectParking === "function") selectParking(item.id);
    }, 180);
  }

  function bindLocationActions(visibleItems) {
    const byId = new Map(visibleItems.map(item => [String(item.id), item]));
    document.querySelectorAll("[data-discover-map-id]").forEach(button => {
      button.addEventListener("click", event => {
        event.stopPropagation();
        navigateToItem(byId.get(String(button.dataset.discoverMapId)));
      });
    });
  }

  function bindFilters() {
    document.querySelectorAll("[data-discover-filter-group]").forEach(group => {
      const key = group.dataset.discoverFilterGroup;
      group.querySelectorAll("[data-discover-filter]").forEach(button => {
        button.classList.toggle("active", state.discoveryFilters[key] === button.dataset.discoverFilter);
        if (button.dataset.discoverBound === "true") return;
        button.dataset.discoverBound = "true";
        button.addEventListener("click", () => {
          state.discoveryFilters[key] = button.dataset.discoverFilter;
          state.discoveryVisibleLimit = PAGE_SIZE;
          renderDiscover();
        });
      });
    });
  }

  function renderDiscover() {
    const list = document.getElementById("discover-location-list");
    const status = document.getElementById("discover-data-status");
    if (!list) return;

    const allItems = Array.isArray(state.discoveryInventory) ? state.discoveryInventory : [];
    const groups = regionGroups(allItems);
    const filtered = filterItems(allItems)
      .slice()
      .sort((a, b) => `${a.discoverRegion} ${a.discoverSubregion} ${a.name}`.localeCompare(`${b.discoverRegion} ${b.discoverSubregion} ${b.name}`));
    const visible = filtered.slice(0, state.discoveryVisibleLimit);

    const totalCapacity = allItems.reduce((sum, item) => sum + (numeric(item.capacity) ?? 0), 0);
    const availableValues = allItems.map(item => numeric(item.available)).filter(value => value != null);
    const totalAvailable = availableValues.length ? availableValues.reduce((sum, value) => sum + value, 0) : null;
    const mapped = allItems.filter(item => item.discoverSupplyState === "mapped").length;
    const candidates = allItems.filter(item => item.discoverSupplyState === "candidate").length;

    const regionValue = document.getElementById("discover-regions-value");
    const locationValue = document.getElementById("discover-locations-value");
    const capacityValue = document.getElementById("discover-capacity-value");
    const availabilityValue = document.getElementById("discover-available-value");
    const syncValue = document.getElementById("discover-sync-value");
    const regionName = document.getElementById("discover-primary-region");
    const matchValue = document.getElementById("discover-filter-match-count");

    if (regionValue) regionValue.textContent = String(groups.length);
    if (locationValue) locationValue.textContent = formatInteger(allItems.length);
    if (capacityValue) capacityValue.textContent = totalCapacity ? formatInteger(totalCapacity) : "—";
    if (availabilityValue) availabilityValue.textContent = totalAvailable == null ? "—" : formatInteger(totalAvailable);
    if (syncValue) syncValue.textContent = freshnessLabel(latestSourceTime());
    if (regionName) regionName.textContent = groups.length > 1 ? "Ireland connected regions" : groups[0]?.[0] || "Loading";
    if (matchValue) matchValue.textContent = `${formatInteger(filtered.length)} matching`;
    if (status) status.textContent = allItems.length ? `${formatInteger(allItems.length)} canonical assets · ${formatInteger(mapped)} mapped · ${formatInteger(candidates)} candidates` : "Loading regional inventory";

    renderRegionCards(groups);
    bindFilters();

    if (!allItems.length) {
      list.innerHTML = '<div class="surface discover-empty">Regional parking inventories are still loading. WHITEBLOCK will not substitute demo locations.</div>';
      return;
    }

    if (!filtered.length) {
      list.innerHTML = '<div class="surface discover-empty">No parking assets match the selected evidence filters.</div>';
      return;
    }

    list.innerHTML = visible.map((item, index) => locationCard(item, index)).join("");
    if (visible.length < filtered.length) {
      list.insertAdjacentHTML("beforeend", `<div class="discover-load-more-wrap"><button type="button" id="discover-load-more" class="discover-load-more">Show ${formatInteger(Math.min(PAGE_SIZE, filtered.length - visible.length))} more</button><small>${formatInteger(visible.length)} of ${formatInteger(filtered.length)} matching assets shown</small></div>`);
      document.getElementById("discover-load-more")?.addEventListener("click", () => {
        state.discoveryVisibleLimit += PAGE_SIZE;
        renderDiscover();
      });
    }
    bindLocationActions(visible);
  }

  // Refresh when any regional adapter reports data. Dublin already emits the
  // region-inventory event; data-ready covers Cork and destination activations.
  document.addEventListener("whiteblock:data-ready", () => refreshDiscoveryInventory());
  document.addEventListener("whiteblock:region-inventory-ready", () => refreshDiscoveryInventory());
  document.addEventListener("whiteblock:dublin-settlement-audit-ready", () => refreshDiscoveryInventory());
  document.addEventListener("whiteblock:dublin-restriction-audit-ready", () => refreshDiscoveryInventory());

  document.querySelectorAll('[data-view="discover"]').forEach(button => {
    button.addEventListener("click", () => refreshDiscoveryInventory());
  });

  // Regional scripts are injected after DOMContentLoaded. Poll only while their
  // loading state is unresolved so Kildare/Cork County initial loads are captured
  // even if no destination-specific data-ready event fires.
  let checks = 0;
  const regionalRefresh = window.setInterval(() => {
    checks += 1;
    refreshDiscoveryInventory();
    const statuses = [state.corkCountyNetworkStatus, state.kildareNetworkStatus, state.dublinNetworkStatus];
    const resolved = statuses.every(value => value && value !== "loading");
    if (resolved || checks >= 40) window.clearInterval(regionalRefresh);
  }, 500);

  refreshDiscoveryInventory({ resetPage: true });
})();
