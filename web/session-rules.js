// WHITEBLOCK parking-session eligibility layer.
// Eligibility is evaluated before ranking: a parking asset that cannot legally or
// operationally accommodate the requested session is not shown as a normal recommendation.

(() => {
  const NEARBY_RADIUS_KM = 10;
  const MAX_RESULTS = 8;
  const MAX_INELIGIBLE_RESULTS = 5;

  const baseSetKpiMode = setKpiMode;
  const baseMarkerHtml = markerHtml;

  function numeric(value) {
    return Number.isFinite(Number(value)) ? Number(value) : null;
  }

  function requestedStayMinutes() {
    const select = document.getElementById("duration");
    const direct = numeric(select?.value);
    if (direct != null) return direct;
    const label = String(select?.selectedOptions?.[0]?.textContent || "").toLowerCase();
    const hours = label.match(/([0-9]+(?:\.[0-9]+)?)\s*hour/);
    if (hours) return Math.round(Number(hours[1]) * 60);
    const minutes = label.match(/([0-9]+)\s*min/);
    return minutes ? Number(minutes[1]) : 120;
  }

  function requestedArrivalMinutes() {
    const value = document.getElementById("arrival")?.value || "";
    const match = value.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
  }

  function formatDuration(minutes) {
    const value = Math.max(0, Math.round(Number(minutes) || 0));
    if (value < 60) return `${value} min`;
    const hours = Math.floor(value / 60);
    const remainder = value % 60;
    if (!remainder) return `${hours}h`;
    return `${hours}h ${remainder}m`;
  }

  function formatClock(minutes) {
    const value = ((minutes % 1440) + 1440) % 1440;
    const h = String(Math.floor(value / 60)).padStart(2, "0");
    const m = String(value % 60).padStart(2, "0");
    return `${h}:${m}`;
  }

  function parseDailyOpeningWindow(raw) {
    const text = String(raw || "").trim();
    if (!text) return null;
    const lower = text.toLowerCase();
    if (/\b(24\s*\/\s*7|24\s*hours?|open\s*24)\b/.test(lower)) {
      return { always: true, label: "24h" };
    }

    // Day-specific schedules are deliberately not guessed. We only enforce a
    // single daily/Mon-Sun window that can be interpreted without ambiguity.
    const hasDayToken = /\b(mon|tue|wed|thu|fri|sat|sun|mo|tu|we|th|fr|sa|su)\b/i.test(text);
    const explicitlyDaily = /\b(daily|every\s*day|all\s*days|mon\s*-\s*sun|monday\s*-\s*sunday|mo\s*-\s*su)\b/i.test(text);
    if (hasDayToken && !explicitlyDaily) return null;

    const matches = [...text.matchAll(/(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})/g)];
    if (matches.length !== 1) return null;
    const match = matches[0];
    const startHour = Number(match[1]);
    const startMinute = Number(match[2]);
    const endHour = Number(match[3]);
    const endMinute = Number(match[4]);
    if (startHour > 23 || endHour > 23 || startMinute > 59 || endMinute > 59) return null;

    const start = startHour * 60 + startMinute;
    const end = endHour * 60 + endMinute;
    return { always: false, start, end, label: `${formatClock(start)}–${formatClock(end)}` };
  }

  function sessionFitsWindow(arrivalMinutes, stayMinutes, window) {
    if (!window || window.always || arrivalMinutes == null) return true;
    let windowStart = window.start;
    let windowEnd = window.end;
    let sessionStart = arrivalMinutes;
    let sessionEnd = arrivalMinutes + stayMinutes;

    if (windowEnd <= windowStart) {
      windowEnd += 1440;
      if (sessionStart < windowStart) {
        sessionStart += 1440;
        sessionEnd += 1440;
      }
    }
    return sessionStart >= windowStart && sessionEnd <= windowEnd;
  }

  function accessLabel(accessType) {
    const value = String(accessType || "unknown").toLowerCase();
    if (value === "customer") return "Customers only";
    if (value === "public") return "Public parking";
    if (value === "permit") return "Permit only";
    if (value === "private") return "Private parking";
    if (value === "restricted") return "Restricted access";
    return "Access not verified";
  }

  function evaluate(item) {
    const stayMinutes = requestedStayMinutes();
    const arrivalMinutes = requestedArrivalMinutes();
    const maxStay = numeric(item.maxStayMinutes ?? item.maximumStayMinutes ?? item.maximum_stay_minutes);
    const accessType = String(item.accessType || item.access_type || "unknown").toLowerCase();
    const openingHoursRaw = item.openingHoursRaw || item.opening_hours_raw || null;
    const openingWindow = parseDailyOpeningWindow(openingHoursRaw);
    const reasons = [];
    let eligible = true;
    let nearLimit = false;

    if (["private", "permit", "restricted"].includes(accessType)) {
      eligible = false;
      reasons.push(accessLabel(accessType));
    }

    if (maxStay != null && maxStay > 0) {
      if (stayMinutes > maxStay) {
        eligible = false;
        reasons.push(`Maximum stay ${formatDuration(maxStay)}`);
      } else {
        const buffer = Math.min(15, Math.max(10, Math.round(maxStay * 0.10)));
        if (maxStay - stayMinutes <= buffer) nearLimit = true;
      }
    }

    if (openingWindow && !sessionFitsWindow(arrivalMinutes, stayMinutes, openingWindow)) {
      eligible = false;
      reasons.push(`Requested session exceeds opening window ${openingWindow.label}`);
    }

    const conditionalCustomer = accessType === "customer";
    const fitLabel = !eligible
      ? "Does not fit your stay"
      : nearLimit
        ? "Near stay limit"
        : maxStay != null || openingWindow
          ? `Fits your ${formatDuration(stayMinutes)} stay`
          : "Session rule not fully published";

    return {
      eligible,
      nearLimit,
      conditionalCustomer,
      accessType,
      accessLabel: accessLabel(accessType),
      maxStayMinutes: maxStay,
      maxStayLabel: maxStay != null && maxStay > 0 ? `${formatDuration(maxStay)} max` : "Max stay not published",
      openingHoursRaw,
      openingWindow,
      fitLabel,
      reason: reasons.join(" · ") || (conditionalCustomer ? "Use subject to customer parking rules" : "Session fits known restrictions"),
      stayMinutes,
      riskPenalty: (nearLimit ? 0.15 : 0) + (conditionalCustomer ? 0.08 : 0) + (accessType === "unknown" ? 0.03 : 0)
    };
  }

  function estimateWalkMinutes(distanceKm) {
    if (!Number.isFinite(distanceKm)) return null;
    return Math.max(1, Math.round((distanceKm * 1.22 / 4.8) * 60));
  }

  function enrich(item) {
    const clone = { ...item };
    if (state.destination && Number.isFinite(clone.lat) && Number.isFinite(clone.lng)) {
      clone.distanceKm = haversineKm(state.destination.lat, state.destination.lng, clone.lat, clone.lng);
      clone.walk = estimateWalkMinutes(clone.distanceKm);
    }
    clone.sessionRule = evaluate(clone);

    const observed = clone.available != null && clone.capacity != null
      ? `${Math.round(clone.available)} of ${Math.round(clone.capacity)} spaces reported free`
      : "availability is not currently reported";
    const distance = clone.distanceKm != null
      ? `${clone.distanceKm.toFixed(1)} km from the selected destination`
      : "distance pending";
    clone.reason = `${observed}; ${distance}.`;
    return clone;
  }

  function preparedData() {
    let data = parkingData
      .map(enrich)
      .filter(item => Number.isFinite(item.lat) && Number.isFinite(item.lng));

    if (state.destination) {
      data = data.filter(item => item.distanceKm != null && item.distanceKm <= NEARBY_RADIUS_KM);
    }

    if (state.filter === "accessible") data = data.filter(item => item.accessible === true);
    if (state.filter === "ev") data = data.filter(item => item.ev === true);
    return data;
  }

  score = function scoreWithSessionRules(item) {
    const availability = item.available != null && item.capacity > 0 ? item.available / item.capacity : 0.3;
    const distance = item.distanceKm != null ? Math.max(0, 1 - item.distanceKm / NEARBY_RADIUS_KM) : 0.2;
    const confidence = (numeric(item.confidence) ?? 0) / 100;
    const price = item.price != null ? Math.max(0, 1 - item.price / 10) : 0.4;
    const rule = item.sessionRule || evaluate(item);
    return availability * 0.36 + distance * 0.29 + confidence * 0.20 + price * 0.05 + 0.10 - rule.riskPenalty;
  };

  function sortData(data) {
    if (state.filter === "closest") data.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
    else if (state.filter === "cheapest") data.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    else data.sort((a, b) => score(b) - score(a));
    return data;
  }

  currentData = function currentSessionEligibleData() {
    return sortData(preparedData().filter(item => item.sessionRule.eligible)).slice(0, MAX_RESULTS);
  };

  function ineligibleData() {
    return preparedData()
      .filter(item => !item.sessionRule.eligible)
      .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
      .slice(0, MAX_INELIGIBLE_RESULTS);
  }

  function ruleChips(item) {
    const rule = item.sessionRule || evaluate(item);
    const classes = rule.eligible ? (rule.nearLimit ? " near" : " good") : " blocked";
    const hours = rule.openingWindow
      ? `<span class="parking-rule-chip">Hours ${escapeHtml(rule.openingWindow.label)}</span>`
      : rule.openingHoursRaw
        ? `<span class="parking-rule-chip">Hours published</span>`
        : "";
    return `
      <div class="parking-rule-row">
        <span class="parking-rule-chip access-${escapeHtml(rule.accessType)}">${escapeHtml(rule.accessLabel)}</span>
        <span class="parking-rule-chip">${escapeHtml(rule.maxStayLabel)}</span>
        ${hours}
        <span class="parking-rule-chip rule-fit${classes}">${escapeHtml(rule.fitLabel)}</span>
      </div>`;
  }

  parkingCard = function parkingCardWithRules(item, index, { ineligible = false } = {}) {
    const availability = availabilityLabel(item);
    const selected = item.id === state.selectedId ? " selected" : "";
    const availabilityCopy = item.available != null ? `${Math.round(item.available)} spaces` : "availability unknown";
    const distance = item.distanceKm != null ? `${item.distanceKm.toFixed(1)} km` : "—";
    const walk = item.walk != null ? `~${item.walk} min` : "—";
    const price = item.pricingRaw || (item.price != null ? `€${Number(item.price).toFixed(2)}` : "Tariff not published");
    const rule = item.sessionRule || evaluate(item);
    const cardClass = ineligible ? " parking-card-ineligible" : rule.nearLimit ? " parking-card-near-limit" : "";

    return `
      <article class="parking-card surface${selected}${cardClass}" data-parking-id="${escapeHtml(item.id)}" tabindex="0" role="button" aria-label="View ${escapeHtml(item.name)} on map">
        <div class="parking-top">
          <div class="parking-rank">
            <span class="rank">${ineligible ? "×" : String(index + 1).padStart(2, "0")}</span>
            <div class="parking-title">
              <h3>${escapeHtml(item.name)}</h3>
              <small>${escapeHtml(item.area || "Cork")} · ${escapeHtml(item.id.replace("WB-PARK-IE-CORK-", "WB-"))}</small>
            </div>
          </div>
          <div class="availability">
            <strong>${escapeHtml(ineligible ? "Not suitable" : availability.text)}</strong>
            <small>${escapeHtml(availabilityCopy)}</small>
          </div>
        </div>
        ${ruleChips(item)}
        <div class="parking-meta">
          <span>Distance<b>${escapeHtml(distance)}</b></span>
          <span>Est. walk<b>${escapeHtml(walk)}</b></span>
          <span>Confidence<b>${item.confidence ?? "—"}%</b></span>
        </div>
        <p class="reason"><strong>Price:</strong> ${escapeHtml(price)}</p>
        <p class="reason"><strong>${ineligible ? "Why excluded" : "Session"}:</strong> ${escapeHtml(rule.reason)}</p>
        ${rule.conditionalCustomer ? '<p class="parking-customer-warning">Customer parking is conditional access, not general public parking. Check on-site signage.</p>' : ""}
      </article>`;
  };

  function bindParkingCards(container) {
    container?.querySelectorAll(".parking-card").forEach(card => {
      const select = () => selectParking(card.dataset.parkingId);
      card.addEventListener("click", select);
      card.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          select();
        }
      });
    });
  }

  renderParkingList = function renderParkingListWithRules() {
    const list = document.getElementById("parking-list");
    const excluded = document.getElementById("parking-ineligible");
    if (!list) return;

    const count = document.querySelector(".result-count");
    const coverageMessage = document.getElementById("coverage-message");
    const inPilot = !state.destination || isInCorkPilot(state.destination.lat, state.destination.lng);

    if (excluded) excluded.innerHTML = "";

    if (state.dataStatus === "loading") {
      list.innerHTML = "";
      if (count) count.textContent = "Loading";
      if (coverageMessage) {
        coverageMessage.hidden = false;
        coverageMessage.innerHTML = '<span class="coverage-kicker">Official data</span><h3>Loading Cork parking inventory…</h3><p>WHITEBLOCK is loading the latest published parking evidence before applying your stay rules.</p>';
      }
      return;
    }

    if (state.dataStatus === "error") {
      list.innerHTML = "";
      if (count) count.textContent = "Unavailable";
      if (coverageMessage) {
        coverageMessage.hidden = false;
        coverageMessage.innerHTML = '<span class="coverage-kicker">Data unavailable</span><h3>Parking feed could not be loaded.</h3><p>WHITEBLOCK will not substitute demo parking values.</p>';
      }
      return;
    }

    if (!inPilot && state.destination) {
      list.innerHTML = "";
      if (count) count.textContent = "Pilot only";
      if (coverageMessage) {
        coverageMessage.hidden = false;
        coverageMessage.innerHTML = `
          <span class="coverage-kicker">Destination found</span>
          <h3>${escapeHtml(state.destination.primary || state.destination.label)}</h3>
          <p>WHITEBLOCK can locate this destination, but evidence-backed parking inventory is currently connected only for the Cork pilot.</p>
          <button type="button" id="return-cork-button">View Cork pilot</button>`;
        document.getElementById("return-cork-button")?.addEventListener("click", () => selectAddressSuggestion(initialDestination, { runRanking: true }));
      }
      return;
    }

    const data = currentData();
    const blocked = ineligibleData();

    if (!data.length) {
      list.innerHTML = "";
      if (count) count.textContent = blocked.length ? "0 suitable" : "0 nearby";
      if (coverageMessage) {
        coverageMessage.hidden = false;
        const message = blocked.length
          ? `Nearby parking exists, but none of the known options fit your ${formatDuration(requestedStayMinutes())} stay under the currently published restrictions.`
          : state.filter === "accessible" || state.filter === "ev"
            ? "The current evidence does not expose enough structured data for this filter at nearby assets."
            : `No published parking asset is within ${NEARBY_RADIUS_KM} km of this destination in the current inventory.`;
        coverageMessage.innerHTML = `<span class="coverage-kicker">No suitable recommendation</span><h3>${blocked.length ? "Known parking does not fit this stay" : "No matching parking found"}</h3><p>${escapeHtml(message)}</p>`;
      }
    } else {
      if (coverageMessage) coverageMessage.hidden = true;
      list.innerHTML = data.map((item, index) => parkingCard(item, index)).join("");
      if (count) count.textContent = `${data.length} suitable`;
      if (!data.some(item => item.id === state.selectedId)) state.selectedId = data[0].id;
      bindParkingCards(list);
    }

    if (excluded && blocked.length) {
      excluded.innerHTML = `
        <details class="parking-ineligible-section">
          <summary><span>Not suitable for this stay</span><b>${blocked.length}</b><small>Shown for transparency · not recommended</small></summary>
          <div class="parking-ineligible-list">${blocked.map((item, index) => parkingCard(item, index, { ineligible: true })).join("")}</div>
        </details>`;
      bindParkingCards(excluded);
    }
  };

  markerHtml = function markerHtmlWithSessionRules(item) {
    const rule = evaluate(item);
    if (!rule.eligible) {
      return `<div class="map-marker marker-ineligible"><strong>×</strong></div>`;
    }
    if (rule.nearLimit) {
      return `<div class="map-marker marker-pressure"><strong>${item.available != null ? Math.round(item.available) : "!"}</strong></div>`;
    }
    return baseMarkerHtml(item);
  };

  setKpiMode = function setKpiModeWithSessionRules(inPilot) {
    baseSetKpiMode(inPilot);
    if (!inPilot || state.dataStatus !== "ready") return;

    const allNearby = preparedData();
    const eligible = allNearby.filter(item => item.sessionRule.eligible);
    const blocked = allNearby.length - eligible.length;
    const available = eligible.map(item => numeric(item.available)).filter(value => value != null);
    const confidences = eligible.map(item => numeric(item.confidence)).filter(value => value != null);
    const occupied = eligible.reduce((sum, item) => sum + (item.capacity != null && item.available != null ? Math.max(0, item.capacity - item.available) : 0), 0);
    const capacity = eligible.reduce((sum, item) => sum + (numeric(item.capacity) ?? 0), 0);
    const occupancy = capacity > 0 ? occupied / capacity : null;
    const pressure = occupancy == null ? "Unknown" : occupancy >= 0.85 ? "High" : occupancy >= 0.65 ? "Moderate" : "Low";

    const coverageValue = document.getElementById("kpi-coverage-value");
    const coverageCopy = document.getElementById("kpi-coverage-copy");
    const availabilityValue = document.getElementById("kpi-availability-value");
    const availabilityCopy = document.getElementById("kpi-availability-copy");
    const confidenceValue = document.getElementById("kpi-confidence-value");
    const confidenceCopy = document.getElementById("kpi-confidence-copy");
    const pressureValue = document.getElementById("kpi-pressure-value");
    const pressureCopy = document.getElementById("kpi-pressure-copy");

    if (coverageValue) coverageValue.textContent = String(eligible.length);
    if (coverageCopy) coverageCopy.textContent = blocked ? `${blocked} nearby option${blocked === 1 ? "" : "s"} excluded by stay rules` : "all nearby assets fit selected stay";
    if (availabilityValue) availabilityValue.textContent = available.length ? String(Math.round(available.reduce((a, b) => a + b, 0))) : "—";
    if (availabilityCopy) availabilityCopy.textContent = "reported spaces in session-eligible parking";
    if (confidenceValue) confidenceValue.textContent = confidences.length ? `${Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length)}%` : "—";
    if (confidenceCopy) confidenceCopy.textContent = "eligible assets · evidence confidence";
    if (pressureValue) pressureValue.textContent = pressure;
    if (pressureCopy) pressureCopy.textContent = occupancy == null ? "insufficient eligible occupancy data" : `${Math.round(occupancy * 100)}% occupancy across eligible supply`;
  };

  function refreshMarkerEligibility() {
    if (typeof L === "undefined") return;
    parkingData.forEach(item => {
      const marker = state.markers.get(item.id);
      if (!marker) return;
      marker.setIcon(L.divIcon({
        className: "wb-marker-wrapper",
        html: markerHtml(item),
        iconSize: [34, 34],
        iconAnchor: [17, 30]
      }));
    });
  }

  function refreshSession() {
    if (state.dataStatus === "ready") {
      const eligible = currentData();
      if (eligible.length && !eligible.some(item => item.id === state.selectedId)) state.selectedId = eligible[0].id;
    }
    renderParkingList();
    setKpiMode(!state.destination || isInCorkPilot(state.destination.lat, state.destination.lng));
    refreshMarkerEligibility();
  }

  document.getElementById("duration")?.addEventListener("change", refreshSession);
  document.getElementById("arrival")?.addEventListener("change", refreshSession);

  window.WBSessionRules = {
    evaluate,
    requestedStayMinutes,
    requestedArrivalMinutes,
    formatDuration,
    parseDailyOpeningWindow,
    ineligibleData,
    refresh: refreshSession
  };
})();