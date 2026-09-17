// WHITEBLOCK Discover inventory layer.
// Shows parking regions and locations that have been ingested into the current
// WHITEBLOCK inventory. "Added" here means added to the data inventory, not
// newly constructed or newly discovered physical parking.

(() => {
  state.discoveryInventory = state.discoveryInventory || null;
  state.discoverySnapshot = state.discoverySnapshot || null;

  function numeric(value) {
    return Number.isFinite(Number(value)) ? Number(value) : null;
  }

  function formatInteger(value) {
    const number = numeric(value);
    return number == null ? "—" : Math.round(number).toLocaleString("en-IE");
  }

  function formatSource(value) {
    if (!value) return "Evidence-backed source";
    return String(value)
      .replaceAll("_", " ")
      .replace(/\b\w/g, letter => letter.toUpperCase());
  }

  function freshnessLabel(value) {
    if (!value) return "Freshness unknown";
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return "Freshness unknown";
    const minutes = Math.max(0, Math.round((Date.now() - dt.getTime()) / 60000));
    if (minutes < 2) return "Synced just now";
    if (minutes < 60) return `Synced ${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `Synced ${hours}h ago`;
    return `Synced ${Math.round(hours / 24)}d ago`;
  }

  function currentInventory() {
    if (Array.isArray(state.discoveryInventory) && state.discoveryInventory.length) {
      return state.discoveryInventory;
    }
    return Array.isArray(parkingData) ? parkingData : [];
  }

  function currentSnapshot() {
    return state.discoverySnapshot || state.parkingSnapshot || null;
  }

  function regionFor(item, snapshot) {
    return item.area || snapshot?.coverage?.region || "Unclassified region";
  }

  function regionGroups(items, snapshot) {
    const groups = new Map();
    items.forEach(item => {
      const region = regionFor(item, snapshot);
      if (!groups.has(region)) groups.set(region, []);
      groups.get(region).push(item);
    });
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }

  function captureInventory(event) {
    // The first evidence-backed snapshot is the broad regional inventory used by
    // Discover. Later API destination queries are intentionally not allowed to
    // shrink this view to only a nearby subset.
    if (!state.discoveryInventory?.length && Array.isArray(parkingData) && parkingData.length) {
      state.discoveryInventory = parkingData.map(item => ({ ...item }));
      state.discoverySnapshot = state.parkingSnapshot ? structuredClone(state.parkingSnapshot) : null;
    }

    // If there was no snapshot and the API is the only available source, use it.
    if (!state.discoveryInventory?.length && event?.detail?.mode === "api" && Array.isArray(parkingData)) {
      state.discoveryInventory = parkingData.map(item => ({ ...item }));
      state.discoverySnapshot = state.parkingSnapshot ? structuredClone(state.parkingSnapshot) : null;
    }
  }

  function renderRegionCards(groups, snapshot) {
    const container = document.getElementById("discover-region-list");
    if (!container) return;

    if (!groups.length) {
      container.innerHTML = '<div class="discover-empty">No region inventory is available yet.</div>';
      return;
    }

    const source = formatSource(snapshot?.source?.key);
    const mode = snapshot?.coverage?.mode === "postgis_api" ? "PostGIS API" : "Official snapshot";

    container.innerHTML = groups.map(([region, items]) => {
      const capacity = items.reduce((sum, item) => sum + (numeric(item.capacity) ?? 0), 0);
      const available = items.reduce((sum, item) => sum + (numeric(item.available) ?? 0), 0);
      return `
        <article class="surface discover-region-card">
          <div class="discover-region-heading">
            <span class="discover-region-icon">◎</span>
            <div>
              <p class="eyebrow">Region added</p>
              <h3>${escapeHtml(region)}</h3>
            </div>
            <span class="discover-status">Active</span>
          </div>
          <div class="discover-region-stats">
            <span><small>Locations</small><strong>${items.length}</strong></span>
            <span><small>Capacity</small><strong>${capacity ? formatInteger(capacity) : "—"}</strong></span>
            <span><small>Available</small><strong>${available || available === 0 ? formatInteger(available) : "—"}</strong></span>
          </div>
          <div class="discover-region-foot"><span>${escapeHtml(source)}</span><span>${escapeHtml(mode)}</span></div>
        </article>`;
    }).join("");
  }

  function locationCard(item, snapshot, index) {
    const region = regionFor(item, snapshot);
    const capacity = numeric(item.capacity);
    const available = numeric(item.available);
    const confidence = numeric(item.confidence);
    const source = formatSource(item.sourceKey || snapshot?.source?.key);
    const availability = available == null ? "Unknown" : `${formatInteger(available)} free`;

    return `
      <article class="surface discover-location-card" data-discover-parking-id="${escapeHtml(item.id)}">
        <div class="discover-location-index">${String(index + 1).padStart(2, "0")}</div>
        <div class="discover-location-main">
          <div class="discover-location-title">
            <div>
              <h3>${escapeHtml(item.name)}</h3>
              <p>${escapeHtml(region)} · Ireland</p>
            </div>
            <span class="discover-location-state">Inventory</span>
          </div>
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

  function bindLocationActions() {
    document.querySelectorAll("[data-discover-map-id]").forEach(button => {
      button.addEventListener("click", event => {
        event.stopPropagation();
        const id = button.dataset.discoverMapId;
        if (!id) return;
        setView("find");
        window.setTimeout(() => selectParking(id), 80);
      });
    });
  }

  function renderDiscover() {
    const list = document.getElementById("discover-location-list");
    const status = document.getElementById("discover-data-status");
    if (!list) return;

    if (state.dataStatus === "loading" && !state.discoveryInventory?.length) {
      list.innerHTML = '<div class="surface discover-empty">Loading the current parking inventory…</div>';
      if (status) status.textContent = "Loading inventory";
      return;
    }

    const items = currentInventory();
    const snapshot = currentSnapshot();
    const groups = regionGroups(items, snapshot);
    const totalCapacity = items.reduce((sum, item) => sum + (numeric(item.capacity) ?? 0), 0);
    const availableValues = items.map(item => numeric(item.available)).filter(value => value != null);
    const totalAvailable = availableValues.length ? availableValues.reduce((sum, value) => sum + value, 0) : null;
    const sourceTime = snapshot?.source?.retrieved_at || snapshot?.generated_at;

    const values = {
      regions: groups.length,
      locations: items.length,
      capacity: totalCapacity || null,
      available: totalAvailable
    };

    const regionValue = document.getElementById("discover-regions-value");
    const locationValue = document.getElementById("discover-locations-value");
    const capacityValue = document.getElementById("discover-capacity-value");
    const availabilityValue = document.getElementById("discover-available-value");
    const syncValue = document.getElementById("discover-sync-value");
    const regionName = document.getElementById("discover-primary-region");

    if (regionValue) regionValue.textContent = String(values.regions);
    if (locationValue) locationValue.textContent = String(values.locations);
    if (capacityValue) capacityValue.textContent = values.capacity == null ? "—" : formatInteger(values.capacity);
    if (availabilityValue) availabilityValue.textContent = values.available == null ? "—" : formatInteger(values.available);
    if (syncValue) syncValue.textContent = freshnessLabel(sourceTime);
    if (regionName) regionName.textContent = groups[0]?.[0] || snapshot?.coverage?.region || "No region yet";
    if (status) status.textContent = items.length ? `${items.length} locations in current inventory` : "No inventory loaded";

    renderRegionCards(groups, snapshot);

    if (!items.length) {
      list.innerHTML = '<div class="surface discover-empty">No parking locations have been added to the current WHITEBLOCK inventory yet.</div>';
      return;
    }

    list.innerHTML = items
      .slice()
      .sort((a, b) => `${regionFor(a, snapshot)} ${a.name}`.localeCompare(`${regionFor(b, snapshot)} ${b.name}`))
      .map((item, index) => locationCard(item, snapshot, index))
      .join("");
    bindLocationActions();
  }

  document.addEventListener("whiteblock:data-ready", event => {
    captureInventory(event);
    renderDiscover();
  });

  document.querySelectorAll('[data-view="discover"]').forEach(button => {
    button.addEventListener("click", renderDiscover);
  });

  // Safe for local/static startup before the asynchronous snapshot arrives.
  renderDiscover();
})();
