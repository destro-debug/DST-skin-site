
/* =========================================================
   DST SKIN CATALOGUE
   Truckers of Europe 3
   Explore page engine
========================================================= */

(() => {
  "use strict";

  const DST = window.DST;

  if (!DST || !DST.utils || !DST.async || !DST.images) {
    console.error(
      "[TOE3 Explore] Required shared utilities are unavailable."
    );
    return;
  }

  const CONFIG = {
    skinsURL: "TOE3-data/TOE3-skins.json",
    catalogueURL: "TOE3-data/TOE3-catalogue.json",
    skinPage: "TOE3-skin.html",
    fallbackImage: "../shared/shared-assets/site-logo.png"
  };

  const grid = document.querySelector(
    "[data-toe3-explore-grid]"
  );

  const count = document.querySelector(
    "[data-toe3-explore-count]"
  );

  const status = document.querySelector(
    "[data-toe3-explore-status]"
  );

  const statusMessage = document.querySelector(
    "[data-toe3-explore-status-message]"
  );

  const year = document.querySelector(
    "[data-toe3-explore-year]"
  );

  if (!grid || !count || !status || !statusMessage) {
    console.error(
      "[TOE3 Explore] Required Explore page elements are missing."
    );
    return;
  }

  let catalogue = null;

  /* -------------------------------------------------------
     TEXT AND DATA UTILITIES
  ------------------------------------------------------- */

  function normalize(value) {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function getSkinId(skin) {
    return String(skin?.id || skin?.skinId || "");
  }

  function getDisplayName(skin) {
    if (skin?.displayName) {
      return skin.displayName;
    }

    return [
      skin?.skinName || "Unnamed skin",
      skin?.vehicleName || ""
    ].filter(Boolean).join(" | ");
  }

  function getBrand(brandId) {
    const brands = catalogue?.brands || [];
    const normalized = normalize(brandId);

    return brands.find(brand =>
      normalize(brand.id) === normalized ||
      normalize(brand.name) === normalized ||
      (brand.aliases || []).some(alias =>
        normalize(alias) === normalized
      )
    ) || null;
  }

  function getPart(partId) {
    const parts = catalogue?.parts || [];
    const normalized = normalize(partId);

    return parts.find(part =>
      normalize(part.id) === normalized ||
      normalize(part.name) === normalized ||
      (part.aliases || []).some(alias =>
        normalize(alias) === normalized
      )
    ) || null;
  }

  function getBrandName(brandId) {
    return getBrand(brandId)?.name || brandId || "";
  }

  function getPartName(partId) {
    return getPart(partId)?.name ||
      DST.utils.capitalize(partId || "");
  }

  function getValidSkins(records) {
    if (!Array.isArray(records)) {
      return [];
    }

    return records.filter(skin =>
      skin &&
      typeof skin === "object" &&
      getSkinId(skin) &&
      skin.skinName &&
      skin.vehicleName &&
      ["cabin", "trailer"].includes(normalize(skin.partType)) &&
      DST.images.isValidImageURL(skin.imageUrl)
    );
  }

  function getUniqueSkins(records) {
    const seen = new Set();

    return records.filter(skin => {
      const id = getSkinId(skin);

      if (!id || seen.has(id)) {
        return false;
      }

      seen.add(id);
      return true;
    });
  }

  /* -------------------------------------------------------
     STATUS AND COUNT
  ------------------------------------------------------- */

  function updateCount(total) {
    count.textContent =
      `${total} ${total === 1 ? "skin" : "skins"}`;
  }

  function showStatus(message, state = "empty") {
    status.hidden = false;
    status.dataset.toe3ExploreState = state;
    statusMessage.textContent = message;
  }

  function hideStatus() {
    status.hidden = true;
    statusMessage.textContent = "";
    delete status.dataset.toe3ExploreState;
  }

  /* -------------------------------------------------------
     SKIN CARD CREATION
  ------------------------------------------------------- */

  function createSkinCard(skin) {
    const card = document.createElement("a");
    const image = document.createElement("img");
    const content = document.createElement("div");
    const title = document.createElement("h3");
    const meta = document.createElement("p");

    const skinId = getSkinId(skin);
    const displayName = getDisplayName(skin);

    card.className = "toe3-explore-card";
    card.href =
      `${CONFIG.skinPage}?id=${encodeURIComponent(skinId)}`;

    card.setAttribute(
      "aria-label",
      `View ${displayName}`
    );

    image.className = "toe3-explore-card-image";
    image.alt = displayName;
    image.loading = "lazy";
    image.decoding = "async";

    image.src = skin.imageUrl;

    DST.images.applyFallback(
      image,
      CONFIG.fallbackImage
    );

    content.className = "toe3-explore-card-content";

    title.className = "toe3-explore-card-title";
    title.textContent = displayName;

    meta.className = "toe3-explore-card-meta";

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

  /* -------------------------------------------------------
     ALPHABETICAL SORTING
  ------------------------------------------------------- */

  function getOrderedSkins(records) {
    return getUniqueSkins(getValidSkins(records))
      .sort((a, b) =>
        normalize(getDisplayName(a)).localeCompare(
          normalize(getDisplayName(b))
        )
      );
  }


  /* -------------------------------------------------------
     RENDER ALL SKINS
  ------------------------------------------------------- */

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

    records.forEach(skin => {
      fragment.appendChild(createSkinCard(skin));
    });

    grid.appendChild(fragment);
  }

  /* -------------------------------------------------------
     CATALOGUE LOADING
  ------------------------------------------------------- */

  async function loadCatalogue() {
    try {
      showStatus("Loading TOE3 skins...", "loading");

      const [skins, data] = await Promise.all([
        DST.async.fetchJSON(CONFIG.skinsURL),
        DST.async.fetchJSON(CONFIG.catalogueURL)
      ]);

      if (!Array.isArray(skins)) {
        throw new Error(
          "The TOE3 skin data must be a JSON array."
        );
      }

      if (!data || !Array.isArray(data.brands)) {
        throw new Error(
          "The TOE3 catalogue configuration is invalid."
        );
      }

      catalogue = data;

      const orderedSkins = getOrderedSkins(skins);

      renderSkins(orderedSkins);

      console.info(
        `[TOE3 Explore] Successfully loaded ${orderedSkins.length} skins.`
      );

    } catch (error) {
      console.error(
        "[TOE3 Explore] Catalogue loading failed:",
        error
      );

      grid.replaceChildren();
      count.textContent = "Unavailable";

      showStatus(
        "The TOE3 skin collection could not be loaded. Please refresh the page and try again.",
        "error"
      );
    }
  }

  /* -------------------------------------------------------
     PAGE INITIALIZATION
  ------------------------------------------------------- */

  function updateExploreYear() {
    if (year) {
      year.textContent = new Date().getFullYear();
    }
  }

  function init() {
    updateExploreYear();
    loadCatalogue();
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
