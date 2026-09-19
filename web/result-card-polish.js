// WHITEBLOCK mobile result-card content polish.
// Keeps canonical asset IDs available in title/tooling while presenting a compact ID,
// and collapses unknown availability into one clear status instead of duplicated copy.

(() => {
  function compactAssetId(id) {
    return String(id || "")
      .replace(/^WB-PARK-IE-KILDARE-/, "WB-KD-")
      .replace(/^WB-ACC-IE-KILDARE-KCC-/, "WB-KD-ACC-")
      .replace(/^WB-PARK-IE-CORK-/, "WB-CK-")
      .replace(/^WB-PARK-IE-/, "WB-");
  }

  function install() {
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
    if (install() || attempts >= 20) return;
    window.setTimeout(tryInstall, 100);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", tryInstall, { once: true });
  } else {
    tryInstall();
  }
})();
