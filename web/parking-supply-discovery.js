// WHITEBLOCK Phase 4 parking-supply discovery status.
// This view exposes candidate/verification workload only; it never promotes
// imagery detections into driver recommendations.

(() => {
  const REPORT_URL = "./data/parking_supply_discovery.json";
  const CHANGE_URL = "./data/parking_supply_change_report.json";

  const esc = value => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const integer = value => Number.isFinite(Number(value))
    ? Math.round(Number(value)).toLocaleString("en-IE")
    : "—";

  const label = value => String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, char => char.toUpperCase());

  function render(report, changes) {
    const host = document.getElementById("parking-supply-discovery");
    if (!host) return;

    const states = report?.candidate_states || {};
    const automated = report?.automated_detection || {};
    const changeSummary = changes?.summary || {};
    const queue = [
      ["New supply", states.new_supply_candidate],
      ["Geometry review", (states.possible_geometry_extension || 0) + (states.needs_geometry_verification || 0)],
      ["Field verification", states.needs_field_verification],
      ["Low-confidence quarantine", states.low_confidence_quarantine],
    ];

    host.innerHTML = `
      <article class="surface phase4-summary">
        <div>
          <p class="eyebrow">Phase 4 · Parking Supply Discovery</p>
          <h3>Detection → cross-match → verify</h3>
          <p>Imagery evidence is isolated from recommendable parking until physical supply, access and rules are independently verified.</p>
        </div>
        <div class="phase4-summary-metrics">
          <span><strong>${integer(report?.candidate_count)}</strong><small>candidate/review items</small></span>
          <span><strong>${integer(report?.known_assets_cross_matchable)}</strong><small>known assets cross-matchable</small></span>
          <span><strong>${integer(report?.automated_detection_candidates)}</strong><small>automated detections</small></span>
        </div>
      </article>
      <div class="phase4-grid">
        <article class="surface phase4-card">
          <p class="eyebrow">Candidate lifecycle</p>
          <h3>Verification workload</h3>
          <div class="phase4-list">
            ${queue.map(([name, value]) => `<span><small>${esc(name)}</small><b>${integer(value || 0)}</b></span>`).join("")}
          </div>
          <p class="phase4-note">All candidates remain <strong>not recommendable</strong> until promoted through evidence review.</p>
        </article>
        <article class="surface phase4-card">
          <p class="eyebrow">Automated detection</p>
          <h3>${esc(label(automated.status || "unknown"))}</h3>
          <p>The adapter is ${automated.adapter_ready ? "implemented" : "not ready"}, but pixel/model ingestion is fail-closed unless an imagery source is explicitly approved for automated analysis.</p>
          <span class="phase4-pill">${integer((automated.enabled_source_keys || []).length)} licensed source adapters enabled</span>
        </article>
        <article class="surface phase4-card">
          <p class="eyebrow">Change detection</p>
          <h3>${esc(label(changes?.status || "unknown"))}</h3>
          <div class="phase4-list compact">
            <span><small>Appeared</small><b>${integer(changeSummary.appeared || 0)}</b></span>
            <span><small>Expanded</small><b>${integer(changeSummary.expanded || 0)}</b></span>
            <span><small>Contracted</small><b>${integer(changeSummary.contracted || 0)}</b></span>
            <span><small>Disappeared / obscured</small><b>${integer(changeSummary.disappeared_or_obscured || 0)}</b></span>
          </div>
          <p class="phase4-note">A visual change is a verification trigger, never an automatic opening/closure decision.</p>
        </article>
      </div>
      <div class="universe-guardrail"><strong>Phase 4 guardrail:</strong> Imagery can support physical-supply evidence; it cannot establish public access, legal parking rules or live occupancy.</div>
    `;
  }

  async function load() {
    const host = document.getElementById("parking-supply-discovery");
    if (!host) return;
    try {
      const [reportResponse, changeResponse] = await Promise.all([
        fetch(REPORT_URL, { cache: "no-store" }),
        fetch(CHANGE_URL, { cache: "no-store" }),
      ]);
      if (!reportResponse.ok) throw new Error(`discovery report HTTP ${reportResponse.status}`);
      const report = await reportResponse.json();
      const changes = changeResponse.ok ? await changeResponse.json() : { status: "unavailable", summary: {} };

      state.phase4SupplyCandidates = (report.candidates || []).map(candidate => {
        const evidence = (candidate.evidence || [])[0] || {};
        const confidence = Number(evidence.confidence);
        return {
          id: candidate.candidate_id,
          name: candidate.name || "Parking supply candidate",
          area: candidate.region || report.pilot_region || "Cork",
          lat: Number(candidate.centroid?.latitude),
          lng: Number(candidate.centroid?.longitude),
          accessType: "unknown",
          capacity: Number.isFinite(Number(candidate.estimated_capacity)) ? Number(candidate.estimated_capacity) : null,
          available: null,
          confidence: Number.isFinite(confidence) ? Math.round(confidence * 100) : null,
          sourceKey: evidence.source_key || "phase4_candidate_registry",
          truthState: candidate.truth_state || "inferred",
          networkRole: "imagery_candidate",
          candidateState: candidate.candidate_state,
          phase4Candidate: true,
          recommendationEligible: false
        };
      });

      render(report, changes);
      document.dispatchEvent(new CustomEvent("whiteblock:phase4-candidates-ready", {
        detail: { candidates: state.phase4SupplyCandidates.length }
      }));
    } catch (error) {
      console.warn("WHITEBLOCK Phase 4 discovery status unavailable", error);
      host.innerHTML = '<div class="surface universe-empty">Phase 4 discovery status will appear after the next data build.</div>';
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", load, { once: true });
  } else {
    load();
  }
})();
