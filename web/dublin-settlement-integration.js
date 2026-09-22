// WHITEBLOCK County Dublin settlement-audit integration.
// Uses the generated settlement audit as a searchable coverage/evidence layer.
// A settlement anchor is never treated as parking geometry, and a zero mapped-
// inventory count is a research gap rather than proof that no parking exists.

(() => {
  if (typeof state === "undefined") return;

  const AUDIT_URL = "./data/dublin_settlement_audit.json";
  const LEDGER_URL = "./data/dublin_coverage_ledger.json";
  const EXPECTED_RELATIONS = {
    "Dublin City": 1109531,
    "Fingal": 1114164,
    "Dún Laoghaire–Rathdown": 1115720,
    "South Dublin": 1117469
  };

  state.dublinSettlementAuditStatus = "loading";
  state.dublinSettlementAudit = null;
  state.dublinCoverageLedger = null;

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

  function flattenSettlements(audit) {
    return (audit?.local_authorities || []).flatMap(authority =>
      (authority?.settlements || []).map(row => ({
        ...row,
        local_authority: row.local_authority || authority.local_authority,
        relation_id: authority.relation_id
      }))
    );
  }

  function validateAudit(audit) {
    if (audit?.coverage?.scope !== "county_wide_network") throw new Error("Dublin settlement audit is not county-wide");
    if (audit?.coverage?.coverage_claim !== "complete_boundary_traversal_not_complete_real_world_inventory") {
      throw new Error("Dublin settlement audit precision disclaimer missing");
    }
    const authorities = audit?.local_authorities || [];
    if (authorities.length !== 4) throw new Error("Dublin settlement audit is missing a local authority");
    for (const authority of authorities) {
      if (Number(authority.relation_id) !== EXPECTED_RELATIONS[authority.local_authority]) {
        throw new Error(`Dublin settlement audit relation mismatch for ${authority.local_authority || "unknown authority"}`);
      }
    }
  }

  function registerSearchAnchors(audit) {
    if (typeof fallbackPlaces === "undefined") return;
    const rows = flattenSettlements(audit);
    rows.forEach(row => {
      const lat = numeric(row.latitude);
      const lng = numeric(row.longitude);
      if (lat == null || lng == null || !row.settlement) return;
      const authority = row.local_authority || "County Dublin";
      const secondary = `${authority}, County Dublin, Ireland`;
      const alreadyKnown = fallbackPlaces.some(place =>
        String(place.primary || "").localeCompare(String(row.settlement), undefined, { sensitivity: "accent" }) === 0
        && Math.abs(Number(place.lat) - lat) < 0.00001
        && Math.abs(Number(place.lng) - lng) < 0.00001
      );
      if (alreadyKnown) return;

      fallbackPlaces.push({
        primary: row.settlement,
        secondary,
        label: `${row.settlement}, ${secondary}`,
        lat,
        lng,
        type: row.anchor_place_types?.[0] || "place",
        source: "WHITEBLOCK Dublin settlement audit",
        whiteblockCoverageState: row.coverage_state,
        whiteblockMappedParkingAssets: Number(row.mapped_parking_assets || 0),
        whiteblockLocalAuthority: authority
      });
    });
  }

  function auditRowsByPriority(audit) {
    return flattenSettlements(audit).sort((a, b) => {
      const aGap = Number(a.mapped_parking_assets || 0) === 0 ? 0 : 1;
      const bGap = Number(b.mapped_parking_assets || 0) === 0 ? 0 : 1;
      const aUnknown = Number(a.unknown_access_assets || 0);
      const bUnknown = Number(b.unknown_access_assets || 0);
      return aGap - bGap || bUnknown - aUnknown || String(a.settlement || "").localeCompare(String(b.settlement || ""));
    });
  }

  function discoverPanel() {
    const regionList = document.getElementById("discover-region-list");
    if (!regionList) return;
    let panel = document.getElementById("dublin-settlement-audit-panel");
    if (!panel) {
      panel = document.createElement("section");
      panel.id = "dublin-settlement-audit-panel";
      panel.className = "surface";
      panel.style.cssText = "margin:0 0 18px;padding:18px;border-radius:18px;";
      regionList.parentNode.insertBefore(panel, regionList);
    }

    const audit = state.dublinSettlementAudit;
    const ledger = state.dublinCoverageLedger;
    if (!audit) {
      panel.innerHTML = '<p class="eyebrow">County Dublin settlement audit</p><h3 style="margin:5px 0 6px">Loading city, town, suburb and village coverage…</h3>';
      return;
    }

    const summary = audit.summary || {};
    const ledgerSummary = ledger?.summary || {};
    const priority = auditRowsByPriority(audit);
    const gaps = priority.filter(row => Number(row.mapped_parking_assets || 0) === 0).slice(0, 10);
    const gapChips = gaps.map(row =>
      `<span style="border:1px solid rgba(240,190,100,.2);background:#18140b;color:#f4dfb4;border-radius:999px;padding:6px 9px;font:600 11px 'DM Sans';">${escape(row.settlement)} · ${escape(row.local_authority)}</span>`
    ).join("");

    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:14px;align-items:flex-start;flex-wrap:wrap">
        <div>
          <p class="eyebrow">County Dublin settlement audit</p>
          <h3 style="margin:5px 0 6px">${formatInteger(summary.named_settlement_rows)} named places checked against the parking inventory</h3>
          <p style="margin:0;color:#8fa39a;font-size:12px;line-height:1.55;max-width:760px">City → town → village → suburb → neighbourhood coverage is checked independently from the parking list. A zero count means “research gap”, not “no parking”. Settlement coordinates are place anchors and are never used as parking geometry.</p>
        </div>
        <span class="prototype-badge">${escape(audit.anchor_evidence_mode === "same_exact_boundary_snapshot_traversal" ? "Same-boundary evidence" : "Fallback anchor query")}</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:9px;margin-top:14px">
        <div style="padding:11px;border:1px solid rgba(255,255,255,.07);border-radius:12px"><small style="color:#789087">With mapped inventory</small><strong style="display:block;margin-top:4px;font-size:20px">${formatInteger(summary.settlements_with_mapped_inventory)}</strong></div>
        <div style="padding:11px;border:1px solid rgba(255,255,255,.07);border-radius:12px"><small style="color:#789087">Research gaps</small><strong style="display:block;margin-top:4px;font-size:20px">${formatInteger(summary.settlements_without_mapped_inventory)}</strong></div>
        <div style="padding:11px;border:1px solid rgba(255,255,255,.07);border-radius:12px"><small style="color:#789087">Unknown-access assets</small><strong style="display:block;margin-top:4px;font-size:20px">${formatInteger(ledgerSummary.unknown_access_assets)}</strong></div>
        <div style="padding:11px;border:1px solid rgba(255,255,255,.07);border-radius:12px"><small style="color:#789087">Searchable place anchors</small><strong style="display:block;margin-top:4px;font-size:20px">${formatInteger(summary.settlements_with_coordinates)}</strong></div>
      </div>
      ${gaps.length ? `<div style="margin-top:14px"><p style="margin:0 0 8px;color:#8fa39a;font-size:11px">Highest-priority zero-inventory settlement checks</p><div style="display:flex;gap:7px;flex-wrap:wrap">${gapChips}</div></div>` : ""}`;
  }

  function networkPanel() {
    const parent = document.getElementById("dublin-network-panel");
    if (!parent || !state.dublinSettlementAudit) return;
    let section = document.getElementById("dublin-settlement-network-summary");
    if (!section) {
      section = document.createElement("div");
      section.id = "dublin-settlement-network-summary";
      section.style.cssText = "margin-top:14px;padding-top:13px;border-top:1px solid rgba(255,255,255,.07);";
      parent.appendChild(section);
    }
    const summary = state.dublinSettlementAudit.summary || {};
    const ledgerSummary = state.dublinCoverageLedger?.summary || {};
    section.innerHTML = `
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <span style="color:#8fa39a;font-size:11px">Named settlements: <strong style="color:#edf7f1">${formatInteger(summary.named_settlement_rows)}</strong></span>
        <span style="color:#8fa39a;font-size:11px">Research gaps: <strong style="color:#f4dfb4">${formatInteger(summary.settlements_without_mapped_inventory)}</strong></span>
        <span style="color:#8fa39a;font-size:11px">Unknown access: <strong style="color:#edf7f1">${formatInteger(ledgerSummary.unknown_access_assets)}</strong></span>
      </div>
      <p style="margin:7px 0 0;color:#71877e;font-size:11px;line-height:1.45">Search coverage now comes from audited city/town/village/suburb/neighbourhood anchors. Parking recommendations still come only from mapped parking assets and their explicit access/session evidence.</p>`;
  }

  function evidencePanel() {
    const host = document.getElementById("view-evidence");
    if (!host || !state.dublinSettlementAudit) return;
    let panel = document.getElementById("dublin-settlement-evidence-panel");
    if (!panel) {
      panel = document.createElement("section");
      panel.id = "dublin-settlement-evidence-panel";
      panel.className = "surface";
      panel.style.cssText = "margin:0 0 18px;padding:18px;border-radius:18px;";
      const table = host.querySelector(".evidence-table");
      host.insertBefore(panel, table || null);
    }
    const audit = state.dublinSettlementAudit;
    const rows = auditRowsByPriority(audit).slice(0, 8);
    panel.innerHTML = `
      <p class="eyebrow">Dublin coverage evidence</p>
      <h3 style="margin:5px 0 10px">Settlement-level uncertainty queue</h3>
      <div style="display:grid;gap:7px">${rows.map(row => `
        <div style="display:grid;grid-template-columns:minmax(130px,1.3fr) minmax(110px,1fr) 90px 110px;gap:8px;padding:9px 0;border-top:1px solid rgba(255,255,255,.055);font-size:11px">
          <span><strong>${escape(row.settlement)}</strong><small style="display:block;color:#71877e">${escape(row.local_authority)}</small></span>
          <span>${escape((row.anchor_place_types || ["place"]).join(", "))}</span>
          <span>${formatInteger(row.mapped_parking_assets)} assets</span>
          <span>${Number(row.mapped_parking_assets || 0) === 0 ? "Research gap" : `${formatInteger(row.unknown_access_assets)} unknown access`}</span>
        </div>`).join("")}</div>
      <p style="margin:10px 0 0;color:#71877e;font-size:11px">This queue is diagnostic. It does not create parking records and does not infer legal/public access.</p>`;
  }

  function renderAll() {
    discoverPanel();
    networkPanel();
    evidencePanel();
  }

  async function loadJson(url) {
    const response = await fetch(`${url}?v=${Date.now()}`, { cache: "no-store", headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`${url} returned ${response.status}`);
    return response.json();
  }

  async function loadAuditIntegration() {
    try {
      const [audit, ledger] = await Promise.all([loadJson(AUDIT_URL), loadJson(LEDGER_URL)]);
      validateAudit(audit);
      state.dublinSettlementAudit = audit;
      state.dublinCoverageLedger = ledger;
      state.dublinSettlementAuditStatus = "ready";
      registerSearchAnchors(audit);
      renderAll();
      document.dispatchEvent(new CustomEvent("whiteblock:dublin-settlement-audit-ready", {
        detail: {
          namedSettlements: Number(audit?.summary?.named_settlement_rows || 0),
          researchGaps: Number(audit?.summary?.settlements_without_mapped_inventory || 0),
          searchableAnchors: Number(audit?.summary?.settlements_with_coordinates || 0)
        }
      }));
    } catch (error) {
      console.error("WHITEBLOCK Dublin settlement audit unavailable", error);
      state.dublinSettlementAuditStatus = "error";
      renderAll();
    }
  }

  document.addEventListener("whiteblock:data-ready", renderAll);
  document.querySelectorAll('[data-view="discover"], [data-view="network"], [data-view="evidence"]').forEach(button => {
    button.addEventListener("click", () => window.setTimeout(renderAll, 0));
  });

  discoverPanel();
  void loadAuditIntegration();
})();