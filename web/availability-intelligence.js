// WHITEBLOCK Phase 3 availability intelligence.
// Loads a transparent historical baseline built from repeated official Cork observations.
// Guardrail: forecasts are displayed for evaluation but do not influence ranking yet.

(() => {
  const BASELINE_URL = "./data/cork_availability_baseline.json";
  const MIN_SAMPLES = { weekday_hour: 2, hour: 5, overall: 12 };
  const baseParkingCard = parkingCard;

  state.availabilityIntelligence = {
    status: "loading",
    baseline: null,
    error: null
  };

  function numeric(value) {
    return Number.isFinite(Number(value)) ? Number(value) : null;
  }

  function selectedArrivalDate() {
    const value = document.getElementById("arrival")?.value || "";
    const match = value.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;

    const now = new Date();
    const target = new Date(now);
    target.setHours(Number(match[1]), Number(match[2]), 0, 0);

    // Arrival controls express the next occurrence of a clock time.
    if (target.getTime() < now.getTime() - 15 * 60 * 1000) {
      target.setDate(target.getDate() + 1);
    }
    return target;
  }

  function isFuturePlanning(target) {
    return target instanceof Date
      && !Number.isNaN(target.getTime())
      && target.getTime() - Date.now() >= 20 * 60 * 1000;
  }

  function chooseBucket(location, target) {
    if (!location || !target) return null;
    const weekday = (target.getDay() + 6) % 7; // JS Sunday=0 -> Python Monday=0
    const hour = String(target.getHours()).padStart(2, "0");

    const exact = location.weekday_hour?.[`${weekday}-${hour}`];
    if (numeric(exact?.samples) >= MIN_SAMPLES.weekday_hour) {
      return { ...exact, method: "same weekday + hour", specificity: 0.75 };
    }

    const hourly = location.hour?.[hour];
    if (numeric(hourly?.samples) >= MIN_SAMPLES.hour) {
      return { ...hourly, method: "same hour across recent days", specificity: 0.55 };
    }

    const overall = location.overall;
    if (numeric(overall?.samples) >= MIN_SAMPLES.overall) {
      return { ...overall, method: "recent overall history", specificity: 0.35 };
    }
    return null;
  }

  function baselineStrength(bucket) {
    if (!bucket) return null;
    const samples = numeric(bucket.samples) ?? 0;
    const sampleFactor = Math.min(1, Math.sqrt(samples / 24));
    return Math.round(Math.min(0.85, bucket.specificity * sampleFactor) * 100);
  }

  function forecastFor(item) {
    const baseline = state.availabilityIntelligence.baseline;
    const target = selectedArrivalDate();
    if (!baseline || !isFuturePlanning(target)) return null;

    const location = baseline.locations?.[item.id];
    const bucket = chooseBucket(location, target);
    if (!bucket) return null;

    return {
      target,
      predictedAvailable: numeric(bucket.mean_available_spaces),
      predictedOccupancyRatio: numeric(bucket.mean_occupancy_ratio),
      probabilityAnySpace: numeric(bucket.probability_any_space),
      samples: numeric(bucket.samples),
      method: bucket.method,
      historyStrength: baselineStrength(bucket),
      modelVersion: baseline.model?.version || "phase3-naive-v1"
    };
  }

  function formatClock(date) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function forecastMarkup(item) {
    const forecast = forecastFor(item);
    if (!forecast || forecast.predictedAvailable == null) return "";

    const chance = forecast.probabilityAnySpace == null
      ? "probability unavailable"
      : `${Math.round(forecast.probabilityAnySpace * 100)}% of comparable observations had at least one space`;

    return `
      <p class="reason phase3-forecast">
        <strong>Arrival baseline · ${escapeHtml(formatClock(forecast.target))}:</strong>
        ~${escapeHtml(Math.round(forecast.predictedAvailable))} spaces historically free ·
        ${escapeHtml(chance)} ·
        ${escapeHtml(forecast.samples)} samples ·
        ${escapeHtml(forecast.method)} ·
        history strength ${escapeHtml(forecast.historyStrength)}%.
        <em>Experimental Phase 3 baseline; not yet used to rank.</em>
      </p>`;
  }

  parkingCard = function parkingCardWithAvailabilityIntelligence(item, index, options = {}) {
    const html = baseParkingCard(item, index, options);
    if (options?.ineligible) return html;
    const forecast = forecastMarkup(item);
    if (!forecast) return html;
    return html.replace('<div class="phase2-evidence-meta">', `${forecast}<div class="phase2-evidence-meta">`);
  };

  function updateNetworkForecastCard() {
    const card = document.querySelector("#view-network .mini-chart-card");
    if (!card) return;

    const intel = state.availabilityIntelligence;
    if (intel.status === "loading") {
      card.innerHTML = '<p class="eyebrow">Forecast</p><h3>Availability baseline</h3><small>Loading historical observation coverage…</small>';
      return;
    }
    if (intel.status !== "ready" || !intel.baseline) {
      card.innerHTML = '<p class="eyebrow">Forecast</p><h3>Availability baseline</h3><small>Historical baseline unavailable; no forecast values are being invented.</small>';
      return;
    }

    const coverage = intel.baseline.coverage || {};
    const ready = numeric(coverage.forecast_ready_locations) ?? 0;
    const total = numeric(coverage.locations_with_history) ?? 0;
    const observations = numeric(coverage.eligible_observations) ?? 0;

    card.innerHTML = `
      <p class="eyebrow">Phase 3 · Availability intelligence</p>
      <h3>Historical baseline</h3>
      <div class="phase3-network-stats">
        <strong>${escapeHtml(ready)}/${escapeHtml(total)}</strong>
        <span>locations with enough history for the conservative overall fallback</span>
      </div>
      <small>${escapeHtml(observations)} retained official observations · ${escapeHtml(intel.baseline.model?.version || "baseline")} · ranking disabled until evaluation.</small>`;
  }

  function refreshViews() {
    updateNetworkForecastCard();
    if (window.WBSessionRules?.refresh && state.dataStatus === "ready") {
      window.WBSessionRules.refresh();
    } else if (typeof renderParkingList === "function") {
      renderParkingList();
    }
  }

  async function loadBaseline() {
    updateNetworkForecastCard();
    try {
      const response = await fetch(`${BASELINE_URL}?v=${Date.now()}`, {
        cache: "no-store",
        headers: { Accept: "application/json" }
      });
      if (!response.ok) throw new Error(`availability baseline returned ${response.status}`);
      const baseline = await response.json();
      if (!baseline || typeof baseline.locations !== "object") throw new Error("invalid availability baseline");

      state.availabilityIntelligence = { status: "ready", baseline, error: null };
      refreshViews();
      document.dispatchEvent(new CustomEvent("whiteblock:availability-intelligence-ready", {
        detail: baseline.coverage || {}
      }));
    } catch (error) {
      console.warn("WHITEBLOCK Phase 3 availability baseline unavailable", error);
      state.availabilityIntelligence = { status: "unavailable", baseline: null, error: String(error) };
      refreshViews();
    }
  }

  document.getElementById("arrival")?.addEventListener("change", updateNetworkForecastCard);
  document.addEventListener("whiteblock:data-ready", refreshViews);
  loadBaseline();

  window.WBAvailabilityIntelligence = {
    forecastFor,
    selectedArrivalDate,
    chooseBucket,
    baselineStrength,
    refresh: refreshViews
  };
})();
