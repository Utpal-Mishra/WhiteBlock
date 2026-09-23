// WHITEBLOCK parking access intelligence layer.
// Keeps access eligibility explicit: public, customer/destination, permissive,
// restricted, and unknown. Missing access evidence is never promoted to public.

(() => {
  const GROUPS = {
    public: {
      label: "Public",
      shortLabel: "Public",
      description: "Explicitly tagged for public access",
      symbol: "P",
      recommendationPenalty: 0
    },
    customer: {
      label: "Customer / destination",
      shortLabel: "Customer",
      description: "Conditional on being a customer or destination user",
      symbol: "C",
      recommendationPenalty: 0.05
    },
    conditional: {
      label: "Permissive",
      shortLabel: "Permissive",
      description: "Permissive access; check local signage and conditions",
      symbol: "~",
      recommendationPenalty: 0.06
    },
    unknown: {
      label: "Access unknown",
      shortLabel: "Unknown",
      description: "Access evidence is not published or not conclusive",
      symbol: "?",
      recommendationPenalty: 0.09
    },
    restricted: {
      label: "Private / permit",
      shortLabel: "Restricted",
      description: "Private, permit, emergency or otherwise restricted access",
      symbol: "×",
      recommendationPenalty: 5
    }
  };

  const RAW_ACCESS = {
    public: { group: "public", label: "Public parking" },
    customer: { group: "customer", label: "Customers only" },
    destination: { group: "customer", label: "Destination users only" },
    permissive: { group: "conditional", label: "Permissive access" },
    private: { group: "restricted", label: "Private parking" },
    permit: { group: "restricted", label: "Permit only" },
    restricted: { group: "restricted", label: "Restricted access" },
    emergency: { group: "restricted", label: "Emergency access only" },
    "residents;visitors": { group: "restricted", label: "Residents / visitors only" },
    designated: { group: "unknown", label: "Designated access · verify" },
    unknown: { group: "unknown", label: "Access not verified" }
  };

  const ORDER = ["public", "customer", "conditional", "unknown", "restricted"];
  const DEFAULT_ACTIVE = ["public", "customer", "conditional", "unknown"];

  function rawValue(itemOrValue) {
    const value = typeof itemOrValue === "object" && itemOrValue !== null
      ? itemOrValue.accessType ?? itemOrValue.access_type ?? "unknown"
      : itemOrValue;
    return String(value || "unknown").trim().toLowerCase();
  }

  function describe(itemOrValue) {
    const raw = rawValue(itemOrValue);
    const mapped = RAW_ACCESS[raw] || RAW_ACCESS.unknown;
    const group = GROUPS[mapped.group];
    return {
      raw,
      group: mapped.group,
      label: mapped.label,
      groupLabel: group.label,
      shortLabel: group.shortLabel,
      description: group.description,
      symbol: group.symbol,
      recommendationPenalty: group.recommendationPenalty,
      recommendationEligible: mapped.group !== "restricted",
      conditional: mapped.group === "customer" || mapped.group === "conditional",
      verifiedPublic: mapped.group === "public"
    };
  }

  function classify(itemOrValue) {
    return describe(itemOrValue).group;
  }

  function ensureStyle() {
    if (document.querySelector('link[data-whiteblock-parking-access]')) return;
    const style = document.createElement("link");
    style.rel = "stylesheet";
    style.href = "./parking-access-layer.css?v=20260923-1";
    style.dataset.whiteblockParkingAccess = "true";
    document.head.appendChild(style);
  }

  window.WBParkingAccess = {
    groups: GROUPS,
    order: ORDER,
    describe,
    classify,
    isRecommendationEligible: item => describe(item).recommendationEligible
  };

  ensureStyle();

  // Recommendation semantics -------------------------------------------------
  // session-rules.js remains the source of truth for max stay/opening windows.
  // This wrapper adds access evidence as a ranking and eligibility dimension.
  if (typeof score === "function" && !score.__wbAccessWrapped) {
    const baseScore = score;
    const wrappedScore = function scoreWithAccessEvidence(item) {
      return baseScore(item) - describe(item).recommendationPenalty;
    };
    wrappedScore.__wbAccessWrapped = true;
    score = wrappedScore;
  }

  if (typeof currentData === "function" && !currentData.__wbAccessWrapped) {
    const baseCurrentData = currentData;
    const wrappedCurrentData = function currentDataWithAccessEvidence(...args) {
      const original = parkingData;
      // Remove access-restricted assets before the existing ranking/filter logic
      // so "closest" or "cheapest" cannot accidentally promote private/permit
      // parking. Assets remain visible in the map/evidence layer for transparency.
      parkingData = original.filter(item => describe(item).recommendationEligible);
      try {
        return baseCurrentData.apply(this, args);
      } finally {
        parkingData = original;
      }
    };
    wrappedCurrentData.__wbAccessWrapped = true;
    currentData = wrappedCurrentData;
  }

  function warningCopy(info) {
    if (info.group === "customer") return "Conditional access — use only when you meet the customer/destination condition and check on-site signage.";
    if (info.group === "conditional") return "Permissive access is not the same as public ownership and may be withdrawn or locally restricted.";
    if (info.group === "unknown") return "Access is not verified. WHITEBLOCK does not assume this is public parking.";
    if (info.group === "restricted") return "Restricted-access parking is shown for network transparency, not as a normal recommendation.";
    return "";
  }

  function annotateCards() {
    document.querySelectorAll(".parking-card[data-parking-id]").forEach(card => {
      const id = card.dataset.parkingId;
      const item = Array.isArray(parkingData) ? parkingData.find(row => row.id === id) : null;
      if (!item) return;
      const info = describe(item);
      card.dataset.accessGroup = info.group;
      card.classList.add(`wb-card-access-${info.group}`);

      const existingChip = card.querySelector(".parking-rule-row .parking-rule-chip:first-child");
      if (existingChip) {
        existingChip.textContent = info.label;
        existingChip.classList.add("wb-access-chip", `wb-access-chip-${info.group}`);
      }

      const copy = warningCopy(info);
      if (copy && !card.querySelector(".wb-access-warning")) {
        const note = document.createElement("p");
        note.className = `wb-access-warning wb-access-warning-${info.group}`;
        note.textContent = copy;
        card.appendChild(note);
      }
    });
  }

  if (typeof renderParkingList === "function" && !renderParkingList.__wbAccessWrapped) {
    const baseRenderParkingList = renderParkingList;
    const wrappedRenderParkingList = function renderParkingListWithAccessEvidence(...args) {
      const result = baseRenderParkingList.apply(this, args);
      annotateCards();
      renderEvidenceSummary();
      return result;
    };
    wrappedRenderParkingList.__wbAccessWrapped = true;
    renderParkingList = wrappedRenderParkingList;
  }

  // Map access layers ---------------------------------------------------------
  state.inventoryAccessFilters = state.inventoryAccessFilters instanceof Set
    ? state.inventoryAccessFilters
    : new Set(DEFAULT_ACTIVE);
  state.inventoryAccessControl = state.inventoryAccessControl || null;
  state.inventoryAccessPanelOpen = Boolean(state.inventoryAccessPanelOpen);

  function inventoryMarkers() {
    if (!(state.inventoryMarkerLookup instanceof Map)) return [];
    return [...state.inventoryMarkerLookup.values()].filter(marker => marker?.__whiteblockInventoryItem);
  }

  function capabilityBadges(item) {
    const badges = [];
    if (item?.ev === true || Number(item?.evSpaces || 0) > 0) badges.push("⚡");
    if (item?.accessible === true || Number(item?.accessibleSpaces || 0) > 0) badges.push("A");
    return badges;
  }

  function markerHtml(item) {
    const info = describe(item);
    const badges = capabilityBadges(item);
    const badgeHtml = badges.length
      ? `<small class="wb-marker-capability-badge">${badges.join("·")}</small>`
      : "";
    return `<div class="wb-inventory-marker wb-access-${info.group}"><span>${info.symbol}</span>${badgeHtml}</div>`;
  }

  function availabilityCopy(item) {
    if (item?.available != null) return `${Math.round(Number(item.available))} spaces reported free`;
    if (item?.capacity != null) return `${Math.round(Number(item.capacity))} spaces capacity · live availability not reported`;
    return "Live availability not reported";
  }

  function capabilityCopy(item) {
    const labels = [];
    if (item?.accessible === true || Number(item?.accessibleSpaces || 0) > 0) labels.push("Accessible");
    if (item?.ev === true || Number(item?.evSpaces || 0) > 0) labels.push("EV charging");
    return labels.join(" · ");
  }

  function escape(value) {
    if (typeof escapeHtml === "function") return escapeHtml(value);
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function restyleMarker(marker) {
    const item = marker?.__whiteblockInventoryItem;
    if (!item || typeof L === "undefined") return;
    const info = describe(item);
    marker.setIcon(L.divIcon({
      className: "wb-inventory-marker-wrapper",
      html: markerHtml(item),
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    }));
    const capability = capabilityCopy(item);
    const secondLine = [info.label, capability].filter(Boolean).join(" · ");
    const tooltip = `<strong>${escape(item.name || "Parking")}</strong><br>${escape(item.area || item.region || "Ireland")} · ${escape(secondLine)}<br>${escape(availabilityCopy(item))}`;
    if (typeof marker.setTooltipContent === "function") marker.setTooltipContent(tooltip);
  }

  function countsByGroup(markers = inventoryMarkers()) {
    const counts = Object.fromEntries(ORDER.map(group => [group, 0]));
    markers.forEach(marker => {
      const group = classify(marker.__whiteblockInventoryItem);
      counts[group] = (counts[group] || 0) + 1;
    });
    return counts;
  }

  function visibleMarkers(markers = inventoryMarkers()) {
    return markers.filter(marker => state.inventoryAccessFilters.has(classify(marker.__whiteblockInventoryItem)));
  }

  function applyMapFilter() {
    const layer = state.inventoryMarkerLayer;
    if (!layer || typeof layer.clearLayers !== "function") return;
    const markers = inventoryMarkers();
    markers.forEach(restyleMarker);
    const visible = visibleMarkers(markers);
    layer.clearLayers();
    if (typeof layer.addLayers === "function") layer.addLayers(visible);
    else visible.forEach(marker => layer.addLayer(marker));
    updateAccessControl(markers, visible);
    document.dispatchEvent(new CustomEvent("whiteblock:parking-access-filtered", {
      detail: {
        visible: visible.length,
        total: markers.length,
        activeGroups: [...state.inventoryAccessFilters],
        counts: countsByGroup(markers)
      }
    }));
  }

  function controlMarkup(markers, visible) {
    const counts = countsByGroup(markers);
    const total = markers.length;
    const open = state.inventoryAccessPanelOpen;
    const rows = ORDER.map(group => {
      const def = GROUPS[group];
      const active = state.inventoryAccessFilters.has(group);
      return `<button type="button" class="wb-access-filter-row wb-access-filter-${group}${active ? " is-active" : ""}" data-access-filter="${group}" aria-pressed="${active ? "true" : "false"}"><i></i><span><b>${escape(def.shortLabel)}</b><small>${escape(def.description)}</small></span><strong>${(counts[group] || 0).toLocaleString()}</strong></button>`;
    }).join("");
    return `
      <button type="button" class="wb-access-control-toggle" aria-expanded="${open ? "true" : "false"}">
        <span><b>Parking access</b><small>${visible.length.toLocaleString()} of ${total.toLocaleString()} visible</small></span><strong>${open ? "−" : "+"}</strong>
      </button>
      <div class="wb-access-control-panel"${open ? "" : " hidden"}>
        ${rows}
        <div class="wb-access-control-actions">
          <button type="button" data-access-action="public">Public only</button>
          <button type="button" data-access-action="all">Show all</button>
        </div>
        <p>Unknown ≠ public. Restricted parking is hidden by default.</p>
      </div>`;
  }

  function bindControl(host) {
    host.querySelector(".wb-access-control-toggle")?.addEventListener("click", event => {
      event.preventDefault();
      state.inventoryAccessPanelOpen = !state.inventoryAccessPanelOpen;
      updateAccessControl();
    });

    host.querySelectorAll("[data-access-filter]").forEach(button => {
      button.addEventListener("click", event => {
        event.preventDefault();
        const group = button.dataset.accessFilter;
        if (!GROUPS[group]) return;
        if (state.inventoryAccessFilters.has(group)) state.inventoryAccessFilters.delete(group);
        else state.inventoryAccessFilters.add(group);
        applyMapFilter();
      });
    });

    host.querySelector('[data-access-action="public"]')?.addEventListener("click", event => {
      event.preventDefault();
      state.inventoryAccessFilters = new Set(["public"]);
      applyMapFilter();
    });
    host.querySelector('[data-access-action="all"]')?.addEventListener("click", event => {
      event.preventDefault();
      state.inventoryAccessFilters = new Set(ORDER);
      applyMapFilter();
    });
  }

  function updateAccessControl(markers = inventoryMarkers(), visible = visibleMarkers(markers)) {
    const host = state.inventoryAccessControl?.getContainer?.();
    if (!host) return;
    host.innerHTML = controlMarkup(markers, visible);
    bindControl(host);
  }

  function ensureAccessControl() {
    if (!state.map || typeof L === "undefined") return;
    if (state.inventoryAccessControl) {
      updateAccessControl();
      return;
    }
    const AccessControl = L.Control.extend({
      options: { position: "bottomleft" },
      onAdd() {
        const host = L.DomUtil.create("div", "wb-access-map-control leaflet-bar");
        L.DomEvent.disableClickPropagation(host);
        L.DomEvent.disableScrollPropagation(host);
        host.innerHTML = controlMarkup(inventoryMarkers(), visibleMarkers());
        bindControl(host);
        return host;
      }
    });
    state.inventoryAccessControl = new AccessControl();
    state.inventoryAccessControl.addTo(state.map);
  }

  // Evidence summary ----------------------------------------------------------
  function dublinInventory() {
    return Array.isArray(state.regionInventories?.dublin) ? state.regionInventories.dublin : [];
  }

  function renderEvidenceSummary() {
    const host = document.getElementById("view-evidence");
    const rows = dublinInventory();
    if (!host || !rows.length) return;
    let panel = document.getElementById("dublin-access-evidence-panel");
    if (!panel) {
      panel = document.createElement("section");
      panel.id = "dublin-access-evidence-panel";
      panel.className = "surface wb-access-evidence-panel";
      const table = host.querySelector(".evidence-table");
      if (table) host.insertBefore(panel, table);
      else host.appendChild(panel);
    }

    const counts = Object.fromEntries(ORDER.map(group => [group, 0]));
    rows.forEach(item => { counts[classify(item)] += 1; });
    panel.innerHTML = `
      <div class="wb-access-evidence-head">
        <div><p class="eyebrow">Dublin access evidence</p><h3>Mapped supply is not automatically usable supply.</h3></div>
        <span>${rows.length.toLocaleString()} mapped assets</span>
      </div>
      <div class="wb-access-evidence-grid">
        ${ORDER.map(group => `<article class="wb-access-evidence-card wb-evidence-${group}"><span>${escape(GROUPS[group].shortLabel)}</span><strong>${counts[group].toLocaleString()}</strong><small>${escape(GROUPS[group].description)}</small></article>`).join("")}
      </div>
      <p class="wb-access-evidence-note">Restricted assets remain in the evidence inventory but are excluded from normal recommendations. Unknown access remains unknown until a source verifies it; it is never promoted to public parking by absence of a restriction tag.</p>`;
  }

  function refreshAccessLayer() {
    ensureAccessControl();
    applyMapFilter();
    annotateCards();
    renderEvidenceSummary();
  }

  document.addEventListener("whiteblock:inventory-map-ready", () => window.setTimeout(refreshAccessLayer, 0));
  document.addEventListener("whiteblock:region-inventory-ready", () => window.setTimeout(renderEvidenceSummary, 0));
  document.addEventListener("whiteblock:data-ready", () => window.setTimeout(() => {
    annotateCards();
    renderEvidenceSummary();
  }, 0));

  window.addEventListener("DOMContentLoaded", () => window.setTimeout(() => {
    ensureAccessControl();
    renderEvidenceSummary();
  }, 0));
})();
