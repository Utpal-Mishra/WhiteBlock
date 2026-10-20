// WHITEBLOCK Ireland-first landing and connected-region focus layer.
//
// The default product state is national coverage awareness, not an implicit Cork
// destination.  Regional inventory totals are evidence summaries: live
// availability is summed only where a source actually reports it.

(() => {
  if (typeof state === "undefined") return;

  const IRELAND_VIEW_BOUNDS = [[51.25, -10.85], [55.45, -5.55]];
  const REGION_BOUNDARY_URL = "./data/ireland_region_boundaries.geojson?v=20261020-1";
  const CONNECTED_REGIONS = {
    cork: {
      label: "Cork",
      countyLabel: "Cork",
      detail: "Cork City + County Cork",
      center: [51.90, -8.48],
      zoom: 9.0,
      nationalAnchor: [66, 36],
      mode: "City live + county mapped"
    },
    kildare: {
      label: "Kildare",
      countyLabel: "Kildare",
      detail: "County Kildare",
      center: [53.20, -6.78],
      zoom: 10.0,
      nationalAnchor: [132, -8],
      mode: "Exact-county mapped network"
    },
    dublin: {
      label: "Dublin",
      countyLabel: "Dublin",
      detail: "Dublin region",
      center: [53.35, -6.26],
      zoom: 10.4,
      nationalAnchor: [0, 78],
      mode: "Four-authority exact-boundary network"
    },
    wicklow: {
      label: "Wicklow",
      countyLabel: "Wicklow",
      detail: "County Wicklow · including Bray seafront pilot",
      center: [52.94, -6.34],
      zoom: 10.0,
      nationalAnchor: [65, -8],
      mode: "County mapped network + Bray evidence pilot · not exhaustive"
    }
  };

  state.regionInventories = state.regionInventories || {};
  state.regionSnapshots = state.regionSnapshots || {};
  state.overviewMode = true;
  state.regionFocus = null;
  state.irelandOverviewLayer = null;
  state.regionSubareaFocus = null;
  state.regionSubareaGroup = null;
  state.regionPendingFit = null;
  state.regionBoundaryLayer = null;
  const MARKER_POLICY = window.WHITEBLOCK_MARKER_POLICY;
  let regionBoundaryPromise = null;
  let regionBoundaryRequest = 0;

  // New county adapters can register via their source-backed region snapshot;
  // all map marker policies and locality drill-down then work without custom
  // clustering code. Local pilots (e.g. Bray) remain nested in their county.
  function registerNewRegionalInventories() {
    let changed = false;
    Object.entries(state.regionInventories || {}).forEach(([key, items]) => {
      if (CONNECTED_REGIONS[key] || MARKER_POLICY.canonicalRegion(key) !== key.toLowerCase()) return;
      if (!/^[a-z][a-z0-9_-]*$/i.test(key) || !Array.isArray(items) || !items.length) return;
      const snapshot = state.regionSnapshots?.[key];
      // Do not label an unsourced internal array as a newly connected county.
      if (!snapshot || !Array.isArray(snapshot.locations) || !snapshot.locations.length) return;
      const geo = items.filter(item => numeric(item?.lat) != null && numeric(item?.lng) != null);
      if (!geo.length) return;
      const label = String(snapshot.coverage?.region || key)
        .replace(/^county\s+/i, "").replace(/[_-]/g, " ")
        .replace(/\b\w/g, char => char.toUpperCase());
      const lat = geo.reduce((sum, item) => sum + Number(item.lat), 0) / geo.length;
      const lng = geo.reduce((sum, item) => sum + Number(item.lng), 0) / geo.length;
      CONNECTED_REGIONS[key] = {
        label, countyLabel: label, detail: "County " + label,
        center: [lat, lng], zoom: 10, nationalAnchor: [66, 36],
        mode: "Mapped county evidence · availability only where reported"
      };
      changed = true;
    });
    if (changed) {
      const switcher = document.getElementById("ireland-region-switcher");
      if (switcher) Object.entries(CONNECTED_REGIONS).forEach(([key, region]) => {
        if (switcher.querySelector('[data-ireland-scope="' + key + '"]')) return;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "ireland-region-button";
        button.dataset.irelandScope = key;
        button.textContent = region.label;
        switcher.appendChild(button);
      });
    }
    return changed;
  }

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
    // County Wicklow is the public coverage unit. Keep Bray's separately sourced
    // records as a Wicklow locality, not a fifth national region or count.
    if (key === "wicklow") {
      const county = state.regionInventories?.wicklow || [];
      const bray = state.regionInventories?.bray || [];
      const seen = new Set();
      return [...county, ...bray].filter(item => {
        const id = String(item?.id || item?.parking_id || "");
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      });
    }
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
    const snapshot = snapshotFor(key);
    const snapshotRows = Array.isArray(snapshot?.locations) ? snapshot.locations : [];
    const rows = inventory.length ? inventory : snapshotRows;
    const publishedLocationCount = numeric(snapshot?.summary?.locations);
    let capacity = 0;
    let capacityAssets = 0;
    let available = 0;
    let availableAssets = 0;
    let unknownAccess = 0;

    rows.forEach(item => {
      const cap = numeric(item.capacity ?? item.total_spaces ?? item.totalSpaces);
      if (cap != null && cap >= 0) {
        capacity += cap;
        capacityAssets += 1;
      }
      const free = numeric(item.available ?? item.available_spaces ?? item.availableSpaces);
      if (free != null && free >= 0) {
        available += free;
        availableAssets += 1;
      }
      const access = String(item.accessType || item.access_type || "unknown").toLowerCase();
      if (["unknown", "designated", ""].includes(access)) unknownAccess += 1;
    });

    const locations = rows.length || publishedLocationCount || 0;
    return {
      locations,
      capacity,
      capacityAssets,
      available: availableAssets ? available : null,
      availableAssets,
      unknownAccess,
      loaded: locations > 0
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

    const regionCount = Object.keys(CONNECTED_REGIONS).length;
    const regionNames = Object.values(CONNECTED_REGIONS).map(region => region.label).join(" + ");
    setKpiCard("coverage", "Connected inventory", formatInteger(stats.locations),
      regionNames + " mapped/evidence-backed assets (local pilots included in their county)");
    setKpiCard("availability", "Reported available now", stats.availableAssets ? formatInteger(stats.available) : "—", reportingLabel);
    setKpiCard("confidence", "Published capacity", stats.capacityAssets ? formatInteger(stats.capacity) : "—", "known capacity only · missing capacity is not estimated");
    setKpiCard("pressure", "Connected regions", formatInteger(regionCount), `${stats.loadedRegions}/${regionCount} regional inventories loaded`);
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

  function ensureOverviewPane() {
    if (!state.map || typeof L === "undefined") return null;
    let pane = state.map.getPane("wbOverviewPane");
    if (!pane) pane = state.map.createPane("wbOverviewPane");
    pane.style.zIndex = "640";
    pane.style.pointerEvents = "auto";
    return pane;
  }

  function ensureRegionBoundaryPane() {
    if (!state.map || typeof L === "undefined") return null;
    let pane = state.map.getPane("wbRegionBoundaryPane");
    if (!pane) pane = state.map.createPane("wbRegionBoundaryPane");
    pane.style.zIndex = "438";
    pane.style.pointerEvents = "none";
    return pane;
  }

  function clearRegionBoundary() {
    regionBoundaryRequest += 1;
    if (state.map && state.regionBoundaryLayer) {
      try { state.map.removeLayer(state.regionBoundaryLayer); } catch (_) { /* no-op */ }
    }
    state.regionBoundaryLayer = null;
  }

  function loadRegionBoundaries() {
    if (regionBoundaryPromise) return regionBoundaryPromise;
    if (typeof window.fetch !== "function") return Promise.resolve(null);
    regionBoundaryPromise = window.fetch(REGION_BOUNDARY_URL, { cache: "force-cache" })
      .then(response => {
        if (!response.ok) throw new Error(`boundary HTTP ${response.status}`);
        return response.json();
      })
      .then(data => {
        if (data?.type !== "FeatureCollection" || !Array.isArray(data.features)) {
          throw new Error("invalid region boundary GeoJSON");
        }
        return data;
      })
      .catch(error => {
        // Allow a later region selection to retry after a transient local-file
        // or network failure instead of caching a failed boundary request forever.
        regionBoundaryPromise = null;
        console.warn("WHITEBLOCK selected-region boundary unavailable", error);
        return null;
      });
    return regionBoundaryPromise;
  }

  async function renderRegionBoundary(key, { fit = false } = {}) {
    const region = CONNECTED_REGIONS[key];
    if (!region || !state.map || typeof L === "undefined" || typeof L.geoJSON !== "function") return false;
    const request = ++regionBoundaryRequest;
    const data = await loadRegionBoundaries();
    if (!data || request !== regionBoundaryRequest || state.regionFocus !== key || state.overviewMode) return false;
    const feature = data.features.find(item => String(item?.properties?.region_key || "").toLowerCase() === key);
    if (!feature?.geometry) return false;

    if (state.regionBoundaryLayer) {
      try { state.map.removeLayer(state.regionBoundaryLayer); } catch (_) { /* no-op */ }
    }
    ensureRegionBoundaryPane();
    state.regionBoundaryLayer = L.geoJSON(feature, {
      pane: "wbRegionBoundaryPane",
      interactive: false,
      style: {
        color: "#C8F56B",
        weight: 3.4,
        opacity: 0.96,
        fillColor: "#78E6AA",
        fillOpacity: 0.045,
        lineJoin: "round",
        className: "wb-selected-region-boundary"
      }
    }).addTo(state.map);

    if (fit && request === regionBoundaryRequest && state.regionFocus === key) {
      try {
        const bounds = state.regionBoundaryLayer.getBounds?.();
        if (bounds?.isValid?.()) {
          state.map.fitBounds(bounds, { padding: [34, 34], maxZoom: region.zoom + 1, animate: true });
        }
      } catch (_) { /* parking-point fit remains the fallback */ }
    }
    return true;
  }

  function regionNodeHtml(key, stats) {
    const region = CONNECTED_REGIONS[key];
    const count = stats.loaded ? formatInteger(stats.locations) : "…";
    const available = stats.availableAssets
      ? `${formatInteger(stats.available)} reported vacant bays`
      : "Vacancies unverified";
    const scope = `County ${region.countyLabel}`;
    return `<div class="wb-ireland-region-node">
      <strong>${escapeHtml(scope)}</strong>
      <span>${escapeHtml(count)} mapped locations</span>
      <small>${escapeHtml(available)}</small>
    </div>`;
  }

  function renderNationalRegionNodes() {
    if (!state.map || typeof L === "undefined") return;
    ensureOverviewPane();
    clearOverviewLayer();
    state.irelandOverviewLayer = L.layerGroup().addTo(state.map);

    Object.entries(CONNECTED_REGIONS).forEach(([key, region]) => {
      const stats = regionStats(key);
      const icon = L.divIcon({
        className: "wb-ireland-region-wrapper",
        html: regionNodeHtml(key, stats),
        iconSize: [132, 74],
        iconAnchor: region.nationalAnchor || [66, 37]
      });
      const marker = L.marker(region.center, { icon, keyboard: true, pane: "wbOverviewPane" }).addTo(state.irelandOverviewLayer);
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

  function subareaLabel(item, key) {
    const region = CONNECTED_REGIONS[key];
    const candidates = [
      item?.settlement,
      item?.area,
      item?.city,
      item?.town,
      item?.localAuthority,
      item?.local_authority
    ].map(value => String(value || "").trim()).filter(Boolean);

    const generic = new Set([
      String(region.label || "").toLowerCase(),
      String(region.countyLabel || "").toLowerCase(),
      `county ${String(region.countyLabel || "").toLowerCase()}`,
      "ireland"
    ]);
    return candidates.find(value => !generic.has(value.toLowerCase()))
      || candidates[0]
      || region.label;
  }

  function groupRegionalInventory(key) {
    const groups = new Map();
    inventoryFor(key).forEach(item => {
      const lat = numeric(item?.lat);
      const lng = numeric(item?.lng);
      if (lat == null || lng == null) return;

      const label = subareaLabel(item, key);
      const groupKey = label.toLocaleLowerCase("en-IE");
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          label,
          items: [],
          latTotal: 0,
          lngTotal: 0,
          capacity: 0,
          capacityAssets: 0,
          available: 0,
          availableAssets: 0
        });
      }

      const group = groups.get(groupKey);
      group.items.push(item);
      group.latTotal += lat;
      group.lngTotal += lng;

      const capacity = numeric(item.capacity);
      if (capacity != null && capacity >= 0) {
        group.capacity += capacity;
        group.capacityAssets += 1;
      }
      const available = numeric(item.available);
      if (available != null && available >= 0) {
        group.available += available;
        group.availableAssets += 1;
      }
    });

    return [...groups.values()].map(group => ({
      ...group,
      lat: group.latTotal / group.items.length,
      lng: group.lngTotal / group.items.length
    })).sort((a, b) => b.items.length - a.items.length || a.label.localeCompare(b.label));
  }

  function settlementNodeHtml(group) {
    const capacity = group.capacityAssets ? `${formatInteger(group.capacity)} known spaces` : "capacity unknown";
    const available = group.availableAssets ? ` · ${formatInteger(group.available)} free` : "";
    return `<div class="wb-region-settlement-node">
      <strong>${escapeHtml(group.label)}</strong>
      <span>${formatInteger(group.items.length)} parking locations</span>
      <small>${escapeHtml(capacity + available)}</small>
    </div>`;
  }

  function assetTooltip(item) {
    const capacity = numeric(item.capacity);
    const available = numeric(item.available);
    const facts = [];
    if (capacity != null) facts.push(`${formatInteger(capacity)} spaces`);
    if (available != null) facts.push(`${formatInteger(available)} reported free`);
    return `${item.name || item.id || "Parking"}${facts.length ? ` · ${facts.join(" · ")}` : " · capacity/availability not published"}`;
  }

  function clusterGroups(rows, radiusPx, detailZoom) {
    const zoom = state.map.getZoom();
    return MARKER_POLICY.groupNearby(rows, zoom,
      item => state.map.project(L.latLng(Number(item.lat), Number(item.lng)), zoom),
      { radiusPx, detailZoom });
  }

  function zoomIntoGroup(lat, lng, detailZoom) {
    state.map.flyTo([lat, lng], Math.min(detailZoom, state.map.getZoom() + 2), { duration: 0.75 });
  }

  function renderSubareaParkingMarkers(key, group) {
    if (!group || !state.map || typeof L === "undefined") return;
    ensureOverviewPane();
    clearOverviewLayer();
    state.irelandOverviewLayer = L.layerGroup().addTo(state.map);
    const valid = group.items.filter(item => numeric(item?.lat) != null && numeric(item?.lng) != null);
    const visible = state.map.getZoom() >= MARKER_POLICY.detailZoom && state.map.getBounds
      ? valid.filter(item => {
          const bounds = state.map.getBounds();
          return !bounds || typeof bounds.pad !== "function" ||
            bounds.pad(0.2).contains([Number(item.lat), Number(item.lng)]);
        })
      : valid;
    clusterGroups(visible, MARKER_POLICY.inventoryRadiusPx, MARKER_POLICY.detailZoom).forEach(indices => {
      if (indices.length > 1) {
        const members = indices.map(index => visible[index]);
        const lat = members.reduce((sum, item) => sum + Number(item.lat), 0) / members.length;
        const lng = members.reduce((sum, item) => sum + Number(item.lng), 0) / members.length;
        const icon = L.divIcon({
          className: "wb-region-settlement-wrapper",
          html: `<div class="wb-region-settlement-node"><strong>${formatInteger(indices.length)} parking locations</strong><span>Zoom to separate</span><small>${escapeHtml(group.label)}</small></div>`,
          iconSize: [126, 66], iconAnchor: [63, 33]
        });
        L.marker([lat, lng], { icon, keyboard: true, pane: "wbOverviewPane" })
          .addTo(state.irelandOverviewLayer)
          .bindTooltip(`${formatInteger(indices.length)} distinct mapped parking locations · tap to zoom`,
            { direction: "top", className: "wb-tooltip" })
          .on("click", () => zoomIntoGroup(lat, lng, MARKER_POLICY.detailZoom));
        return;
      }
      const item = visible[indices[0]];
      const lat = Number(item.lat), lng = Number(item.lng);
      const available = numeric(item.available);
      L.circleMarker([lat, lng], {
        pane: "wbOverviewPane", radius: 6, color: "#07110D",
        weight: 2, fillColor: available != null ? "#52D98D" : "#78E6AA",
        fillOpacity: 1
      }).addTo(state.irelandOverviewLayer)
        .bindTooltip(escapeHtml(assetTooltip(item)), {
          direction: "top", offset: [0, -8], className: "wb-tooltip"
        })
        .on("click", () => {
          state.map.setView([lat, lng], MARKER_POLICY.detailZoom, { animate: true });
          if (typeof setMapStatus === "function") setMapStatus(item.name || "Parking location", assetTooltip(item));
        });
    });
  }

  // Selecting a county immediately displays its entire mapped/evidence-backed
  // parking inventory, not just locality summaries. Count badges are visual
  // clusters of real parking locations; they never claim live empty bays.
  function countyParkingRows(key) {
    const inventory = inventoryFor(key);
    const source = inventory.length ? inventory : (snapshotFor(key)?.locations || []);
    const seen = new Set();
    return source.filter(item => {
      const id = String(item?.id || item?.parking_id || "");
      const lat = numeric(item?.lat), lng = numeric(item?.lng);
      if (!id || seen.has(id) || lat == null || lng == null) return false;
      if (lat < 51 || lat > 56 || lng < -12 || lng > -5) return false;
      seen.add(id);
      return true;
    });
  }

  function fitCountyParking(key, rows) {
    const region = CONNECTED_REGIONS[key];
    if (!state.map || !region) return;
    const points = rows.map(item => [Number(item.lat), Number(item.lng)]);
    if (points.length > 1) {
      state.map.fitBounds(L.latLngBounds(points), {
        padding: [46, 46], maxZoom: Math.min(14, region.zoom + 1),
        animate: true
      });
    } else if (points.length === 1) {
      state.map.flyTo(points[0], Math.min(13, region.zoom + 1), { duration: 0.75 });
    } else {
      // The county is selectable while a source is still loading.
      state.map.flyTo(region.center, region.zoom, { duration: 0.75 });
    }
  }

  function renderCountyParkingMarkers(key, { fit = false } = {}) {
    const region = CONNECTED_REGIONS[key];
    if (!region || !state.map || typeof L === "undefined") return [];
    const rows = countyParkingRows(key);
    // Existing cluster renderer is county-agnostic, handles all source rows,
    // and uses viewport filtering at detail zoom rather than truncating at 300.
    renderSubareaParkingMarkers(key, {
      label: "County " + region.countyLabel,
      items: rows
    });
    if (fit) fitCountyParking(key, rows);
    return rows;
  }

  function focusSubarea(key, group) {
    const region = CONNECTED_REGIONS[key];
    if (!region || !state.map || typeof L === "undefined" || !group?.items?.length) return;

    state.regionSubareaFocus = group.label;
    state.regionSubareaGroup = group;
    renderSubareaParkingMarkers(key, group);

    const mapTitle = document.getElementById("map-title");
    if (mapTitle) mapTitle.textContent = `${group.label} parking · ${region.label}`;
    if (typeof setMapStatus === "function") {
      const capacity = group.capacityAssets ? `${formatInteger(group.capacity)} known spaces` : "capacity partly unknown";
      setMapStatus(`${group.label} parking`,
        `${formatInteger(group.items.length)} mapped/evidence-backed locations · ${capacity} · tap a marker for details`);
    }
    const count = document.querySelector(".result-count");
    if (count) count.textContent = `${formatInteger(group.items.length)} mapped`;

    const points = group.items
      .filter(item => numeric(item.lat) != null && numeric(item.lng) != null)
      .map(item => [Number(item.lat), Number(item.lng)]);
    if (points.length > 1) {
      state.map.fitBounds(L.latLngBounds(points), { padding: [44, 44], maxZoom: 16, animate: true });
    } else if (points.length === 1) {
      state.map.flyTo(points[0], 16, { duration: .7 });
    }
  }

  function renderRegionSettlementNodes(key, { fit = true } = {}) {
    const region = CONNECTED_REGIONS[key];
    if (!region || !state.map || typeof L === "undefined") return [];
    ensureOverviewPane();
    const groups = groupRegionalInventory(key);
    clearOverviewLayer();
    state.irelandOverviewLayer = L.layerGroup().addTo(state.map);

    clusterGroups(groups, MARKER_POLICY.localityRadiusPx, MARKER_POLICY.localityDetailZoom)
      .forEach(indices => {
        if (indices.length > 1) {
          const members = indices.map(index => groups[index]);
          const lat = members.reduce((sum, item) => sum + item.lat, 0) / members.length;
          const lng = members.reduce((sum, item) => sum + item.lng, 0) / members.length;
          const locations = members.reduce((sum, item) => sum + item.items.length, 0);
          const icon = L.divIcon({
            className: "wb-region-settlement-wrapper",
            html: `<div class="wb-region-settlement-node"><strong>${formatInteger(indices.length)} localities</strong><span>${formatInteger(locations)} parking locations</span><small>Zoom to explore</small></div>`,
            iconSize: [126, 66], iconAnchor: [63, 33]
          });
          L.marker([lat, lng], { icon, keyboard: true, pane: "wbOverviewPane" })
            .addTo(state.irelandOverviewLayer)
            .bindTooltip(`${formatInteger(indices.length)} nearby localities · ${formatInteger(locations)} mapped parking locations`,
              { direction: "top", className: "wb-tooltip" })
            .on("click", () => zoomIntoGroup(lat, lng, MARKER_POLICY.localityDetailZoom));
          return;
        }
        const group = groups[indices[0]];
        const icon = L.divIcon({
          className: "wb-region-settlement-wrapper",
          html: settlementNodeHtml(group),
          iconSize: [126, 66], iconAnchor: [63, 33]
        });
        L.marker([group.lat, group.lng], { icon, keyboard: true, pane: "wbOverviewPane" })
          .addTo(state.irelandOverviewLayer)
          .bindTooltip(`${group.label} · ${formatInteger(group.items.length)} parking locations · tap to show individual parking`,
            { direction: "top", className: "wb-tooltip" })
          .on("click", () => focusSubarea(key, group));
      });

    if (fit) {
      const groupPoints = groups.map(group => [group.lat, group.lng]);
      if (groupPoints.length > 1) {
        state.map.fitBounds(L.latLngBounds(groupPoints), { padding: [48, 48], maxZoom: region.zoom, animate: true });
      } else if (groupPoints.length === 1) {
        state.map.flyTo(groupPoints[0], region.zoom, { duration: .8 });
      } else {
        state.map.flyTo(region.center, region.zoom, { duration: .8 });
      }
    }
    return groups;
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
      <button type="button" class="ireland-region-button" data-ireland-scope="dublin">Dublin</button>
      <button type="button" class="ireland-region-button" data-ireland-scope="wicklow">Wicklow</button>`;
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
      if (small) small.textContent = Object.values(CONNECTED_REGIONS).map(region => region.label).join(" · ") + " connected";
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
            <span><small>Mapped locations</small><strong>${item.loaded ? formatInteger(item.locations) : "—"}</strong></span>
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
        <p>The map shows all currently mapped parking locations in ${escapeHtml(region.detail)}. Tap count clusters to zoom in and reveal individual sites. Search a destination to filter by walking distance, stay and access before ranking.</p>
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
      if (count) count.textContent = `${Object.keys(CONNECTED_REGIONS).length} connected`;
      bindNationalResults();
      return;
    }
    if (state.regionFocus && !state.destination) {
      list.innerHTML = regionBrowseHtml(state.regionFocus);
      if (count) count.textContent = `${formatInteger(regionStats(state.regionFocus).locations)} mapped`;
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
      state.regionSubareaFocus = null;
      state.regionSubareaGroup = null;
      clearOverviewLayer();
      clearRegionBoundary();
      updateSwitcher();
      return baseSelectAddressSuggestion(item, options);
    };
  }

  function showIrelandNetworkOverview({ animate = true } = {}) {
    state.overviewMode = true;
    state.regionFocus = null;
    state.regionSubareaFocus = null;
    state.regionSubareaGroup = null;
    state.regionPendingFit = null;
    clearDestinationForBrowse();
    clearDetailedMarkers();
    clearRegionBoundary();
    updateStaticChrome();
    updateSwitcher();
    updateNationalKpis();
    renderBrowseResults();
    renderNationalRegionNodes();
    document.dispatchEvent(new CustomEvent("whiteblock:coverage-browse", { detail: { scope: "ireland" } }));

    const mapTitle = document.getElementById("map-title");
    if (mapTitle) mapTitle.textContent = "Connected parking across Ireland";
    if (typeof setMapStatus === "function") {
      const stats = nationalStats();
      setMapStatus(
        "Ireland connected coverage",
        `${formatInteger(stats.locations)} mapped/evidence-backed assets across ${Object.values(CONNECTED_REGIONS).map(region => region.label).join(", ")} (local pilots included in counties) · availability shown only where reported`
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
    state.regionSubareaFocus = null;
    state.regionSubareaGroup = null;
    state.regionPendingFit = key;
    state.activeRegion = key;
    clearDestinationForBrowse();
    clearDetailedMarkers();
    clearOverviewLayer();
    clearRegionBoundary();
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

    // County selection is geographic drill-down: zoom to *all* mapped sites
    // and show their clustered real coordinates immediately. No invented
    // destination and no intermediate locality-only map are required.
    document.dispatchEvent(new CustomEvent("whiteblock:coverage-browse", { detail: { scope: "region", region: key } }));
    const rows = renderCountyParkingMarkers(key, { fit: true });
    void renderRegionBoundary(key, { fit: true });
    // A locality pilot may load before the larger county snapshot (e.g. Bray
    // before County Wicklow). The administrative border remains the camera
    // frame, while late parking data only refreshes the markers inside it.
    if (rows.length && Array.isArray(state.regionInventories[key]) &&
        state.regionInventories[key].length && Array.isArray(snapshotFor(key)?.locations)) {
      state.regionPendingFit = null;
    }
    if (typeof setMapStatus === "function") {
      const stats = regionStats(key);
      const availability = stats.availableAssets
        ? `${formatInteger(stats.available)} reported vacant bays across ${formatInteger(stats.availableAssets)} reporting assets`
        : "live vacant spaces not reported";
      setMapStatus(
        `${region.detail} · ${formatInteger(rows.length)} mapped parking locations`,
        `Tap a cluster to zoom into individual locations · ${availability}`
      );
    }
  }

  // Shared clustering responds to every zoom, independent of county identity.
  // Do not refit bounds on zoomend: preserve the user's chosen map scale.
  state.map?.on?.("zoomend", () => {
    if (!state.regionFocus || state.overviewMode) return;
    if (state.regionSubareaGroup) {
      renderSubareaParkingMarkers(state.regionFocus, state.regionSubareaGroup);
    } else {
      renderCountyParkingMarkers(state.regionFocus, { fit: false });
    }
  });

  // Replace the legacy Cork-era Ireland overview action with the connected
  // national network view.  Existing button bindings resolve this global at click
  // time, so changing it here updates both desktop and future callers.
  showIrelandOverview = showIrelandNetworkOverview;
  window.WHITEBLOCK_IRELAND_OVERVIEW = {
    show: showIrelandNetworkOverview,
    focusRegion,
    stats: nationalStats,
    groups: groupRegionalInventory,
    focusSubarea,
    renderCountyParkingMarkers,
    countyParkingRows,
    renderRegionBoundary,
    registerNewRegionalInventories
  };

  registerNewRegionalInventories();
  void loadRegionBoundaries();
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

    if (state.overviewMode) {
      updateNationalKpis();
      renderBrowseResults();
      renderNationalRegionNodes();
    } else if (state.regionFocus) {
      updateRegionKpis(state.regionFocus);
      renderBrowseResults();
    }

    const resolved = [
      state.corkCountyNetworkStatus,
      state.kildareNetworkStatus,
      state.dublinNetworkStatus,
      state.wicklowNetworkStatus,
      state.regionStatus?.bray
    ].filter(value => value != null).every(value => value !== "loading");
    if ((announced.size === Object.keys(CONNECTED_REGIONS).length && resolved) || checks >= 120) {
      window.clearInterval(regionalWatcher);
    }
  }, 500);

  document.addEventListener("whiteblock:data-ready", () => {
    if (state.overviewMode) {
      updateNationalKpis();
      renderBrowseResults();
      renderNationalRegionNodes();
    }
  });
  document.addEventListener("whiteblock:region-inventory-ready", () => {
    registerNewRegionalInventories();
    updateStaticChrome();
    if (state.overviewMode) {
      updateNationalKpis();
      renderBrowseResults();
      renderNationalRegionNodes();
    } else if (state.regionFocus && !state.regionSubareaGroup) {
      const key = state.regionFocus;
      const shouldFit = state.regionPendingFit === key;
      const rows = renderCountyParkingMarkers(key, { fit: shouldFit });
      if (shouldFit) void renderRegionBoundary(key, { fit: true });
      if (rows.length && Array.isArray(state.regionInventories[key]) &&
          state.regionInventories[key].length &&
          Array.isArray(snapshotFor(key)?.locations)) {
        state.regionPendingFit = null;
      }
    }
  });

  // The base app boots with the historical Cork default.  Replace that state once
  // all static scripts have initialized; no Cork destination is silently assumed.
  window.setTimeout(() => showIrelandNetworkOverview({ animate: false }), 0);
})();