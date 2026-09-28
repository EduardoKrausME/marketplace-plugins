(() => {
  "use strict";

  let category = "all";
  let query = "";
  let favorites = [];

  try {
    const storedFavorites = JSON.parse(localStorage.getItem("marketplace-favorites") || "[]");
    favorites = Array.isArray(storedFavorites) ? storedFavorites : [];
  } catch (error) {
    favorites = [];
  }

  const grid = document.querySelector("#plugin-grid");
  const cards = Array.from(grid?.querySelectorAll("[data-plugin-card]") || []);
  const empty = document.querySelector("#empty");
  const search = document.querySelector("#search");
  const clearSearch = document.querySelector("#clear-search");
  const title = document.querySelector("#section-title");
  const count = document.querySelector("#result-count");
  const filterButtons = Array.from(
    document.querySelectorAll(".filters > button[data-category]")
  );

  function setElementVisible(element, visible) {
    if (!element) return;

    element.hidden = !visible;
    element.style.display = visible ? "" : "none";
  }

  function applyFilters() {
    if (!grid || !empty || !title || !count) return;

    const term = query.trim().toLocaleLowerCase("en-US");
    let visibleCount = 0;

    cards.forEach(card => {
      const cardCategory = card.dataset.category || "";
      const searchableText = (card.dataset.search || "").toLocaleLowerCase("en-US");
      const matchesCategory = category === "all" || cardCategory === category;
      const matchesSearch = !term || searchableText.includes(term);
      const isVisible = matchesCategory && matchesSearch;

      setElementVisible(card, isVisible);
      if (isVisible) visibleCount += 1;
    });

    setElementVisible(grid, visibleCount !== 0);
    setElementVisible(empty, visibleCount === 0);

    title.textContent = query || category !== "all"
      ? "Matching plugins"
      : "Featured plugins";
    count.textContent = `${visibleCount} ${visibleCount === 1 ? "plugin" : "plugins"}`;
  }

  function applyFavoriteState() {
    grid?.querySelectorAll("[data-favorite]").forEach(button => {
      button.classList.toggle("selected", favorites.includes(button.dataset.favorite));
    });
  }

  filterButtons.forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();

      category = button.dataset.category || "all";
      filterButtons.forEach(item => {
        item.classList.toggle("active", item === button);
        item.setAttribute("aria-pressed", item === button ? "true" : "false");
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

  grid?.addEventListener("error", event => {
    const image = event.target.closest?.(".plugin-icon img");
    if (!image) return;

    image.closest(".plugin-icon").innerHTML = '<span class="plugin-icon-fallback">EK</span>';
  }, true);

  grid?.addEventListener("click", event => {
    const button = event.target.closest?.("[data-favorite]");
    if (!button) return;

    const component = button.dataset.favorite;
    favorites = favorites.includes(component)
      ? favorites.filter(item => item !== component)
      : [...favorites, component];

    try {
      localStorage.setItem("marketplace-favorites", JSON.stringify(favorites));
    } catch (error) {
      // The favorite still works in the current page when storage is unavailable.
    }

    button.classList.toggle("selected");
  });

  filterButtons.forEach(button => {
    button.setAttribute("aria-pressed", button.classList.contains("active") ? "true" : "false");
  });

  applyFavoriteState();
  applyFilters();
})();
