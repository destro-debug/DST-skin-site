(function () {
  "use strict";

  const DST = window.DST;

  if (!DST) {
    console.error("[GTO] Shared DST utilities are unavailable.");
    return;
  }

  const DATA_PATH = "GTO-data/GTO-skins.json";
  const CATALOGUE_PATH = "GTO-data/GTO-catalogue.json";
  const IMAGE_FALLBACK = "../shared/shared-assets/site-logo.png";

  let skins = [];
  let searchIndex = [];
  let catalogue = null;
  let dataReady = false;

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const $$ = (selector, root = document) =>
    Array.from(root.querySelectorAll(selector));

  const normalize = (value) =>
    String(value ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  const getParam = (name) =>
    new URLSearchParams(window.location.search).get(name) || "";

  const escapeHTML = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[character]);

  function getSkinId(skin) {
    return skin.id || skin.skinId || "";
  }

  function getDisplayName(skin) {
    return skin.displayName || skin.skinName || "Unnamed skin";
  }

  function getBrandName(brandId) {
    const brand = catalogue?.brands?.find(
      (item) => normalize(item.id) === normalize(brandId)
    );

    return brand?.name || DST.utils.capitalize(
      String(brandId || "").replace(/-/g, " ")
    );
  }

  function getPartName(partId) {
    const part = catalogue?.parts?.find(
      (item) => normalize(item.id) === normalize(partId)
    );

    return part?.name || DST.utils.capitalize(
      String(partId || "").replace(/-/g, " ")
    );
  }

  function getVehicleTypeName(typeId) {
    const type = catalogue?.vehicleTypes?.find(
      (item) => normalize(item.id) === normalize(typeId)
    );

    return type?.name || DST.utils.capitalize(
      String(typeId || "").replace(/-/g, " ")
    );
  }

  function isValidSkin(skin) {
    return (
      skin &&
      typeof skin === "object" &&
      typeof getSkinId(skin) === "string" &&
      getSkinId(skin).trim() !== ""
    );
  }

  function uniqueSkins(records) {
    const seen = new Set();

    return records.filter((skin) => {
      const id = getSkinId(skin);

      if (!id || seen.has(id)) {
        return false;
      }

      seen.add(id);
      return true;
    });
  }

  function buildSearchIndex(records) {
    return records.map((skin) => {
      const brand = catalogue?.brands?.find(
        (item) => normalize(item.id) === normalize(skin.brand)
      );

      const catalogueBrandFields = brand
        ? [brand.name, ...(brand.aliases || [])]
        : [];

      return {
        ...skin,
        searchBrandFields: catalogueBrandFields
      };
    });
  }

  async function loadData() {
    try {
      const [skinData, catalogueData] = await Promise.all([
        DST.async.fetchJSON(DATA_PATH),
        DST.async.fetchJSON(CATALOGUE_PATH)
      ]);

      if (!Array.isArray(skinData)) {
        throw new Error("GTO skins data must be a JSON array.");
      }

      if (!catalogueData || typeof catalogueData !== "object") {
        throw new Error("GTO catalogue configuration is invalid.");
      }

      skins = uniqueSkins(skinData.filter(isValidSkin));
      catalogue = catalogueData;
      searchIndex = buildSearchIndex(skins);
      dataReady = true;

      document.dispatchEvent(
        new CustomEvent("gto:data-ready", {
          detail: {
            skins,
            catalogue
          }
        })
      );

      renderCurrentPage();
    } catch (error) {
      console.error("[GTO] Could not load catalogue data:", error);

      document.dispatchEvent(
        new CustomEvent("gto:data-error", {
          detail: {
            message: error?.message || "Unknown catalogue loading error."
          }
        })
      );

      showPageError();
    }
  }

  function showPageError() {
    const status = $("[data-gto-home-status]");

    if (status) {
      status.textContent =
        "The GTO collection could not be loaded. Please refresh the page.";
    }

    const loading = $("[data-gto-skin-loading]");
    const errorSection = $("[data-gto-skin-error]");

    if (loading && errorSection) {
      loading.hidden = true;
      errorSection.hidden = false;

      const title = $("[data-gto-error-title]");
      const message = $("[data-gto-error-message]");

      if (title) title.textContent = "Catalogue unavailable";
      if (message) {
        message.textContent =
          "The skin data could not be loaded. Please try again later.";
      }
    }

    const resultsGrid = $("[data-gto-results-grid]") ||
      $("[data-gto-browse-grid]");

    if (resultsGrid) {
      showEmptyState(
        resultsGrid,
        "Catalogue unavailable",
        "We couldn't load the GTO collection. Please refresh the page."
      );
    }
  }

  function createSkinCard(skin) {
    const card = document.createElement("a");
    const image = document.createElement("img");
    const content = document.createElement("div");
    const title = document.createElement("h3");
    const meta = document.createElement("p");

    card.className = "skin-card";
    card.href = `GTO-skin.html?id=${encodeURIComponent(getSkinId(skin))}`;

    image.className = "skin-card-image";
    image.alt = getDisplayName(skin);
    image.loading = "lazy";
    image.decoding = "async";

    if (DST.images.isValidImageURL(skin.imageUrl)) {
      image.src = skin.imageUrl;
    } else {
      image.src = IMAGE_FALLBACK;
    }

    DST.images.applyFallback(image, IMAGE_FALLBACK);

    content.className = "skin-card-content";

    title.className = "skin-card-title";
    title.textContent = getDisplayName(skin);

    meta.className = "skin-card-meta";

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

  function renderCards(container, records) {
    if (!container) return;

    container.replaceChildren();

    if (!records.length) {
      showEmptyState(
        container,
        "No skins found",
        "There are no skins in this collection yet. Check back later."
      );
      return;
    }

    const fragment = document.createDocumentFragment();

    records.forEach((skin) => {
      fragment.appendChild(createSkinCard(skin));
    });

    container.appendChild(fragment);
  }

  function showEmptyState(container, heading, message) {
    if (!container) return;

    container.replaceChildren();

    const state = document.createElement("div");
    const strong = document.createElement("strong");
    const description = document.createElement("span");

    state.className = "results-state";
    strong.textContent = heading;
    description.textContent = message;

    state.append(strong, description);
    container.appendChild(state);
  }

  // -----------------------------------------
  // HOMEPAGE
  // -----------------------------------------

  function renderHome() {
    const grid = $("[data-gto-latest-grid]");

    if (!grid) return;

    const status = $("[data-gto-home-status]");

    if (status) {
      status.textContent = skins.length
        ? `${skins.length} skin${skins.length === 1 ? "" : "s"} in the collection`
        : "The GTO collection is ready for its first skins.";
    }

    const latest = [...skins].sort((a, b) => {
      const dateA = Date.parse(a.addedAt || "") || 0;
      const dateB = Date.parse(b.addedAt || "") || 0;
      return dateB - dateA;
    });

    renderCards(grid, latest.slice(0, 8));
  }

  // -----------------------------------------
  // LIVE SEARCH
  // -----------------------------------------

  function searchSkins(query) {
    if (!DST.search || typeof DST.search.search !== "function") {
      console.error("[GTO] Shared search utility is unavailable.");
      return [];
    }

    return DST.search.search(searchIndex, query, {
      fields: [
        "skinName",
        "displayName",
        "brand",
        "brandAliases",
        "searchBrandFields",
        "vehicleName",
        "compatibleVehicle",
        "vehicleType",
        "partType",
        "aliases"
      ]
    });
  }

  function renderSearch() {
    const input = $("[data-gto-search-input]");
    const resultsSection = $("[data-gto-results-section]");
    const defaultState = $("[data-gto-default-state]");
    const resultsGrid = $("[data-gto-results-grid]");
    const resultsTitle = $("[data-gto-results-query]");
    const resultsCount = $("[data-gto-results-count]");

    if (!input || !resultsSection || !resultsGrid) return;

    const initialQuery = getParam("q");

    if (initialQuery) {
      input.value = initialQuery;
    }

    function updateResults(query) {
      const trimmedQuery = query.trim();

      if (!trimmedQuery) {
        resultsSection.hidden = true;

        if (defaultState) {
          defaultState.hidden = false;
        }

        resultsGrid.replaceChildren();

        if (resultsTitle) resultsTitle.textContent = "";
        if (resultsCount) resultsCount.textContent = "";

        return;
      }

      resultsSection.hidden = false;

      if (defaultState) {
        defaultState.hidden = true;
      }

      const matches = searchSkins(trimmedQuery);

      if (resultsTitle) {
        resultsTitle.textContent = ` for "${trimmedQuery}"`;
      }

      if (resultsCount) {
        resultsCount.textContent =
          `${matches.length} result${matches.length === 1 ? "" : "s"}`;
      }

      if (!skins.length) {
        showEmptyState(
          resultsGrid,
          "Catalogue is empty",
          "No GTO skins have been added to the collection yet."
        );
        return;
      }

      if (!matches.length) {
        showEmptyState(
          resultsGrid,
          "No matching skins found",
          "Try another name, brand, truck model, or category."
        );
        return;
      }

      renderCards(resultsGrid, matches);
    }

    input.addEventListener("input", () => {
      updateResults(input.value);
    });

    updateResults(input.value);
  }

  // -----------------------------------------
  // BROWSING
  // -----------------------------------------

  function getBrowseMatches(kind, value) {
    const target = normalize(value);

    if (!target) return [];

    if (kind === "part") {
      return skins.filter(
        (skin) => normalize(skin.partType) === target
      );
    }

    if (kind === "vehicle") {
      return skins.filter(
        (skin) => normalize(skin.vehicleType) === target
      );
    }

    if (kind === "brand") {
      const brand = catalogue?.brands?.find((item) => {
        const names = [item.id, item.name, ...(item.aliases || [])];
        return names.some((name) => normalize(name) === target);
      });

      const acceptedNames = brand
        ? [brand.id, brand.name, ...(brand.aliases || [])].map(normalize)
        : [target];

      return skins.filter((skin) => {
        const skinBrand = normalize(skin.brand);

        const aliases = Array.isArray(skin.brandAliases)
          ? skin.brandAliases.map(normalize)
          : [];

        return acceptedNames.includes(skinBrand) ||
          aliases.some((alias) => acceptedNames.includes(alias));
      });
    }

    return [];
  }

  function getBrowseTitle(kind, value) {
    let name = "";

    if (kind === "brand") {
      name = getBrandName(value);
    } else if (kind === "part") {
      name = getPartName(value);
    } else if (kind === "vehicle") {
      name = getVehicleTypeName(value);
    }

    return name ? `${name} Skins` : "GTO Skins";
  }

  function renderBrowse() {
    const section = $("[data-gto-browse-results]");
    const grid = $("[data-gto-browse-grid]");

    if (!section || !grid) return;

    const kind = getParam("kind");
    const value = getParam("value");

    if (!kind || !value) {
      section.hidden = true;
      return;
    }

    section.hidden = false;

    const title = $("[data-gto-browse-title]");
    const description = $("[data-gto-browse-description]");
    const count = $("[data-gto-browse-count]");

    const matches = getBrowseMatches(kind, value);

    if (title) {
      title.textContent = getBrowseTitle(kind, value);
    }

    if (description) {
      const labels = {
        brand: "Brand collection",
        part: "Skin category",
        vehicle: "Vehicle type"
      };

      description.textContent =
        labels[kind] || "GTO skin collection";
    }

    if (count) {
      count.textContent =
        `${matches.length} skin${matches.length === 1 ? "" : "s"}`;
    }

    renderCards(grid, matches);
  }

  // -----------------------------------------
  // SKIN DETAIL
  // -----------------------------------------
    function setText(selector, value) {
    const element = $(selector);

    if (element) {
      element.textContent = value || "";
    }
  }

  function setDetail(selector, value) {
    const item = $(`[data-gto-detail="${selector}"]`);

    if (item) {
      item.hidden = !value;
    }
  }

  function renderSkinDetail() {
    const content = $("[data-gto-skin-content]");
    const loading = $("[data-gto-skin-loading]");
    const errorSection = $("[data-gto-skin-error]");

    if (!content || !loading || !errorSection) return;

    const id = getParam("id");

    const skin = skins.find(
      (record) => getSkinId(record) === id
    );

    loading.hidden = true;

    if (!id || !skin) {
      content.hidden = true;
      errorSection.hidden = false;

      setText(
        "[data-gto-error-title]",
        "Skin not found"
      );

      setText(
        "[data-gto-error-message]",
        id
          ? "This skin may have been removed or the link may be incorrect."
          : "No skin ID was provided. Open a skin from the GTO collection."
      );

      return;
    }

    errorSection.hidden = true;
    content.hidden = false;

    const displayName = getDisplayName(skin);
    const image = $("[data-gto-skin-image]");

    DST.page.setTitle(`${displayName} | DST SKIN CATALOGUE`);

    setText("[data-gto-skin-name]", displayName);
    setText(
      "[data-gto-skin-description]",
      skin.description || "No description has been added for this skin yet."
    );
    setText("[data-gto-breadcrumb-current]", displayName);

    if (image) {
      image.alt = displayName;

      if (DST.images.isValidImageURL(skin.imageUrl)) {
        image.src = skin.imageUrl;
      } else {
        image.src = IMAGE_FALLBACK;
      }

      DST.images.applyFallback(image, IMAGE_FALLBACK);
    }

    const brand = skin.brand ? getBrandName(skin.brand) : "";
    const vehicle = skin.vehicleName || skin.compatibleVehicle || "";
    const vehicleType = skin.vehicleType
      ? getVehicleTypeName(skin.vehicleType)
      : "";
    const part = skin.partType
      ? getPartName(skin.partType)
      : "";

    setText("[data-gto-brand]", brand);
    setText("[data-gto-vehicle]", vehicle);
    setText("[data-gto-vehicle-type]", vehicleType);
    setText("[data-gto-part-type]", part);

    setDetail("brand", brand);
    setDetail("vehicle", vehicle);
    setDetail("vehicleType", vehicleType);
    setDetail("part", part);

    renderCodes(skin);
  }

  function renderCodes(skin) {
    const section = $("[data-gto-code-section]");
    if (!section) return;

    const single = $('[data-gto-code-item="single"]');
    const head = $('[data-gto-code-item="head"]');
    const body = $('[data-gto-code-item="body"]');

    const hasDualCodes = Boolean(
      skin.headCode || skin.bodyCode
    );

    const hasSingleCode = Boolean(skin.skinCode);

    section.hidden = !hasDualCodes && !hasSingleCode;

    if (single) single.hidden = hasDualCodes || !hasSingleCode;
    if (head) head.hidden = !hasDualCodes || !skin.headCode;
    if (body) body.hidden = !hasDualCodes || !skin.bodyCode;

    setText("[data-gto-skin-code]", skin.skinCode || "");
    setText("[data-gto-head-code]", skin.headCode || "");
    setText("[data-gto-body-code]", skin.bodyCode || "");

    const copyButtons = $$("[data-gto-copy]");

    copyButtons.forEach((button) => {
      button.onclick = async () => {
        const type = button.dataset.gtoCopy;

        const codeMap = {
          skin: skin.skinCode,
          head: skin.headCode,
          body: skin.bodyCode
        };

        const code = codeMap[type];

        if (!code) return;

        const originalText = {
          skin: "Copy Code",
          head: "Copy Head",
          body: "Copy Body"
        }[type];

        try {
          await DST.clipboard.copy(code);
          button.textContent = "Copied!";
        } catch (error) {
          console.error("[GTO] Copy failed:", error);
          button.textContent = "Copy failed";
        }

        window.setTimeout(() => {
          button.textContent = originalText;
        }, 1600);
      };
    });
  }

  // -----------------------------------------
  // SKIN BACK BUTTON
  // -----------------------------------------

  function initSkinBackButton() {
    const wrapper = $("[data-gto-skin-back-wrap]");
    const button = $("[data-gto-skin-back]");

    if (!wrapper || !button) return;

    wrapper.hidden = false;

    button.addEventListener("click", () => {
      const referrer = document.referrer;

      let previousPage = null;

      if (referrer) {
        try {
          const previousURL = new URL(referrer);
          const currentURL = new URL(window.location.href);

          const isSameSite = previousURL.origin === currentURL.origin;
          const isGTOPage = /\/GTO\/GTO-(home|search|browse|explore)\.html$/i
            .test(previousURL.pathname);

          if (isSameSite && isGTOPage) {
            previousPage = previousURL.href;
          }
        } catch (error) {
          console.warn("[GTO] Could not read previous page:", error);
        }
      }

      if (previousPage) {
        window.location.href = previousPage;
        return;
      }

      window.location.href = "GTO-home.html";
    });
  }

  // -----------------------------------------
  // PAGE INITIALIZATION
  // -----------------------------------------

  function renderCurrentPage() {
    renderHome();
    renderSearch();
    renderBrowse();
    renderSkinDetail();
  }

  function init() {
    if (DST.page && typeof DST.page.updateCurrentYear === "function") {
      DST.page.updateCurrentYear();
    }

    initSkinBackButton();
    loadData();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();