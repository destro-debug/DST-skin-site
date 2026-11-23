(() => {
  "use strict";

  const DST = window.DST;

  if (!DST) {
    console.error("[GTO Explore] Shared DST utilities are unavailable.");
    return;
  }

  const IMAGE_FALLBACK = "../shared/shared-assets/site-logo.png";

  const grid = document.querySelector("[data-gto-explore-grid]");
  const count = document.querySelector("[data-gto-explore-count]");
  const status = document.querySelector("[data-gto-explore-status]");
  const statusMessage = document.querySelector(
    "[data-gto-explore-status-message]"
  );
  const year = document.querySelector("[data-gto-explore-year]");

  if (!grid || !count || !status || !statusMessage) {
    console.error(
      "[GTO Explore] Required Explore page elements are missing."
    );
    return;
  }

  let catalogue = null;

  // -----------------------------------------
  // DATA HELPERS
  // -----------------------------------------

  function normalize(value) {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();
  }

  function getSkinId(skin) {
    return skin?.id || skin?.skinId || "";
  }

  function getDisplayName(skin) {
    return skin?.displayName || skin?.skinName || "Unnamed skin";
  }

  function getConfigName(collection, id) {
    if (!Array.isArray(collection) || !id) {
      return "";
    }

    const item = collection.find(
      (entry) => normalize(entry.id) === normalize(id)
    );

    if (item?.name) {
      return item.name;
    }

    return String(id)
      .replace(/-/g, " ")
      .replace(/\b\w/g, (character) => character.toUpperCase());
  }

  function getBrandName(brandId) {
    return getConfigName(catalogue?.brands, brandId);
  }

  function getPartName(partId) {
    return getConfigName(catalogue?.parts, partId);
  }

  // -----------------------------------------
  // STATUS AND COUNT
  // -----------------------------------------

  function updateCount(total) {
    count.textContent =
      `${total} skin${total === 1 ? "" : "s"}`;
  }

  function showStatus(message, state = "empty") {
    status.hidden = false;
    status.dataset.gtoExploreState = state;
    statusMessage.textContent = message;
  }

  function hideStatus() {
    status.hidden = true;
    statusMessage.textContent = "";
    delete status.dataset.gtoExploreState;
  }

  // -----------------------------------------
  // SKIN CARD CREATION
  // -----------------------------------------

  function createSkinCard(skin) {
    const card = document.createElement("a");
    const image = document.createElement("img");
    const content = document.createElement("div");
    const title = document.createElement("h3");
    const meta = document.createElement("p");

    const skinId = getSkinId(skin);
    const displayName = getDisplayName(skin);

    card.className = "gto-explore-card";
    card.href =
      `./GTO-skin.html?id=${encodeURIComponent(skinId)}`;
    card.setAttribute(
      "aria-label",
      `View ${displayName}`
    );

    image.className = "gto-explore-card-image";
    image.alt = displayName;
    image.loading = "lazy";
    image.decoding = "async";

    const validImage =
      DST.images &&
      typeof DST.images.isValidImageURL === "function" &&
      DST.images.isValidImageURL(skin.imageUrl);

    image.src = validImage
      ? skin.imageUrl
      : IMAGE_FALLBACK;

    if (
      DST.images &&
      typeof DST.images.applyFallback === "function"
    ) {
      DST.images.applyFallback(image, IMAGE_FALLBACK);
    } else {
      image.addEventListener(
        "error",
        () => {
          if (!image.src.endsWith("site-logo.png")) {
            image.src = IMAGE_FALLBACK;
          }
        },
        { once: true }
      );
    }

    content.className = "gto-explore-card-content";

    title.className = "gto-explore-card-title";
    title.textContent = displayName;

    meta.className = "gto-explore-card-meta";

    const metaParts = [];

    if (skin.brand) {
      metaParts.push(getBrandName(skin.brand));
    }

    if (skin.partType) {
      metaParts.push(getPartName(skin.partType));
    }

    meta.textContent = metaParts.join(" · ");

    content.append(title, meta);
    card.append(image, content);

    return card;
  }

  // -----------------------------------------
  // ALPHABETICAL SORTING
  // -----------------------------------------

  function getOrderedSkins(records) {
    if (!Array.isArray(records)) {
      return [];
    }

    if (
      DST.browse &&
      typeof DST.browse.browse === "function"
    ) {
      return DST.browse.browse(records, {});
    }

    const seen = new Set();

    return records
      .filter((skin) => {
        const id = getSkinId(skin);

        if (!id || seen.has(id)) {
          return false;
        }

        seen.add(id);
        return true;
      })
      .sort((a, b) =>
        normalize(getDisplayName(a)).localeCompare(
          normalize(getDisplayName(b))
        )
      );
  }
    // -----------------------------------------
  // RENDER ALL SKINS
  // -----------------------------------------

  function renderSkins(records) {
    grid.replaceChildren();

    updateCount(records.length);

    if (records.length === 0) {
      showStatus(
        "No skins have been added to the catalogue yet.",
        "empty"
      );
      return;
    }

    hideStatus();

    const fragment = document.createDocumentFragment();

    records.forEach((skin) => {
      fragment.appendChild(createSkinCard(skin));
    });

    grid.appendChild(fragment);
  }

  // -----------------------------------------
  // CATALOGUE DATA EVENTS
  // -----------------------------------------

  function handleDataReady(event) {
    const data = event.detail || {};

    if (!Array.isArray(data.skins)) {
      console.error(
        "[GTO Explore] Received invalid skin catalogue data."
      );

      handleDataError();
      return;
    }

    catalogue = data.catalogue || null;

    const orderedSkins = getOrderedSkins(data.skins);

    renderSkins(orderedSkins);

    console.info(
      `[GTO Explore] Successfully loaded ${orderedSkins.length} skins.`
    );
  }

  function handleDataError() {
    grid.replaceChildren();

    count.textContent = "Unavailable";

    showStatus(
      "The GTO skin collection could not be loaded. Please refresh the page and try again.",
      "error"
    );

    console.error(
      "[GTO Explore] Catalogue data could not be loaded."
    );
  }

  // -----------------------------------------
  // PAGE INITIALIZATION
  // -----------------------------------------

  function updateExploreYear() {
    if (year) {
      year.textContent = new Date().getFullYear();
    }
  }

  function init() {
    updateExploreYear();

    document.addEventListener(
      "gto:data-ready",
      handleDataReady
    );

    document.addEventListener(
      "gto:data-error",
      handleDataError
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      init,
      { once: true }
    );
  } else {
    init();
  }

})();