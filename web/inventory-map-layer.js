// WHITEBLOCK all-inventory parking map layer.
// Renders mapped assets from all current and future regions using clustering
// so the full inventory remains legible and performant on mobile.

(() => {
  if (typeof state === "undefined" || typeof L === "undefined") return;

  const CLUSTER_JS = "https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js";
  const CLUSTER_CSS = "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css";
  const CLUSTER_DEFAULT_CSS = "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css";
  const STYLE_URL = "./inventory-map-layer.css?v=20261020-2";

  state.inventoryMarkerLayer = null;
  state.inventoryMarkerLookup = new Map();
  state.inventoryMarkersEnabled = true;
  state.inventoryMarkerControl = null;

  function coverageBrowseActive() {
    return window.WHITEBLOCK_MARKER_POLICY.browseActive(state);
  }

  function setControlVisibility(visible) {
    const host = state.inventoryMarkerControl?.getContainer?.();
    if (host) host.style.display = visible ? "" : "none";
  }

  function ensureLink(href, marker) {
    if (document.querySelector(`link[data-${marker}]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset[marker.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = "true";
    document.head.appendChild(link);
  }

  function ensureStyles() {
    ensureLink(CLUSTER_CSS, "whiteblock-cluster-core");
    ensureLink(CLUSTER_DEFAULT_CSS, "whiteblock-cluster-default");
    ensureLink(STYLE_URL, "whiteblock-inventory-map");
  }

  function loadClusterPlugin() {
    if (typeof L.markerClusterGroup === "function") return Promise.resolve(true);
    const existing = document.querySelector("script[data-whiteblock-markercluster]");
    if (existing) {
      return new Promise(resolve => {
        if (typeof L.markerClusterGroup === "function") return resolve(true);
        existing.addEventListener("load", () => resolve(typeof L.markerClusterGroup === "function"), { once: true });
        existing.addEventListener("error", () => resolve(false), { once: true });
      });
    }
    return new Promise(resolve => {
      const script = document.createElement("script");
      script.src = CLUSTER_JS;
      script.defer = true;
      script.dataset.whiteblockMarkercluster = "true";
      script.addEventListener("load", () => resolve(typeof L.markerClusterGroup === "function"), { once: true });
      script.addEventListener("error", () => resolve(false), { once: true });
      document.body.appendChild(script);
    });
  }

  const POLICY = window.WHITEBLOCK_MARKER_POLICY;
  // Inventory keys are discovered from state, never a hardcoded county list.
  // Canonical pools take priority over legacy Cork County/Bray sub-pools;
  // stable parking IDs are counted only once across current/future regions.
  function connectedInventory() {
    return POLICY.connectedInventory(state, parkingData);
  }

  function capabilityClass(item) {
    const ev = item.ev === true || Number(item.evSpaces || 0) > 0;
    const accessible = item.accessible === true || Number(item.accessibleSpaces || 0) > 0;
    const access = String(item.accessType || "unknown").toLowerCase();
    if (["private", "permit", "restricted"].includes(access)) return "restricted";
    if (ev && accessible) return "ev-accessible";
    if (ev) return "ev";
    if (accessible) return "accessible";
    return "general";
  }

  function markerIcon(item) {
    const capability = capabilityClass(item);
    const symbol = capability === "ev" || capability === "ev-accessible" ? "⚡" : capability === "accessible" ? "A" : "P";
    return L.divIcon({
      className: "wb-inventory-marker-wrapper",
      html: `<div class="wb-inventory-marker ${capability}"><span>${symbol}</span></div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    });
  }

  function availabilityCopy(item) {
    if (item.available != null) return `${Math.round(item.available)} spaces reported free`;
    if (item.capacity != null) return `${Math.round(item.capacity)} spaces capacity · live availability not reported`;
    return "Live availability not reported";
  }

  function capabilityCopy(item) {
    const labels = [];
    if (item.accessible === true || Number(item.accessibleSpaces || 0) > 0) labels.push("Accessible");
    if (item.ev === true || Number(item.evSpaces || 0) > 0) labels.push("EV charging");
    const access = String(item.accessType || "unknown").toLowerCase();
    if (access === "customer") labels.push("Customer parking");
    else if (access === "public") labels.push("Public parking");
    else if (["private", "permit", "restricted"].includes(access)) labels.push(`${access} access`);
    return labels.join(" · ") || "Parking inventory";
  }

  function activateInventoryItem(item) {
    const inActiveInventory = Array.isArray(parkingData) && parkingData.some(row => row.id === item.id);
    if (inActiveInventory && typeof selectParking === "function") {
      selectParking(item.id);
      return;
    }

    if (typeof selectAddressSuggestion === "function") {
      selectAddressSuggestion({
        primary: item.name,
        secondary: `${item.area || item.region || "Ireland"}, Ireland`,
        label: `${item.name}, ${item.area || item.region || "Ireland"}`,
        lat: Number(item.lat),
        lng: Number(item.lng),
        type: "parking",
        source: "WHITEBLOCK inventory map"
      }, { runRanking: true });
      window.setTimeout(() => {
        if (Array.isArray(parkingData) && parkingData.some(row => row.id === item.id) && typeof selectParking === "function") {
          selectParking(item.id);
        }
      }, 140);
    }
  }

  function makeMarker(item) {
    const marker = L.marker([Number(item.lat), Number(item.lng)], {
      icon: markerIcon(item),
      keyboard: true,
      riseOnHover: true
    });
    marker.bindTooltip(
      `<strong>${escapeHtml(item.name || "Parking")}</strong><br>${escapeHtml(item.area || item.region || "Ireland")} · ${escapeHtml(capabilityCopy(item))}<br>${escapeHtml(availabilityCopy(item))}`,
      { direction: "top", offset: [0, -12], className: "wb-tooltip wb-inventory-tooltip" }
    );
    marker.on("click", () => activateInventoryItem(item));
    marker.__whiteblockInventoryItem = item;
    return marker;
  }

  function clusterIcon(cluster) {
    const count = cluster.getChildCount();
    const size = count >= 1000 ? "xl" : count >= 100 ? "lg" : count >= 20 ? "md" : "sm";
    return L.divIcon({
      className: "wb-parking-cluster-wrapper",
      html: `<div class="wb-parking-cluster locations ${size}"><span>${count.toLocaleString()}</span><small>locations</small></div>`,
      iconSize: [54, 54],
      iconAnchor: [27, 27]
    });
  }

  function removeUnclusteredRegionMarkers() {
    if (!state.map || !(state.markers instanceof Map)) return;
    state.markers.forEach(marker => {
      try {
        if (state.map.hasLayer(marker)) state.map.removeLayer(marker);
      } catch (_) {}
    });
    state.markers.clear();
  }

  function removeExistingInventoryLayer() {
    if (!state.map || !state.inventoryMarkerLayer) return;
    try {
      if (state.map.hasLayer(state.inventoryMarkerLayer)) state.map.removeLayer(state.inventoryMarkerLayer);
    } catch (_) {}
    state.inventoryMarkerLayer = null;
    state.inventoryMarkerLookup.clear();
  }

  function updateControl(count) {
    const button = state.inventoryMarkerControl?.getContainer?.()?.querySelector("button");
    if (!button) return;
    button.classList.toggle("is-off", !state.inventoryMarkersEnabled);
    button.setAttribute("aria-pressed", state.inventoryMarkersEnabled ? "true" : "false");
    button.innerHTML = `<span class="wb-inventory-control-dot"></span><strong>${count.toLocaleString()}</strong><small>${state.inventoryMarkersEnabled ? "parking mapped" : "parking hidden"}</small>`;
  }

  function ensureControl(count) {
    if (!state.map || state.inventoryMarkerControl) {
      updateControl(count);
      setControlVisibility(!coverageBrowseActive());
      return;
    }
    const InventoryControl = L.Control.extend({
      options: { position: "bottomright" },
      onAdd() {
        const host = L.DomUtil.create("div", "wb-inventory-map-control leaflet-bar");
        const button = L.DomUtil.create("button", "", host);
        button.type = "button";
        button.title = "Show or hide all mapped parking locations";
        L.DomEvent.disableClickPropagation(host);
        L.DomEvent.on(button, "click", event => {
          L.DomEvent.stop(event);
          state.inventoryMarkersEnabled = !state.inventoryMarkersEnabled;
          if (state.inventoryMarkerLayer) {
            if (state.inventoryMarkersEnabled) state.inventoryMarkerLayer.addTo(state.map);
            else if (state.map.hasLayer(state.inventoryMarkerLayer)) state.map.removeLayer(state.inventoryMarkerLayer);
          }
          updateControl(connectedInventory().length);
        });
        return host;
      }
    });
    state.inventoryMarkerControl = new InventoryControl();
    state.inventoryMarkerControl.addTo(state.map);
    updateControl(count);
    setControlVisibility(!coverageBrowseActive());
  }

  function renderInventoryLayer() {
    if (!state.map || typeof L === "undefined") return;
    const items = connectedInventory();

    // National/region browse mode owns the map with one readable summary layer.
    // Do not let thousands of clustered parking markers cover the county totals
    // or locality drill-down cards. Exact inventory markers return after a
    // destination is committed and overviewMode/regionFocus are cleared.
    if (coverageBrowseActive()) {
      removeExistingInventoryLayer();
      setControlVisibility(false);
      return;
    }

    setControlVisibility(true);
    if (!items.length) return;

    removeUnclusteredRegionMarkers();
    removeExistingInventoryLayer();

    const clustered = typeof L.markerClusterGroup === "function";
    const layer = clustered
      ? L.markerClusterGroup({
          chunkedLoading: true,
          chunkInterval: 80,
          chunkDelay: 30,
          maxClusterRadius: POLICY.inventoryRadiusPx,
          disableClusteringAtZoom: POLICY.detailZoom,
          spiderfyOnMaxZoom: true,
          showCoverageOnHover: false,
          removeOutsideVisibleBounds: true,
          iconCreateFunction: clusterIcon
        })
      : L.layerGroup();

    state.inventoryClusterFallback = !clustered;
    if (clustered && typeof layer.addLayers === "function") {
      const markers = items.map(item => {
        const marker = makeMarker(item);
        state.inventoryMarkerLookup.set(item.id, marker);
        state.markers.set(item.id, marker);
        return marker;
      });
      layer.addLayers(markers);
    } else {
      // CDN/network failures must not revert 10,000+ parking locations to
      // overlapping pins. Reuse the same universal grouping policy without
      // relying on an external clustering plugin.
      const zoom = state.map.getZoom();
      const groups = POLICY.groupNearby(items, zoom,
        item => state.map.project(L.latLng(Number(item.lat), Number(item.lng)), zoom),
        { radiusPx: POLICY.inventoryRadiusPx, detailZoom: POLICY.detailZoom });
      groups.forEach(indices => {
        if (indices.length === 1) {
          const item = items[indices[0]];
          const marker = makeMarker(item);
          state.inventoryMarkerLookup.set(item.id, marker);
          layer.addLayer(marker);
          return;
        }
        const members = indices.map(index => items[index]);
        const lat = members.reduce((sum, item) => sum + Number(item.lat), 0) / members.length;
        const lng = members.reduce((sum, item) => sum + Number(item.lng), 0) / members.length;
        const marker = L.marker([lat, lng], {
          icon: clusterIcon({ getChildCount: () => members.length }),
          keyboard: true
        });
        marker.bindTooltip(members.length.toLocaleString() + " mapped parking locations · zoom for detail", {
          direction: "top", className: "wb-tooltip"
        });
        marker.on("click", () => state.map.flyTo([lat, lng],
          Math.min(POLICY.detailZoom, state.map.getZoom() + 2), { animate: true }));
        layer.addLayer(marker);
      });
    }

    state.inventoryMarkerLayer = layer;
    if (state.inventoryMarkersEnabled) layer.addTo(state.map);
    ensureControl(items.length);

    document.dispatchEvent(new CustomEvent("whiteblock:inventory-map-ready", {
      detail: { count: items.length, clustered }
    }));
  }

  function revealSelectedMarker(id) {
    const marker = state.inventoryMarkerLookup.get(id);
    if (!marker || !state.inventoryMarkerLayer) return;
    if (typeof state.inventoryMarkerLayer.zoomToShowLayer === "function") {
      state.inventoryMarkerLayer.zoomToShowLayer(marker, () => marker.openTooltip());
    } else {
      marker.openTooltip();
    }
  }

  function wrapApplicationHooks() {
    if (typeof applyDestinationContext === "function" && !applyDestinationContext.__wbInventoryWrapped) {
      const baseApplyDestinationContext = applyDestinationContext;
      const wrapped = function wrappedDestinationContext(...args) {
        const result = baseApplyDestinationContext.apply(this, args);
        window.setTimeout(renderInventoryLayer, 0);
        return result;
      };
      wrapped.__wbInventoryWrapped = true;
      applyDestinationContext = wrapped;
    }

    if (typeof selectParking === "function" && !selectParking.__wbInventoryWrapped) {
      const baseSelectParking = selectParking;
      const wrapped = function wrappedSelectParking(id, ...args) {
        const result = baseSelectParking.call(this, id, ...args);
        window.setTimeout(() => revealSelectedMarker(id), 0);
        return result;
      };
      wrapped.__wbInventoryWrapped = true;
      selectParking = wrapped;
    }
  }

  ensureStyles();
  wrapApplicationHooks();
  document.addEventListener("whiteblock:data-ready", () => window.setTimeout(renderInventoryLayer, 0));
  document.addEventListener("whiteblock:kildare-attributes-ready", () => window.setTimeout(renderInventoryLayer, 0));
  document.addEventListener("whiteblock:coverage-browse", () => {
    removeExistingInventoryLayer();
    setControlVisibility(false);
  });
  document.addEventListener("whiteblock:region-inventory-ready", event => {
    const region = String(event?.detail?.region || "").toLowerCase();
    if (!region) return;
    window.setTimeout(renderInventoryLayer, 0);
  });
  state.map?.on?.("zoomend", () => {
    if (state.inventoryClusterFallback && !coverageBrowseActive()) renderInventoryLayer();
  });


  loadClusterPlugin().then(() => {
    renderInventoryLayer();
    let attempts = 0;
    const retry = () => {
      attempts += 1;
      if (connectedInventory().length && state.map) return renderInventoryLayer();
      if (attempts < 24) window.setTimeout(retry, 250);
    };
    retry();
  });
})();
