// WHITEBLOCK Inventory Coverage extension.
// Aggregates canonical Cork + Kildare regional inventories for Discover, adds
// fast client-side search/filtering, and provides a local unverified candidate
// queue for parking locations that are not yet represented in the canonical
// evidence-backed inventory.

(() => {
  if (typeof state === "undefined") return;

  const STORAGE_KEY = "whiteblock.inventoryCandidates.v1";
  const DISPLAY_LIMIT = 100;
  const KILDARE_BOUNDS = {
    south: 52.89292777262258,
    west: -7.094685794312817,
    north: 53.40546821613401,
    east: -6.4849660938960625
  };

  const ui = {
    query: "",
    region: "all",
    status: "all",
    submitting: false
  };

  function escape(value) {
    if (typeof escapeHtml === "function") return escapeHtml(value ?? "");
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function numeric(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function formatInteger(value) {
    const parsed = numeric(value);
    return parsed == null ? "—" : Math.round(parsed).toLocaleString("en-IE");
  }

  function ensureStyles() {
    if (document.querySelector('link[data-whiteblock-inventory-coverage]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "./inventory-coverage.css?v=20260919-1";
    link.dataset.whiteblockInventoryCoverage = "true";
    document.head.appendChild(link);
  }

  function normalizeRegion(item) {
    const area = String(item?.area || "").toLowerCase();
    const id = String(item?.id || item?.parking_id || "").toLowerCase();
    if (area.includes("kildare") || id.includes("-kildare-")) return "Kildare";
    if (area.includes("cork") || id.includes("-cork-")) return "Cork";
    if (item?.candidateRegion) return item.candidateRegion;
    return item?.area || "Other";
  }

  function dedupe(items) {
    const seen = new Set();
    const output = [];
    items.forEach(item => {
      const id = item?.id || item?.parking_id;
      if (!id || seen.has(id)) return;
      seen.add(id);
      output.push(item);
    });
    return output;
  }

  function canonicalInventory() {
    const pools = [];
    const regions = state.regionInventories || {};

    if (Array.isArray(regions.cork)) pools.push(...regions.cork);
    if (Array.isArray(regions.kildare)) pools.push(...regions.kildare);

    // Before the regional adapter is ready, retain the base Discover inventory.
    if (!pools.length && Array.isArray(state.discoveryInventory)) pools.push(...state.discoveryInventory);
    if (!pools.length && Array.isArray(parkingData)) pools.push(...parkingData);

    return dedupe(pools).map(item => ({ ...item, inventoryStatus: "inventory" }));
  }

  function readCandidates() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter(item => item && item.id && Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lng))) : [];
    } catch (error) {
      console.warn("WHITEBLOCK candidate queue could not be read", error);
      return [];
    }
  }

  function writeCandidates(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  function snapshotForRegion(region) {
    const snapshots = state.regionSnapshots || {};
    if (region === "Kildare") return snapshots.kildare || null;
    if (region === "Cork") return snapshots.cork || state.discoverySnapshot || state.parkingSnapshot || null;
    return null;
  }

  function sourceLabel(item, region) {
    if (item?.candidate) return "User candidate · local review queue";
    const raw = item?.sourceKey || snapshotForRegion(region)?.source?.key;
    if (!raw) return region === "Kildare" ? "Kildare network inventory" : "Evidence-backed inventory";
    return String(raw).replaceAll("_", " ").replace(/\b\w/g, char => char.toUpperCase());
  }

  function latestSnapshotTime() {
    const snapshots = Object.values(state.regionSnapshots || {}).filter(Boolean);
    if (state.discoverySnapshot) snapshots.push(state.discoverySnapshot);
    const values = snapshots
      .map(snapshot => snapshot?.source?.retrieved_at || snapshot?.generated_at)
      .filter(Boolean)
      .map(value => new Date(value))
      .filter(value => !Number.isNaN(value.getTime()));
    if (!values.length) return null;
    return new Date(Math.max(...values.map(value => value.getTime())));
  }

  function freshnessLabel(value) {
    if (!value) return "Waiting for regional data";
    const minutes = Math.max(0, Math.round((Date.now() - value.getTime()) / 60000));
    if (minutes < 2) return "Regional inventory synced just now";
    if (minutes < 60) return `Regional inventory synced ${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `Regional inventory synced ${hours}h ago`;
    return `Regional inventory synced ${Math.round(hours / 24)}d ago`;
  }

  function searchText(item) {
    return [
      item?.name,
      item?.area,
      item?.id,
      item?.parkingType,
      item?.parking_type,
      item?.accessType,
      item?.sourceKey,
      item?.address,
      normalizeRegion(item)
    ].filter(Boolean).join(" ").toLowerCase();
  }

  function filteredRecords(canonical, candidates) {
    let records = [...canonical, ...candidates];
    if (ui.region !== "all") records = records.filter(item => normalizeRegion(item).toLowerCase() === ui.region);
    if (ui.status === "inventory") records = records.filter(item => !item.candidate);
    if (ui.status === "candidate") records = records.filter(item => item.candidate);

    const query = ui.query.trim().toLowerCase();
    if (query) {
      records = records.filter(item => searchText(item).includes(query));
      records.sort((a, b) => {
        const aName = String(a.name || "").toLowerCase();
        const bName = String(b.name || "").toLowerCase();
        const aExact = aName === query ? 0 : aName.startsWith(query) ? 1 : 2;
        const bExact = bName === query ? 0 : bName.startsWith(query) ? 1 : 2;
        return aExact - bExact || `${normalizeRegion(a)} ${aName}`.localeCompare(`${normalizeRegion(b)} ${bName}`);
      });
    } else {
      records.sort((a, b) => `${normalizeRegion(a)} ${a.name || ""}`.localeCompare(`${normalizeRegion(b)} ${b.name || ""}`));
    }
    return records;
  }

  function ensureTools() {
    ensureStyles();
    const list = document.getElementById("discover-location-list");
    if (!list || document.getElementById("inventory-coverage-tools")) return;

    const tools = document.createElement("section");
    tools.id = "inventory-coverage-tools";
    tools.className = "surface inventory-coverage-tools";
    tools.innerHTML = `
      <div class="inventory-search-row">
        <label class="inventory-search-field">
          <span>Search Inventory Coverage</span>
          <input id="inventory-search-input" type="search" autocomplete="off" placeholder="Search parking name, town, asset ID or source" />
        </label>
        <label class="inventory-filter-field">
          <span>Region</span>
          <select id="inventory-region-filter">
            <option value="all">All connected regions</option>
            <option value="cork">Cork</option>
            <option value="kildare">Kildare</option>
          </select>
        </label>
        <label class="inventory-filter-field">
          <span>Status</span>
          <select id="inventory-status-filter">
            <option value="all">Inventory + candidates</option>
            <option value="inventory">Inventory only</option>
            <option value="candidate">Candidate queue</option>
          </select>
        </label>
        <button id="inventory-add-button" class="inventory-add-button" type="button">+ Add parking location</button>
      </div>
      <div class="inventory-search-summary">
        <span id="inventory-search-count">Loading connected regional inventory…</span>
        <span>Kildare search includes County Council + OpenStreetMap inventory.</span>
      </div>
      <form id="inventory-candidate-form" class="inventory-candidate-form" hidden>
        <div class="inventory-form-head">
          <div><span class="inventory-candidate-badge">Candidate</span><h3>Propose a parking location</h3></div>
          <button id="inventory-candidate-close" type="button" aria-label="Close candidate form">×</button>
        </div>
        <p>A proposed location remains <strong>unverified</strong> and is not used in driver recommendations until evidence and access checks are completed.</p>
        <div class="inventory-form-grid">
          <label><span>Parking name</span><input name="name" required maxlength="120" placeholder="e.g. Town Centre car park" /></label>
          <label class="inventory-address"><span>Address or place</span><input name="address" required maxlength="220" placeholder="Street, town, County Kildare" /></label>
          <label><span>Region</span><select name="region"><option value="Kildare" selected>Kildare</option><option value="Cork">Cork</option></select></label>
          <label><span>Parking type</span><select name="parkingType"><option value="unknown_parking">General parking</option><option value="surface">Surface car park</option><option value="multistorey">Multi-storey</option><option value="street_side">Street-side</option><option value="park_and_ride">Park & Ride</option><option value="accessible">Accessible parking</option></select></label>
          <label><span>Capacity <small>optional</small></span><input name="capacity" type="number" min="0" max="20000" inputmode="numeric" placeholder="Unknown" /></label>
        </div>
        <div class="inventory-form-actions">
          <span id="inventory-candidate-status">Saved candidates remain on this device until a secured write API is connected.</span>
          <button id="inventory-candidate-submit" type="submit">Add to candidate queue</button>
        </div>
      </form>`;

    list.parentNode.insertBefore(tools, list);

    document.getElementById("inventory-search-input")?.addEventListener("input", event => {
      ui.query = event.target.value || "";
      renderInventoryCoverage();
    });
    document.getElementById("inventory-region-filter")?.addEventListener("change", event => {
      ui.region = event.target.value || "all";
      renderInventoryCoverage();
    });
    document.getElementById("inventory-status-filter")?.addEventListener("change", event => {
      ui.status = event.target.value || "all";
      renderInventoryCoverage();
    });

    const form = document.getElementById("inventory-candidate-form");
    document.getElementById("inventory-add-button")?.addEventListener("click", () => {
      form.hidden = !form.hidden;
      if (!form.hidden) form.querySelector('input[name="name"]')?.focus();
    });
    document.getElementById("inventory-candidate-close")?.addEventListener("click", () => { form.hidden = true; });
    form?.addEventListener("submit", submitCandidate);
  }

  function regionSummary(canonical, candidates) {
    const regions = ["Cork", "Kildare"];
    return regions.map(region => {
      const inventory = canonical.filter(item => normalizeRegion(item) === region);
      const queue = candidates.filter(item => normalizeRegion(item) === region);
      if (!inventory.length && !queue.length) return null;
      return { region, inventory, candidates: queue };
    }).filter(Boolean);
  }

  function renderRegionCoverage(canonical, candidates) {
    const host = document.getElementById("discover-region-list");
    if (!host) return;
    const summaries = regionSummary(canonical, candidates);
    if (!summaries.length) {
      host.innerHTML = '<div class="discover-empty">No connected regional inventory is available yet.</div>';
      return;
    }

    host.innerHTML = summaries.map(summary => {
      const { region, inventory, candidates: queue } = summary;
      const capacity = inventory.reduce((sum, item) => sum + (numeric(item.capacity) ?? 0), 0);
      const availableValues = inventory.map(item => numeric(item.available)).filter(value => value != null);
      const available = availableValues.length ? availableValues.reduce((sum, value) => sum + value, 0) : null;
      const snapshot = snapshotForRegion(region);
      const source = region === "Kildare"
        ? "Kildare CoCo + OpenStreetMap"
        : (snapshot?.source?.key ? String(snapshot.source.key).replaceAll("_", " ") : "Cork official snapshot");
      const mode = region === "Kildare" ? "Network inventory" : "Live observation pilot";
      return `
        <article class="surface discover-region-card inventory-region-card" data-inventory-region-card="${escape(region.toLowerCase())}">
          <div class="discover-region-heading">
            <span class="discover-region-icon">◎</span>
            <div><p class="eyebrow">Connected coverage</p><h3>${escape(region)}</h3></div>
            <span class="discover-status">Active</span>
          </div>
          <div class="discover-region-stats inventory-region-stats">
            <span><small>Inventory</small><strong>${formatInteger(inventory.length)}</strong></span>
            <span><small>Candidates</small><strong>${formatInteger(queue.length)}</strong></span>
            <span><small>Capacity</small><strong>${capacity ? formatInteger(capacity) : "—"}</strong></span>
            <span><small>Available</small><strong>${available == null ? "—" : formatInteger(available)}</strong></span>
          </div>
          <div class="discover-region-foot"><span>${escape(source)}</span><span>${escape(mode)}</span></div>
        </article>`;
    }).join("");

    host.querySelectorAll("[data-inventory-region-card]").forEach(card => {
      card.addEventListener("click", () => {
        ui.region = card.dataset.inventoryRegionCard || "all";
        const select = document.getElementById("inventory-region-filter");
        if (select) select.value = ui.region;
        renderInventoryCoverage();
        document.getElementById("inventory-coverage-tools")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  function recordCard(item, index) {
    const region = normalizeRegion(item);
    const candidate = Boolean(item.candidate);
    const capacity = numeric(item.capacity);
    const available = numeric(item.available);
    const confidence = numeric(item.confidence);
    const stateLabel = candidate ? "Unverified candidate" : "Inventory";
    const availability = candidate || available == null ? "—" : `${formatInteger(available)} free`;
    const confidenceLabel = candidate || confidence == null ? "—" : `${Math.round(confidence)}%`;
    const source = sourceLabel(item, region);

    return `
      <article class="surface discover-location-card${candidate ? " inventory-candidate-card" : ""}" data-inventory-record-id="${escape(item.id)}">
        <div class="discover-location-index">${String(index + 1).padStart(2, "0")}</div>
        <div class="discover-location-main">
          <div class="discover-location-title">
            <div>
              <h3>${escape(item.name || item.id)}</h3>
              <p>${escape(item.area || region)} · ${escape(region)} · Ireland</p>
            </div>
            <span class="discover-location-state${candidate ? " candidate" : ""}">${escape(stateLabel)}</span>
          </div>
          <div class="discover-location-meta">
            <span><small>Asset ID</small><b>${escape(item.id)}</b></span>
            <span><small>Capacity</small><b>${capacity == null ? "—" : formatInteger(capacity)}</b></span>
            <span><small>Availability</small><b>${escape(availability)}</b></span>
            <span><small>Confidence</small><b>${escape(confidenceLabel)}</b></span>
          </div>
          ${candidate && item.address ? `<p class="inventory-candidate-address">${escape(item.address)}</p>` : ""}
          <div class="discover-location-foot">
            <span>${escape(source)}</span>
            <div class="inventory-card-actions">
              ${candidate ? `<button type="button" class="inventory-remove-button" data-remove-candidate="${escape(item.id)}">Remove</button>` : ""}
              <button type="button" class="discover-map-button" data-inventory-map-id="${escape(item.id)}">${candidate ? "Inspect area" : "View on map"} →</button>
            </div>
          </div>
        </div>
      </article>`;
  }

  function bindRecordActions(records) {
    const byId = new Map(records.map(item => [item.id, item]));
    document.querySelectorAll("[data-inventory-map-id]").forEach(button => {
      button.addEventListener("click", event => {
        event.stopPropagation();
        const item = byId.get(button.dataset.inventoryMapId);
        if (!item || !Number.isFinite(Number(item.lat)) || !Number.isFinite(Number(item.lng))) return;
        const region = normalizeRegion(item);
        const destination = {
          primary: item.name || "Parking location",
          secondary: `${item.area || region}, Ireland`,
          label: `${item.name || "Parking location"}, ${item.area || region}, Ireland`,
          lat: Number(item.lat),
          lng: Number(item.lng),
          type: item.candidate ? "parking_candidate" : "parking",
          source: item.candidate ? "WHITEBLOCK local candidate" : sourceLabel(item, region)
        };
        if (typeof selectAddressSuggestion === "function") {
          selectAddressSuggestion(destination, { runRanking: true });
          if (typeof setView === "function") setView("find");
          if (!item.candidate && typeof selectParking === "function") {
            window.setTimeout(() => selectParking(item.id), 350);
          }
        }
      });
    });

    document.querySelectorAll("[data-remove-candidate]").forEach(button => {
      button.addEventListener("click", event => {
        event.stopPropagation();
        const id = button.dataset.removeCandidate;
        const next = readCandidates().filter(item => item.id !== id);
        writeCandidates(next);
        renderInventoryCoverage();
      });
    });
  }

  function renderInventoryCoverage() {
    ensureTools();
    const list = document.getElementById("discover-location-list");
    if (!list) return;

    const canonical = canonicalInventory();
    const candidates = readCandidates();
    const records = filteredRecords(canonical, candidates);
    const shown = records.slice(0, DISPLAY_LIMIT);

    const regionNames = [...new Set(canonical.map(normalizeRegion).filter(region => region === "Cork" || region === "Kildare"))];
    const totalCapacity = canonical.reduce((sum, item) => sum + (numeric(item.capacity) ?? 0), 0);
    const availableValues = canonical.map(item => numeric(item.available)).filter(value => value != null);
    const totalAvailable = availableValues.length ? availableValues.reduce((sum, value) => sum + value, 0) : null;

    const regionValue = document.getElementById("discover-regions-value");
    const locationValue = document.getElementById("discover-locations-value");
    const capacityValue = document.getElementById("discover-capacity-value");
    const availabilityValue = document.getElementById("discover-available-value");
    const syncValue = document.getElementById("discover-sync-value");
    const regionName = document.getElementById("discover-primary-region");
    const status = document.getElementById("discover-data-status");
    const count = document.getElementById("inventory-search-count");

    if (regionValue) regionValue.textContent = String(regionNames.length || 0);
    if (locationValue) locationValue.textContent = formatInteger(canonical.length);
    if (capacityValue) capacityValue.textContent = totalCapacity ? formatInteger(totalCapacity) : "—";
    if (availabilityValue) availabilityValue.textContent = totalAvailable == null ? "—" : formatInteger(totalAvailable);
    if (syncValue) syncValue.textContent = freshnessLabel(latestSnapshotTime());
    if (regionName) regionName.textContent = regionNames.length > 1 ? "Cork + Kildare" : (regionNames[0] || "Loading…");
    if (status) status.textContent = `${formatInteger(canonical.length)} inventory locations · ${formatInteger(candidates.length)} candidates`;
    if (count) {
      const suffix = records.length > DISPLAY_LIMIT ? ` · showing first ${DISPLAY_LIMIT}` : "";
      count.textContent = `${formatInteger(records.length)} matching records${suffix}`;
    }

    renderRegionCoverage(canonical, candidates);

    if (!records.length) {
      list.innerHTML = `<div class="surface discover-empty">No parking inventory matches this search.${ui.region === "kildare" ? " You can propose a Kildare parking location using “Add parking location”." : ""}</div>`;
      return;
    }

    list.innerHTML = shown.map((item, index) => recordCard(item, index)).join("");
    bindRecordActions(shown);
  }

  function insideKildare(lat, lng) {
    return lat >= KILDARE_BOUNDS.south && lat <= KILDARE_BOUNDS.north
      && lng >= KILDARE_BOUNDS.west && lng <= KILDARE_BOUNDS.east;
  }

  async function geocodeCandidate(address, region) {
    const query = `${address}, ${region}, Ireland`;
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=6&lang=en`;
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Address lookup returned ${response.status}`);
    const payload = await response.json();
    const features = Array.isArray(payload?.features) ? payload.features : [];

    const candidates = features.map(feature => {
      const props = feature?.properties || {};
      const coordinates = feature?.geometry?.coordinates || [];
      return {
        lat: Number(coordinates[1]),
        lng: Number(coordinates[0]),
        countryCode: String(props.countrycode || props.country_code || "").toLowerCase(),
        area: props.city || props.town || props.county || props.state || region,
        label: [props.name, props.street, props.city || props.town, props.county].filter(Boolean).join(", ")
      };
    }).filter(item => Number.isFinite(item.lat) && Number.isFinite(item.lng) && (!item.countryCode || item.countryCode === "ie"));

    if (region === "Kildare") {
      const match = candidates.find(item => insideKildare(item.lat, item.lng));
      if (!match) throw new Error("No matching location was found inside the Kildare coverage area");
      return match;
    }
    if (!candidates.length) throw new Error("No matching Irish location was found");
    return candidates[0];
  }

  function candidateId(region) {
    const code = region === "Kildare" ? "KILDARE" : "CORK";
    const stamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `WB-CAND-IE-${code}-LOCAL-${stamp}-${random}`;
  }

  async function submitCandidate(event) {
    event.preventDefault();
    if (ui.submitting) return;
    const form = event.currentTarget;
    const status = document.getElementById("inventory-candidate-status");
    const submit = document.getElementById("inventory-candidate-submit");
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    const address = String(data.get("address") || "").trim();
    const region = String(data.get("region") || "Kildare");
    const parkingType = String(data.get("parkingType") || "unknown_parking");
    const capacityRaw = String(data.get("capacity") || "").trim();
    const capacity = capacityRaw ? Number(capacityRaw) : null;

    if (!name || !address) return;
    ui.submitting = true;
    if (submit) submit.disabled = true;
    if (status) status.textContent = `Locating ${region} address…`;

    try {
      const located = await geocodeCandidate(address, region);
      const current = readCandidates();
      const duplicate = [...canonicalInventory(), ...current].find(item => {
        if (!Number.isFinite(Number(item.lat)) || !Number.isFinite(Number(item.lng))) return false;
        const sameName = String(item.name || "").trim().toLowerCase() === name.toLowerCase();
        const close = typeof haversineKm === "function"
          ? haversineKm(located.lat, located.lng, Number(item.lat), Number(item.lng)) <= 0.05
          : false;
        return sameName || close;
      });
      if (duplicate) throw new Error(`A nearby inventory record already exists: ${duplicate.name || duplicate.id}`);

      const candidate = {
        id: candidateId(region),
        name,
        address: located.label || address,
        area: located.area || (region === "Kildare" ? "County Kildare" : "Cork"),
        candidateRegion: region,
        lat: located.lat,
        lng: located.lng,
        capacity: Number.isFinite(capacity) ? capacity : null,
        available: null,
        confidence: null,
        parkingType,
        sourceKey: "user_candidate",
        truthState: "unverified",
        inventoryStatus: "candidate",
        candidate: true,
        createdAt: new Date().toISOString()
      };

      current.push(candidate);
      writeCandidates(current);
      form.reset();
      form.querySelector('select[name="region"]').value = "Kildare";
      if (status) status.textContent = `${candidate.id} added to the local unverified review queue.`;
      ui.region = region.toLowerCase();
      ui.status = "all";
      const regionSelect = document.getElementById("inventory-region-filter");
      if (regionSelect) regionSelect.value = ui.region;
      const statusSelect = document.getElementById("inventory-status-filter");
      if (statusSelect) statusSelect.value = "all";
      renderInventoryCoverage();
    } catch (error) {
      if (status) status.textContent = error?.message || "Could not add this candidate";
    } finally {
      ui.submitting = false;
      if (submit) submit.disabled = false;
    }
  }

  function scheduleRegionalRefresh() {
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      renderInventoryCoverage();
      if (state.kildareNetworkStatus === "ready" || attempts >= 30) window.clearInterval(timer);
    }, 500);
  }

  document.addEventListener("whiteblock:data-ready", renderInventoryCoverage);
  document.querySelectorAll('[data-view="discover"]').forEach(button => {
    button.addEventListener("click", () => window.setTimeout(renderInventoryCoverage, 0));
  });
  window.addEventListener("storage", event => {
    if (event.key === STORAGE_KEY) renderInventoryCoverage();
  });

  ensureTools();
  renderInventoryCoverage();
  scheduleRegionalRefresh();
})();
