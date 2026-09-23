// WHITEBLOCK Dublin venue-parking knowledge layer.
// Adds searchable fuel/retail venue anchors and evidence context without
// promoting venue opening hours, proximity or imagery candidates into legal
// parking permission.

(() => {
  if (typeof state === "undefined" || typeof haversineKm !== "function") return;

  const KNOWLEDGE_URL = "./data/dublin_venue_knowledge.json";
  const EXPECTED_RELATIONS = {
    "Dublin City": 1109531,
    "Fingal": 1114164,
    "Dún Laoghaire–Rathdown": 1115720,
    "South Dublin": 1117469
  };

  state.dublinVenueKnowledgeStatus = "loading";
  state.dublinVenueKnowledge = null;
  state.activeVenueKnowledge = null;

  function escape(value) {
    if (typeof escapeHtml === "function") return escapeHtml(value ?? "");
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function validateKnowledge(data) {
    if (data?.coverage?.scope !== "county_wide_network") throw new Error("Dublin venue knowledge is not county-wide");
    if (data?.coverage?.coverage_claim !== "complete_boundary_traversal_not_complete_real_world_inventory") {
      throw new Error("Dublin venue knowledge precision disclaimer missing");
    }
    const actual = data?.coverage?.local_authority_relation_ids || {};
    Object.entries(EXPECTED_RELATIONS).forEach(([authority, relationId]) => {
      if (Number(actual[authority]) !== relationId) throw new Error(`Dublin venue relation mismatch for ${authority}`);
    });
    if (!Array.isArray(data?.venues)) throw new Error("Dublin venue knowledge has no venue collection");
  }

  function categoryLabel(value) {
    return String(value || "venue")
      .replaceAll("_", " ")
      .replace(/\b\w/g, letter => letter.toUpperCase());
  }

  function registerVenueSearchAnchors() {
    if (!state.dublinVenueKnowledge || typeof fallbackPlaces === "undefined" || !Array.isArray(fallbackPlaces)) return;
    const existing = new Set(fallbackPlaces.map(place => `${String(place.primary || "").toLowerCase()}|${Number(place.lat).toFixed(4)}|${Number(place.lng).toFixed(4)}`));

    state.dublinVenueKnowledge.venues
      .filter(venue => venue?.name && Number.isFinite(Number(venue.latitude)) && Number.isFinite(Number(venue.longitude)))
      .forEach(venue => {
        const key = `${String(venue.name).toLowerCase()}|${Number(venue.latitude).toFixed(4)}|${Number(venue.longitude).toFixed(4)}`;
        if (existing.has(key)) return;
        existing.add(key);
        fallbackPlaces.push({
          primary: venue.name,
          secondary: `${categoryLabel(venue.category)} · ${venue.local_authority}, County Dublin, Ireland`,
          label: `${venue.name}, ${venue.local_authority}, County Dublin, Ireland`,
          lat: Number(venue.latitude),
          lng: Number(venue.longitude),
          type: venue.category,
          source: "WHITEBLOCK Dublin venue knowledge",
          venueKnowledgeId: venue.venue_id
        });
      });
  }

  function nearestVenue(destination = state.destination) {
    if (!destination || !state.dublinVenueKnowledge) return null;
    let best = null;
    let distance = Infinity;
    state.dublinVenueKnowledge.venues.forEach(venue => {
      const lat = Number(venue.latitude);
      const lng = Number(venue.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const d = haversineKm(Number(destination.lat), Number(destination.lng), lat, lng);
      if (d < distance) {
        best = venue;
        distance = d;
      }
    });
    return best && distance <= 0.30 ? { venue: best, distanceKm: distance } : null;
  }

  function usableLinks(venue) {
    return (venue?.parking_links || []).filter(link =>
      ["public_parking_nearby", "conditional_customer_parking"].includes(link.suggestion_state)
    );
  }

  function enrichDublinInventory() {
    if (!state.dublinVenueKnowledge || !Array.isArray(state.regionInventories?.dublin)) return;
    const byParking = new Map();
    state.dublinVenueKnowledge.venues.forEach(venue => {
      (venue.parking_links || []).forEach(link => {
        if (!link.parking_id) return;
        const rows = byParking.get(link.parking_id) || [];
        rows.push({
          venueId: venue.venue_id,
          venueName: venue.name,
          venueCategory: venue.category,
          venueOpen24x7: venue.venue_open_24_7 === true,
          associationState: link.association_state,
          associationTruthState: link.association_truth_state,
          suggestionState: link.suggestion_state,
          distanceM: link.distance_m,
          policy: venue.policy
        });
        byParking.set(link.parking_id, rows);
      });
    });

    state.regionInventories.dublin = state.regionInventories.dublin.map(item => ({
      ...item,
      venueAssociations: byParking.get(item.id) || []
    }));

    if (state.activeRegion === "dublin") {
      parkingData = state.regionInventories.dublin.map(item => ({ ...item }));
      if (typeof renderParkingList === "function") renderParkingList();
    }
  }

  function renderDestinationVenueContext() {
    const match = nearestVenue();
    state.activeVenueKnowledge = match?.venue || null;
    if (!match || state.activeRegion !== "dublin") return;

    const venue = match.venue;
    const links = usableLinks(venue);
    const open = venue.venue_open_24_7 ? "Venue reports 24/7 opening" : (venue.opening_hours_raw ? `Venue hours: ${venue.opening_hours_raw}` : "Venue hours not published in this layer");
    const parkingCopy = links.length
      ? `${links.length} mapped parking option${links.length === 1 ? "" : "s"} have public/customer evidence nearby.`
      : "Mapped venue parking is not yet verified; do not assume the premises can be used for parking.";

    if (typeof setMapStatus === "function") {
      setMapStatus(
        `${categoryLabel(venue.category)} parking context`,
        `${parkingCopy} ${open}. Opening hours are not parking permission.`
      );
    }
  }

  function installDestinationHook() {
    if (typeof applyDestinationContext !== "function" || applyDestinationContext.__wbVenueKnowledgeWrapped) return;
    const previous = applyDestinationContext;
    const wrapped = function whiteblockVenueDestinationContext(options = {}) {
      const result = previous(options);
      window.setTimeout(renderDestinationVenueContext, 0);
      return result;
    };
    wrapped.__wbVenueKnowledgeWrapped = true;
    applyDestinationContext = wrapped;
  }

  function discoverPanel() {
    const regionList = document.getElementById("discover-region-list");
    if (!regionList) return;
    let panel = document.getElementById("dublin-venue-knowledge-panel");
    if (!panel) {
      panel = document.createElement("section");
      panel.id = "dublin-venue-knowledge-panel";
      panel.className = "surface";
      panel.style.cssText = "margin:0 0 18px;padding:18px;border-radius:18px;";
      regionList.parentNode.insertBefore(panel, regionList);
    }

    const data = state.dublinVenueKnowledge;
    if (!data) {
      panel.innerHTML = '<p class="eyebrow">Venue parking knowledge · Dublin</p><h3 style="margin:5px 0 6px">Loading fuel and retail parking evidence…</h3>';
      return;
    }
    const s = data.summary || {};
    const categories = s.venue_categories || {};
    panel.innerHTML = `
      <p class="eyebrow">Venue parking knowledge · County Dublin</p>
      <h3 style="margin:5px 0 6px">Fuel stations and retail destinations are now parking opportunities — but only conditionally</h3>
      <p style="margin:0;color:#8fa39a;font-size:12px;line-height:1.55;max-width:820px">WHITEBLOCK searches fuel/service areas, supermarkets, shopping centres, department stores and named retail areas. A 24/7 venue is never treated as 24/7 parking permission. Customer access, maximum stay and opening-hour evidence remain separate.</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:9px;margin-top:14px">
        <div style="padding:11px;border:1px solid rgba(255,255,255,.07);border-radius:12px"><small style="color:#789087">Venues checked</small><strong style="display:block;margin-top:4px;font-size:20px">${Number(s.venues || 0).toLocaleString("en-IE")}</strong></div>
        <div style="padding:11px;border:1px solid rgba(255,255,255,.07);border-radius:12px"><small style="color:#789087">Fuel stations</small><strong style="display:block;margin-top:4px;font-size:20px">${Number(categories.fuel_station || 0).toLocaleString("en-IE")}</strong></div>
        <div style="padding:11px;border:1px solid rgba(255,255,255,.07);border-radius:12px"><small style="color:#789087">Shopping + supermarket</small><strong style="display:block;margin-top:4px;font-size:20px">${Number((categories.shopping_centre || 0) + (categories.supermarket || 0) + (categories.department_store || 0)).toLocaleString("en-IE")}</strong></div>
        <div style="padding:11px;border:1px solid rgba(255,255,255,.07);border-radius:12px"><small style="color:#789087">Imagery review queue</small><strong style="display:block;margin-top:4px;font-size:20px">${Number(s.imagery_review_queue || 0).toLocaleString("en-IE")}</strong><small style="color:#71877e">candidates, not parking</small></div>
      </div>`;
  }

  function evidencePanel() {
    const host = document.getElementById("view-evidence");
    if (!host || !state.dublinVenueKnowledge) return;
    let panel = document.getElementById("dublin-imagery-evidence-panel");
    if (!panel) {
      panel = document.createElement("section");
      panel.id = "dublin-imagery-evidence-panel";
      panel.className = "surface";
      panel.style.cssText = "margin:0 0 18px;padding:18px;border-radius:18px;";
      host.appendChild(panel);
    }
    const queue = (state.dublinVenueKnowledge.imagery_review_queue || []).slice(0, 12);
    panel.innerHTML = `
      <p class="eyebrow">Dublin imagery review queue</p>
      <h3 style="margin:5px 0 6px">Physical parking candidates that still need access evidence</h3>
      <p style="margin:0 0 10px;color:#8fa39a;font-size:12px;line-height:1.5">High-resolution aerial/satellite review can identify a paved/open-air parking footprint. It cannot prove the public may park there, how long they may stay, or how many spaces are free now.</p>
      <div style="display:grid;gap:6px">${queue.map(row => `
        <div style="display:grid;grid-template-columns:minmax(160px,1.4fr) minmax(100px,.8fr) 85px;gap:8px;padding:9px 0;border-top:1px solid rgba(255,255,255,.055);font-size:11px">
          <span><strong>${escape(row.name)}</strong><small style="display:block;color:#71877e">${escape(row.local_authority)} · ${escape(categoryLabel(row.category))}</small></span>
          <span>${escape(String(row.reason || "review required").replaceAll("_", " "))}</span>
          <span>${escape(row.priority)} priority</span>
        </div>`).join("")}</div>
      <p style="margin:10px 0 0;color:#71877e;font-size:11px">Candidate → imagery/venue-source review → access/stay verification → parking inventory. The layer never skips directly from imagery to “recommended parking”.</p>`;
  }

  function renderAll() {
    discoverPanel();
    evidencePanel();
    renderDestinationVenueContext();
  }

  async function loadKnowledge() {
    try {
      const response = await fetch(`${KNOWLEDGE_URL}?v=${Date.now()}`, { cache: "no-store", headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`${KNOWLEDGE_URL} returned ${response.status}`);
      const data = await response.json();
      validateKnowledge(data);
      state.dublinVenueKnowledge = data;
      state.dublinVenueKnowledgeStatus = "ready";
      registerVenueSearchAnchors();
      enrichDublinInventory();
      installDestinationHook();
      renderAll();
      document.dispatchEvent(new CustomEvent("whiteblock:dublin-venue-knowledge-ready", {
        detail: {
          venues: Number(data?.summary?.venues || 0),
          imageryCandidates: Number(data?.summary?.imagery_review_queue || 0),
          open24x7Venues: Number(data?.summary?.open_24_7_venues || 0)
        }
      }));
    } catch (error) {
      console.error("WHITEBLOCK Dublin venue knowledge unavailable", error);
      state.dublinVenueKnowledgeStatus = "error";
      renderAll();
    }
  }

  document.addEventListener("whiteblock:data-ready", () => window.setTimeout(() => {
    enrichDublinInventory();
    renderAll();
  }, 0));
  document.querySelectorAll('[data-view="discover"], [data-view="evidence"]').forEach(button => {
    button.addEventListener("click", () => window.setTimeout(renderAll, 0));
  });

  installDestinationHook();
  discoverPanel();
  void loadKnowledge();
})();
