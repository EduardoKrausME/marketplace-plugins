(() => {
  "use strict";

  const grid = document.querySelector("#plugin-grid");
  const empty = document.querySelector("#empty");
  const errorBox = document.querySelector("#catalog-error");
  const errorMessage = document.querySelector("#catalog-error-message");
  const search = document.querySelector("#search");
  const clearSearch = document.querySelector("#clear-search");
  const heading = document.querySelector("#section-title");
  const count = document.querySelector("#result-count");
  const filters = [...document.querySelectorAll(".filters > button[data-category]")];
  const labels = {
    administration: "Administration",
    themes: "Themes",
    video: "Video",
    reports: "Reports",
    integrations: "Integrations"
  };
  const base = new URL("./", document.baseURI);
  let category = "all";
  let query = "";
  let cards = [];
  let favorites = [];

  try {
    const saved = JSON.parse(localStorage.getItem("marketplace-favorites") || "[]");
    if (Array.isArray(saved)) favorites = saved.filter(value => typeof value === "string");
  } catch (_) {
    // Private browsing may disable local storage.
  }

  function show(element, visible) {
    if (!element) return;
    element.hidden = !visible;
    element.style.display = visible ? "" : "none";
  }

  function assetUrl(value) {
    const path = String(value || "").trim();
    if (!path) return "";
    if (/^(?:https?:)?\/\//i.test(path) || path.startsWith("data:")) return path;
    if (path.startsWith("/marketplace-plugins/")) {
      return new URL(path.slice("/marketplace-plugins/".length), base).href;
    }
    if (path.startsWith("/")) return path;
    return new URL(path, base).href;
  }

  function pluginLink(component) {
    return new URL("plugin/" + encodeURIComponent(component) + "/", base).href;
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function renderCard(plugin) {
    const component = plugin.component;
    const name = String(plugin.name || "Plugin");
    const kind = String(plugin.category || "plugin");
    const description = String(plugin.description || "");
    const href = pluginLink(component);
    const article = element("article", "plugin-card");
    article.dataset.pluginCard = "";
    article.dataset.category = kind;
    article.dataset.search = [name, component, description].join(" ").toLocaleLowerCase("en-US");

    const favorite = element("button", "favorite", "☆");
    favorite.type = "button";
    favorite.dataset.favorite = component;
    favorite.setAttribute("aria-label", "Add to favorites " + name);
    favorite.classList.toggle("selected", favorites.includes(component));
    article.append(favorite);

    const icon = element("a", "plugin-icon " + kind);
    icon.href = href;
    icon.setAttribute("aria-label", "Open " + name);
    const iconSource = assetUrl(plugin.iconUrl);
    if (iconSource) {
      const img = element("img");
      img.src = iconSource;
      img.alt = "";
      img.loading = "lazy";
      img.addEventListener("error", () => {
        img.replaceWith(element("span", "plugin-icon-fallback", "EK"));
      }, { once: true });
      icon.append(img);
    } else {
      icon.append(element("span", "plugin-icon-fallback", "EK"));
    }
    article.append(icon);

    const content = element("div", "plugin-content");
    const title = element("h3");
    const nameLink = element("a", "", name);
    nameLink.href = href;
    title.append(nameLink);
    content.append(title, element("code", "", component), element("p", "", description));
    article.append(content);

    const meta = element("div", "plugin-meta");
    const tag = element("span", "category-tag",
      labels[kind] || (kind ? kind[0].toUpperCase() + kind.slice(1) : "Plugin"));
    const version = element("span", "version", "Moodle™ Software " + String(plugin.moodle || ""));
    meta.append(tag, version);
    article.append(meta);

    const details = element("a", "plugin-link", "View details ");
    details.href = href;
    details.append(element("span", "", "›"));
    article.append(details);
    return article;
  }

  function applyFilters() {
    if (!grid) return;
    const term = query.trim().toLocaleLowerCase("en-US");
    let total = 0;
    cards.forEach(card => {
      const matches = (category === "all" || card.dataset.category === category)
        && (!term || card.dataset.search.includes(term));
      show(card, matches);
      if (matches) total++;
    });
    show(grid, total !== 0);
    show(empty, total === 0 && errorBox.hidden);
    heading.textContent = query || category !== "all" ? "Matching plugins" : "Featured plugins";
    count.textContent = total + (total === 1 ? " plugin" : " plugins");
  }

  filters.forEach(button => {
    button.setAttribute("aria-pressed", String(button.classList.contains("active")));
    button.addEventListener("click", () => {
      category = button.dataset.category || "all";
      filters.forEach(filter => {
        const active = filter === button;
        filter.classList.toggle("active", active);
        filter.setAttribute("aria-pressed", String(active));
      });
      applyFilters();
    });
  });

  search?.addEventListener("input", () => {
    query = search.value;
    clearSearch.hidden = !query;
    applyFilters();
  });
  clearSearch?.addEventListener("click", () => {
    search.value = "";
    query = "";
    clearSearch.hidden = true;
    search.focus();
    applyFilters();
  });

  grid?.addEventListener("click", event => {
    const button = event.target.closest?.("[data-favorite]");
    if (!button) return;
    const component = button.dataset.favorite;
    favorites = favorites.includes(component)
      ? favorites.filter(item => item !== component)
      : [...favorites, component];
    button.classList.toggle("selected", favorites.includes(component));
    try {
      localStorage.setItem("marketplace-favorites", JSON.stringify(favorites));
    } catch (_) {
      // Favorites still work during this visit.
    }
  });

  async function loadCatalog() {
    if (!grid) return;
    try {
      const response = await fetch(new URL("plugins.json", base), { cache: "no-cache" });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const plugins = await response.json();
      if (!Array.isArray(plugins)) throw new Error("The catalog must be a JSON array.");
      const components = new Set();
      const fragment = document.createDocumentFragment();
      for (const plugin of plugins) {
        if (!plugin || typeof plugin.component !== "string"
          || !/^[a-z][a-z0-9]*_[a-z0-9_]+$/.test(plugin.component)
          || components.has(plugin.component)) {
          throw new Error("Invalid or duplicate plugin component in plugins.json.");
        }
        components.add(plugin.component);
        const card = renderCard(plugin);
        cards.push(card);
        fragment.append(card);
      }
      grid.replaceChildren(fragment);
      grid.setAttribute("aria-busy", "false");
      show(errorBox, false);
      applyFilters();
    } catch (reason) {
      grid.setAttribute("aria-busy", "false");
      show(grid, false);
      show(empty, false);
      show(errorBox, true);
      count.textContent = "Catalog unavailable";
      errorMessage.textContent = "Unable to read plugins.json (" + reason.message + ").";
      console.error("Marketplace catalog:", reason);
    }
  }

  loadCatalog();
})();
