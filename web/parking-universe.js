// WHITEBLOCK Phase 1.5 Parking Universe Coverage.
// Displays deployment-derived coverage progress. Scores are programme-readiness
// indicators only and must never be described as literal real-world completeness.

(() => {
  const REPORT_URL = "./data/parking_universe_coverage.json";
  const STATUS_LABELS = {
    integrated: "Integrated",
    ready_to_integrate: "Ready next",
    gap: "Gap"
  };

  function esc(value) {
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

  function pct(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? `${parsed.toFixed(parsed % 1 ? 1 : 0)}%` : "—";
  }

  function familyLabel(value) {
    return String(value || "")
      .replaceAll("_", " ")
      .replace(/\b\w/g, char => char.toUpperCase());
  }

  function regionCard(region) {
    const summary = region.source_family_summary || {};
    const resolution = region.resolution || {};
    const review = region.review_queue || {};
    const gaps = Object.entries(region.source_family_status || {})
      .filter(([, status]) => status !== "integrated")
      .slice(0, 5);

    return `
      <article class="surface universe-region-card">
        <div class="universe-region-head">
          <div>
            <p class="eyebrow">Phase 1.5 · Parking universe</p>
            <h3>${esc(region.label)}</h3>
          </div>
          <span class="universe-readiness">${pct(region.programme_readiness_score)}</span>
        </div>
        <div class="universe-main-stat">
          <strong>${integer(region.known_assets)}</strong>
          <span>known mapped/evidence-backed assets</span>
        </div>
        <div class="universe-resolution-grid">
          <span><small>Access resolved</small><b>${pct(resolution.access?.percent)}</b></span>
          <span><small>Capacity known</small><b>${pct(resolution.capacity?.percent)}</b></span>
          <span><small>Rules/pricing</small><b>${pct(resolution.rules_or_pricing?.percent)}</b></span>
          <span><small>Polygon geometry</small><b>${pct(resolution.polygon_geometry?.percent)}</b></span>
        </div>
        <div class="universe-source-progress">
          <span><b>${integer(summary.integrated)}</b> source families integrated</span>
          <span><b>${integer(summary.ready_to_integrate)}</b> ready next</span>
          <span><b>${integer(summary.gaps)}</b> gaps</span>
        </div>
        <div class="universe-review-strip">
          <span><b>${integer(review.count)}</b> evidence-review tasks</span>
          <span><b>${integer(review.unknown_access)}</b> access unresolved</span>
          <span><b>${integer(region.candidate_count)}</b> deployed candidates</span>
        </div>
        <div class="universe-gap-list">
          ${gaps.length ? gaps.map(([family, status]) => `
            <span class="universe-gap-tag ${esc(status)}">
              ${esc(familyLabel(family))} · ${esc(STATUS_LABELS[status] || status)}
            </span>`).join("") : '<span class="universe-gap-tag integrated">Required source families integrated</span>'}
        </div>
        <p class="universe-note">${esc(region.programme_readiness_note)}</p>
      </article>`;
  }

  function render(report) {
    const host = document.getElementById("parking-universe-coverage");
    if (!host) return;

    const regions = Object.values(report?.regions || {});
    if (!regions.length) {
      host.innerHTML = '<div class="surface universe-empty">Parking Universe coverage report is not available yet.</div>';
      return;
    }

    const evidenceReview = report.evidence_review || {};
    host.innerHTML = `
      <div class="universe-summary surface">
        <div>
          <p class="eyebrow">Phase 1.5 programme</p>
          <h3>Parking Universe Coverage</h3>
          <p>Track the parking WHITEBLOCK already knows, the evidence fields still unresolved, and the source families that remain to be integrated before partnership-led expansion.</p>
        </div>
        <div class="universe-summary-stats">
          <div class="universe-summary-number">
            <strong>${integer(report.known_assets_across_deployed_snapshots)}</strong>
            <span>assets in current deployment snapshots</span>
          </div>
          <div class="universe-summary-number review">
            <strong>${integer(evidenceReview.items)}</strong>
            <span>evidence-resolution tasks</span>
          </div>
        </div>
      </div>
      <div class="universe-region-grid">
        ${regions.map(regionCard).join("")}
      </div>
      <div class="universe-guardrail">
        <strong>Coverage guardrail:</strong> ${esc(report.guardrail || "Coverage progress is not literal real-world completeness.")}
      </div>`;
  }

  async function load() {
    const host = document.getElementById("parking-universe-coverage");
    if (!host) return;
    try {
      const response = await fetch(REPORT_URL, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      render(await response.json());
    } catch (error) {
      console.warn("WHITEBLOCK Parking Universe coverage report unavailable", error);
      host.innerHTML = '<div class="surface universe-empty">Phase 1.5 coverage metrics will appear after the next regional data build.</div>';
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", load, { once: true });
  } else {
    load();
  }
})();
