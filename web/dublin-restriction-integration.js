// WHITEBLOCK County Dublin parking restriction/access evidence integration.
// This layer visualises only source-published access, maximum-stay and opening-
// hours evidence. It never invents a default supermarket/retail parking rule.

(() => {
  if (typeof state === "undefined") return;

  const AUDIT_URL = "./data/dublin_restriction_audit.json";
  const EXPECTED_RELATIONS = {
    "Dublin City": 1109531,
    "Fingal": 1114164,
    "Dún Laoghaire–Rathdown": 1115720,
    "South Dublin": 1117469
  };

  state.dublinRestrictionAuditStatus = "loading";
  state.dublinRestrictionAudit = null;

  function escape(value) {
    if (typeof escapeHtml === "function") return escapeHtml(value ?? "");
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function integer(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.round(parsed).toLocaleString("en-IE") : "—";
  }

  function percent(part, whole) {
    const p = Number(part);
    const w = Number(whole);
    if (!Number.isFinite(p) || !Number.isFinite(w) || w <= 0) return "—";
    return `${Math.round((p / w) * 100)}%`;
  }

  function validateAudit(audit) {
    if (audit?.coverage?.scope !== "county_wide_network") throw new Error("Dublin restriction audit is not county-wide");
    if (audit?.coverage?.coverage_claim !== "complete_boundary_traversal_not_complete_real_world_inventory") {
      throw new Error("Dublin restriction audit precision disclaimer missing");
    }
    const actual = audit?.coverage?.local_authority_relation_ids || {};
    for (const [authority, relationId] of Object.entries(EXPECTED_RELATIONS)) {
      if (Number(actual[authority]) !== relationId) throw new Error(`Dublin restriction relation mismatch for ${authority}`);
    }
    if (Number(audit?.summary?.parking_assets || 0) <= 0) throw new Error("Dublin restriction audit contains no parking assets");
  }

  function researchQueue(audit) {
    return (audit?.settlement_rule_gaps || [])
      .filter(row => Number(row.unknown_access_assets || 0) > 0)
      .sort((a, b) => Number(b.unknown_access_assets || 0) - Number(a.unknown_access_assets || 0));
  }

  function discoverPanel() {
    const regionList = document.getElementById("discover-region-list");
    if (!regionList) return;
    let panel = document.getElementById("dublin-restriction-discover-panel");
    if (!panel) {
      panel = document.createElement("section");
      panel.id = "dublin-restriction-discover-panel";
      panel.className = "surface";
      panel.style.cssText = "margin:0 0 18px;padding:18px;border-radius:18px;";
      regionList.parentNode.insertBefore(panel, regionList);
    }

    const audit = state.dublinRestrictionAudit;
    if (!audit) {
      panel.innerHTML = '<p class="eyebrow">Parking rules evidence</p><h3 style="margin:5px 0 6px">Loading Dublin access and stay rules…</h3>';
      return;
    }

    const s = audit.summary || {};
    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:14px;align-items:flex-start;flex-wrap:wrap">
        <div>
          <p class="eyebrow">Parking rules evidence · County Dublin</p>
          <h3 style="margin:5px 0 6px">Customer access, maximum stay and opening hours are now separated from “free parking”</h3>
          <p style="margin:0;color:#8fa39a;font-size:12px;line-height:1.55;max-width:780px">WHITEBLOCK only applies a duration or access restriction when the source publishes it. Customer-only parking stays conditional; a two-hour supermarket rule is never assumed just because a car park is beside a shop.</p>
        </div>
        <span class="prototype-badge">Source-published rules only</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:9px;margin-top:14px">
        <div style="padding:11px;border:1px solid rgba(255,255,255,.07);border-radius:12px"><small style="color:#789087">Customer-only assets</small><strong style="display:block;margin-top:4px;font-size:20px">${integer(s.customer_only_assets)}</strong></div>
        <div style="padding:11px;border:1px solid rgba(255,255,255,.07);border-radius:12px"><small style="color:#789087">Max stay published</small><strong style="display:block;margin-top:4px;font-size:20px">${integer(s.max_stay_published_assets)}</strong><small style="color:#71877e">${percent(s.max_stay_published_assets, s.parking_assets)} of mapped assets</small></div>
        <div style="padding:11px;border:1px solid rgba(255,255,255,.07);border-radius:12px"><small style="color:#789087">Opening hours published</small><strong style="display:block;margin-top:4px;font-size:20px">${integer(s.opening_hours_published_assets)}</strong><small style="color:#71877e">${percent(s.opening_hours_published_assets, s.parking_assets)} of mapped assets</small></div>
        <div style="padding:11px;border:1px solid rgba(255,255,255,.07);border-radius:12px"><small style="color:#789087">Unknown access</small><strong style="display:block;margin-top:4px;font-size:20px">${integer(s.unknown_access_assets)}</strong><small style="color:#71877e">research queue</small></div>
      </div>`;
  }

  function networkPanel() {
    const host = document.getElementById("dublin-network-panel");
    if (!host || !state.dublinRestrictionAudit) return;
    let section = document.getElementById("dublin-restriction-network-summary");
    if (!section) {
      section = document.createElement("div");
      section.id = "dublin-restriction-network-summary";
      section.style.cssText = "margin-top:13px;padding-top:12px;border-top:1px solid rgba(255,255,255,.07);";
      host.appendChild(section);
    }
    const s = state.dublinRestrictionAudit.summary || {};
    section.innerHTML = `
      <div style="display:flex;gap:10px;flex-wrap:wrap;font-size:11px;color:#8fa39a">
        <span>Customer-only: <strong style="color:#edf7f1">${integer(s.customer_only_assets)}</strong></span>
        <span>Max-stay evidence: <strong style="color:#edf7f1">${integer(s.max_stay_published_assets)}</strong></span>
        <span>Opening-hours evidence: <strong style="color:#edf7f1">${integer(s.opening_hours_published_assets)}</strong></span>
        <span>Unknown access: <strong style="color:#f4dfb4">${integer(s.unknown_access_assets)}</strong></span>
      </div>
      <p style="margin:7px 0 0;color:#71877e;font-size:11px;line-height:1.45">These are rule-evidence counts, not live availability. Unknown access stays unknown; customer-only parking remains conditional.</p>`;
  }

  function evidencePanel() {
    const host = document.getElementById("view-evidence");
    if (!host || !state.dublinRestrictionAudit) return;
    let panel = document.getElementById("dublin-restriction-evidence-panel");
    if (!panel) {
      panel = document.createElement("section");
      panel.id = "dublin-restriction-evidence-panel";
      panel.className = "surface";
      panel.style.cssText = "margin:0 0 18px;padding:18px;border-radius:18px;";
      const settlementPanel = document.getElementById("dublin-settlement-evidence-panel");
      if (settlementPanel?.nextSibling) host.insertBefore(panel, settlementPanel.nextSibling);
      else host.appendChild(panel);
    }

    const audit = state.dublinRestrictionAudit;
    const queue = researchQueue(audit).slice(0, 10);
    panel.innerHTML = `
      <p class="eyebrow">Dublin access evidence</p>
      <h3 style="margin:5px 0 6px">Unknown-access research queue</h3>
      <p style="margin:0 0 10px;color:#8fa39a;font-size:12px;line-height:1.5">Prioritised settlements where mapped parking exists but source-published public/customer/private access is still incomplete.</p>
      <div style="display:grid;gap:6px">${queue.map(row => `
        <div style="display:grid;grid-template-columns:minmax(135px,1.35fr) minmax(110px,1fr) 90px 90px;gap:8px;padding:9px 0;border-top:1px solid rgba(255,255,255,.055);font-size:11px">
          <span><strong>${escape(row.settlement)}</strong><small style="display:block;color:#71877e">${escape(row.local_authority)}</small></span>
          <span>${integer(row.parking_assets)} mapped assets</span>
          <span>${integer(row.unknown_access_assets)} unknown</span>
          <span>${integer(row.customer_only_assets)} customer-only</span>
        </div>`).join("")}</div>
      <p style="margin:10px 0 0;color:#71877e;font-size:11px">Research priority does not change access classification. An asset is reclassified only when additional evidence is actually added to the source/enrichment layer.</p>`;
  }

  function renderAll() {
    discoverPanel();
    networkPanel();
    evidencePanel();
  }

  async function loadAudit() {
    try {
      const response = await fetch(`${AUDIT_URL}?v=${Date.now()}`, { cache: "no-store", headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`${AUDIT_URL} returned ${response.status}`);
      const audit = await response.json();
      validateAudit(audit);
      state.dublinRestrictionAudit = audit;
      state.dublinRestrictionAuditStatus = "ready";
      renderAll();
      document.dispatchEvent(new CustomEvent("whiteblock:dublin-restriction-audit-ready", {
        detail: {
          parkingAssets: Number(audit?.summary?.parking_assets || 0),
          customerOnly: Number(audit?.summary?.customer_only_assets || 0),
          unknownAccess: Number(audit?.summary?.unknown_access_assets || 0)
        }
      }));
    } catch (error) {
      console.error("WHITEBLOCK Dublin restriction audit unavailable", error);
      state.dublinRestrictionAuditStatus = "error";
      renderAll();
    }
  }

  document.addEventListener("whiteblock:data-ready", renderAll);
  document.querySelectorAll('[data-view="discover"], [data-view="network"], [data-view="evidence"]').forEach(button => {
    button.addEventListener("click", () => window.setTimeout(renderAll, 0));
  });

  discoverPanel();
  void loadAudit();
})();
