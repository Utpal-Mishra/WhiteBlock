// WHITEBLOCK all-inventory parking map layer.
// Renders every connected Cork + Kildare parking asset using clustering so the
// full inventory remains legible and performant on mobile.

(() => {
  if (typeof state === "undefined" || typeof L === "undefined") return;

  const CLUSTER_JS = "https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js";
  const CLUSTER_CSS = "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css";
  const CLUSTER_DEFAULT_CSS = "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css";
  const STYLE_URL = "./inventory-map-layer.css?v=20260921-1";

  state.inventoryMarkerLayer = null;
  state.inventoryMarkerLookup = new Map();
  state.inventoryMarkersEnabled = true;
  state.inventoryMarkerControl = null;

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

  function connectedInventory() {
    const rows = [];
    const seen = new Set();
    const inventories = state.regionInventories || {};

    Object.entries(inventories).forEach(([region, items]) => {
      if (!Array.isArray(items)) return;
      items.forEach(item => {
        if (!item?.id || seen.has(item.id)) return;
        if (!Number.isFinite(Number(item.lat)) || !Number.isFinite(Number(item.lng))) return;
        seen.add(item.id);
        rows.push({ ...item, region });
      });
    });

    // During initial Cork hydration regionInventories may not yet be populated.
    if (!rows.length && Array.isArray(parkingData)) {
      parkingData.forEach(item => {
        if (!item?.id || seen.has(item.id)) return;
        if (!Number.isFinite(Number(item.lat)) || !Number.isFinite(Number(item.lng))) return;
        seen.add(item.id);
        rows.push({ ...item, region: state.activeRegion || "cork" });
      });
    }
    return rows;
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
      html: `<div class="wb-parking-cluster ${size}"><span>${count.toLocaleString()}</span><small>parking</small></div>`,
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
  }

  function renderInventoryLayer() {
    if (!state.map || typeof L === "undefined") return;
    const items = connectedInventory();
    if (!items.length) return;

    removeUnclusteredRegionMarkers();
    removeExistingInventoryLayer();

    const clustered = typeof L.markerClusterGroup === "function";
    const layer = clustered
      ? L.markerClusterGroup({
          chunkedLoading: true,
          chunkInterval: 80,
          chunkDelay: 30,
          maxClusterRadius: 46,
          disableClusteringAtZoom: 17,
          spiderfyOnMaxZoom: true,
          showCoverageOnHover: false,
          removeOutsideVisibleBounds: true,
          iconCreateFunction: clusterIcon
        })
      : L.layerGroup();

    const markers = items.map(item => {
      const marker = makeMarker(item);
      state.inventoryMarkerLookup.set(item.id, marker);
      state.markers.set(item.id, marker);
      return marker;
    });

    if (clustered && typeof layer.addLayers === "function") layer.addLayers(markers);
    else markers.forEach(marker => layer.addLayer(marker));

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
