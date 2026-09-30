// WHITEBLOCK result-card polish + destination draft ownership guard.
// Result cards keep canonical IDs available while presenting compact IDs. The
// destination guard ensures asynchronous regional refreshes never take ownership
// of text while a driver is actively typing a destination.

(() => {
  function compactAssetId(id) {
    return String(id || "")
      .replace(/^WB-PARK-IE-KILDARE-/, "WB-KD-")
      .replace(/^WB-ACC-IE-KILDARE-KCC-/, "WB-KD-ACC-")
      .replace(/^WB-PARK-IE-CORK-/, "WB-CK-")
      .replace(/^WB-PARK-IE-/, "WB-");
  }

  function installSearchDraftGuard() {
    const input = document.getElementById("destination");
    if (!input || input.dataset.whiteblockDraftGuard === "true" || typeof state === "undefined") return Boolean(input);
    input.dataset.whiteblockDraftGuard = "true";

    const protectDraft = () => {
      const draft = input.value.trim();
      const committed = String(state.committedDestinationLabel || "").trim();

      if (draft && draft !== committed) {
        // The Ireland overview watcher refreshes national totals while regional
        // adapters load. A human-entered draft takes priority over that refresh:
        // freeze overview rendering until the driver commits or clears the query.
        state.searchDraftActive = true;
        if (state.overviewMode === true) {
          state.overviewMode = false;
          state.regionFocus = null;
        }
        return;
      }

      if (!draft) {
        state.searchDraftActive = false;
        // Returning to an empty, uncommitted search restores the national browse
        // state. Clearing here is safe because the driver has already cleared it.
        if (!state.destination && !state.regionFocus && window.WHITEBLOCK_IRELAND_OVERVIEW?.show) {
          window.WHITEBLOCK_IRELAND_OVERVIEW.show({ animate: false });
        }
      }
    };

    input.addEventListener("input", protectDraft);
    input.addEventListener("keydown", event => {
      // Mark the field as user-owned before the subsequent input event. This
      // closes the narrow timing window between a keypress and a 500 ms refresh.
      if (event.key.length === 1 || event.key === "Backspace" || event.key === "Delete") {
        state.searchDraftActive = true;
        if (state.overviewMode === true) {
          state.overviewMode = false;
          state.regionFocus = null;
        }
      }
    });
    return true;
  }

  function install() {
    installSearchDraftGuard();
    if (typeof parkingCard !== "function" || parkingCard.__whiteblockResultPolish) return false;

    const baseParkingCard = parkingCard;
    const polished = function polishedParkingCard(item, index, options = {}) {
      const markup = baseParkingCard(item, index, options);
      const template = document.createElement("template");
      template.innerHTML = String(markup || "").trim();
      const card = template.content.firstElementChild;
      if (!card) return markup;

      const canonicalId = String(item?.id || card.dataset.parkingId || "");
      const identity = card.querySelector(".parking-title small");
      if (identity) {
        identity.textContent = `${item?.area || "Ireland"} · ${compactAssetId(canonicalId)}`;
        identity.title = canonicalId;
      }

      const availability = card.querySelector(".availability");
      const ineligible = options?.ineligible === true;
      if (availability && !ineligible && item?.available == null) {
        const strong = availability.querySelector("strong");
        const small = availability.querySelector("small");
        availability.classList.add("availability-unreported");
        availability.setAttribute("aria-label", "Live availability not reported");
        if (strong) strong.textContent = "Availability not reported";
        if (small) small.remove();
      }

      return card.outerHTML;
    };

    polished.__whiteblockResultPolish = true;
    parkingCard = polished;

    if (typeof renderParkingList === "function") renderParkingList();
    return true;
  }

  let attempts = 0;
  function tryInstall() {
    attempts += 1;
    const searchReady = installSearchDraftGuard();
    const cardReady = install();
    if ((searchReady && cardReady) || attempts >= 40) return;
    window.setTimeout(tryInstall, 100);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", tryInstall, { once: true });
  } else {
    tryInstall();
  }
})();
