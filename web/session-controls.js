// WHITEBLOCK mobile-first parking-session controls.
// Keeps the existing hidden #arrival and #duration values as the canonical contract
// consumed by session-rules.js, while replacing browser-native pickers with product UI.

(() => {
  const arrivalInput = document.getElementById("arrival");
  const durationInput = document.getElementById("duration");
  const arrivalTrigger = document.getElementById("arrival-trigger");
  const arrivalDisplay = document.getElementById("arrival-display");
  const sheet = document.getElementById("arrival-sheet");
  const timeList = document.getElementById("arrival-options");
  const stayChoices = [...document.querySelectorAll("[data-stay-minutes]")];

  if (!arrivalInput || !durationInput || !arrivalTrigger || !arrivalDisplay || !sheet || !timeList) return;

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
      button.setAttribute("aria-pressed", active ? "true" : "false");
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
      active?.scrollIntoView({ block: "center", behavior: "instant" });
      active?.focus({ preventScroll: true });
    });
  }

  function closeSheet() {
    if (sheet.hidden) return;
    sheet.hidden = true;
    document.body.classList.remove("session-sheet-open");
    arrivalTrigger.setAttribute("aria-expanded", "false");
    arrivalTrigger.focus({ preventScroll: true });
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

  syncArrivalDisplay();
  syncStayChoices();
})();
