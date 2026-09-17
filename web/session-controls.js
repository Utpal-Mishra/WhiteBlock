// WHITEBLOCK mobile-first parking-session controls.
// The existing #arrival and #duration form values remain the canonical contract consumed
// by session-rules.js. This layer replaces browser-native pickers without changing rules.

(() => {
  const arrivalInput = document.getElementById("arrival");
  const durationInput = document.getElementById("duration");
  if (!arrivalInput || !durationInput || document.getElementById("arrival-trigger")) return;

  const arrivalField = arrivalInput.closest(".search-field");
  const durationField = durationInput.closest(".search-field");
  if (!arrivalField || !durationField) return;

  arrivalInput.classList.add("session-native-input");
  durationInput.classList.add("session-native-input");
  arrivalField.classList.add("session-control-field", "arrival-control-field");
  durationField.classList.add("session-control-field", "stay-control-field");

  const arrivalTrigger = document.createElement("button");
  arrivalTrigger.type = "button";
  arrivalTrigger.id = "arrival-trigger";
  arrivalTrigger.className = "arrival-trigger";
  arrivalTrigger.setAttribute("aria-haspopup", "dialog");
  arrivalTrigger.setAttribute("aria-controls", "arrival-sheet");
  arrivalTrigger.setAttribute("aria-expanded", "false");
  arrivalTrigger.innerHTML = `
    <strong id="arrival-display">${arrivalInput.value || "18:30"}</strong>
    <span class="session-control-clock" aria-hidden="true">
      <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"></circle><path d="M12 7v5l3 2"></path></svg>
    </span>`;
  arrivalInput.insertAdjacentElement("beforebegin", arrivalTrigger);

  const stayChoicesWrap = document.createElement("div");
  stayChoicesWrap.className = "stay-choices";
  stayChoicesWrap.setAttribute("role", "radiogroup");
  stayChoicesWrap.setAttribute("aria-label", "Parking stay duration");
  const stayOptions = [
    [60, "1h"], [120, "2h"], [180, "3h"],
    [240, "4h"], [360, "6h"], [480, "8h"]
  ];
  stayChoicesWrap.innerHTML = stayOptions.map(([minutes, label]) => `
    <button type="button" class="stay-choice" role="radio" data-stay-minutes="${minutes}" aria-checked="false">${label}</button>`).join("");
  durationInput.insertAdjacentElement("beforebegin", stayChoicesWrap);

  document.body.insertAdjacentHTML("beforeend", `
    <div id="arrival-sheet" class="session-sheet" hidden>
      <button type="button" class="session-sheet-backdrop" data-close-arrival aria-label="Close arrival time picker"></button>
      <section class="session-sheet-panel" role="dialog" aria-modal="true" aria-labelledby="arrival-sheet-title">
        <div class="session-sheet-handle" aria-hidden="true"></div>
        <div class="session-sheet-head">
          <div>
            <p class="eyebrow">Parking session</p>
            <h3 id="arrival-sheet-title">When will you arrive?</h3>
            <p>Choose a 15-minute slot. Parking restrictions are checked against your full session.</p>
          </div>
          <button type="button" class="session-sheet-close" data-close-arrival aria-label="Close">×</button>
        </div>
        <div class="session-quick-times" aria-label="Quick arrival choices">
          <button type="button" class="session-quick-time" data-time-offset="0">Now</button>
          <button type="button" class="session-quick-time" data-time-offset="15">+15m</button>
          <button type="button" class="session-quick-time" data-time-offset="30">+30m</button>
          <button type="button" class="session-quick-time" data-time-offset="60">+1h</button>
        </div>
        <div id="arrival-options" class="time-option-list" role="listbox" aria-label="Arrival times"></div>
        <p class="session-sheet-footnote">Times use your device clock · 15-minute planning intervals</p>
      </section>
    </div>`);

  const arrivalDisplay = document.getElementById("arrival-display");
  const sheet = document.getElementById("arrival-sheet");
  const timeList = document.getElementById("arrival-options");
  const stayChoices = [...document.querySelectorAll("[data-stay-minutes]")];

  const toClock = minutes => {
    const safe = ((Number(minutes) % 1440) + 1440) % 1440;
    return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
  };

  const fromClock = value => {
    const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return 0;
    return Number(match[1]) * 60 + Number(match[2]);
  };

  const roundedNow = offsetMinutes => {
    const now = new Date();
    const raw = now.getHours() * 60 + now.getMinutes() + Number(offsetMinutes || 0);
    return Math.ceil(raw / 15) * 15;
  };

  const fireChange = input => input.dispatchEvent(new Event("change", { bubbles: true }));

  function syncArrivalDisplay() {
    const value = arrivalInput.value || "18:30";
    arrivalDisplay.textContent = value;
    arrivalTrigger.setAttribute("aria-label", `Arrive at ${value}. Change arrival time`);
  }

  function syncStayChoices() {
    const selected = Number(durationInput.value || 120);
    stayChoices.forEach(button => {
      const active = Number(button.dataset.stayMinutes) === selected;
      button.classList.toggle("active", active);
      button.setAttribute("aria-checked", active ? "true" : "false");
      button.tabIndex = active ? 0 : -1;
    });
  }

  function closeSheet() {
    if (sheet.hidden) return;
    sheet.hidden = true;
    document.body.classList.remove("session-sheet-open");
    arrivalTrigger.setAttribute("aria-expanded", "false");
    arrivalTrigger.focus({ preventScroll: true });
  }

  function selectArrival(minutes, { close = true } = {}) {
    arrivalInput.value = toClock(minutes);
    syncArrivalDisplay();
    fireChange(arrivalInput);
    if (close) closeSheet();
  }

  function buildTimeOptions() {
    const selected = fromClock(arrivalInput.value);
    timeList.innerHTML = "";

    for (let minutes = 0; minutes < 1440; minutes += 15) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "time-option";
      button.dataset.timeMinutes = String(minutes);
      button.textContent = toClock(minutes);
      const active = minutes === selected;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
      button.setAttribute("role", "option");
      button.addEventListener("click", () => selectArrival(minutes));
      timeList.appendChild(button);
    }
  }

  function openSheet() {
    buildTimeOptions();
    sheet.hidden = false;
    document.body.classList.add("session-sheet-open");
    arrivalTrigger.setAttribute("aria-expanded", "true");

    requestAnimationFrame(() => {
      const active = timeList.querySelector(".time-option.active");
      active?.scrollIntoView({ block: "center", behavior: "auto" });
      active?.focus({ preventScroll: true });
    });
  }

  arrivalTrigger.addEventListener("click", openSheet);

  sheet.querySelectorAll("[data-close-arrival]").forEach(button => {
    button.addEventListener("click", closeSheet);
  });

  sheet.querySelectorAll("[data-time-offset]").forEach(button => {
    button.addEventListener("click", () => selectArrival(roundedNow(Number(button.dataset.timeOffset || 0))));
  });

  stayChoices.forEach(button => {
    button.addEventListener("click", () => {
      durationInput.value = button.dataset.stayMinutes;
      syncStayChoices();
      fireChange(durationInput);
    });

    button.addEventListener("keydown", event => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
      event.preventDefault();
      const index = stayChoices.indexOf(button);
      const direction = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
      const next = stayChoices[(index + direction + stayChoices.length) % stayChoices.length];
      next.focus();
      next.click();
    });
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !sheet.hidden) closeSheet();
  });

  arrivalInput.addEventListener("change", syncArrivalDisplay);
  durationInput.addEventListener("change", syncStayChoices);
  syncArrivalDisplay();
  syncStayChoices();
})();
