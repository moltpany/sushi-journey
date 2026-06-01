(function () {
  "use strict";

  const DATA_URL = "data/sushi-journey.json";
  const SUSHI_BIRTH_YEAR = 1037;
  const THEME_STORAGE_KEY = "sushi-journey-theme";

  // 苏轼一生大致可分的几个时期，也对应他不同的心境。
  // id 与每条作品的 period 字段一致，既用于「时期」筛选，也用于下方的「心境时期」分组。
  const PERIODS = [
    {
      id: "early",
      title: "早年与初仕（1037–1071）",
      range: "1037–1071",
      description: "生于眉山，二十一岁随父苏洵、弟苏辙赴汴京应举，一举成名，初仕凤翔。此时意气风发、怀抱经世之志，也已在「雪泥鸿爪」里写出对人生漂泊的早慧体悟。",
    },
    {
      id: "provincial",
      title: "外放州郡（1071–1079）",
      range: "1071–1079",
      description: "因与新法不合，自请外放，历任杭州、密州、徐州、湖州。关心民生、写景写农，词境日渐开阔；豪放词初露锋芒，悼亡与怀亲之作也写得深挚。",
    },
    {
      id: "huangzhou",
      title: "黄州贬谪（1080–1084）",
      range: "1080–1084",
      description: "「乌台诗案」后谪居黄州，躬耕东坡、自号「东坡居士」。由初到的孤惧（孤鸿、寒枝）转向旷达超脱（赤壁、烟雨），写下一生中最重要的诗文，是其文学与精神的高峰。",
    },
    {
      id: "return",
      title: "元祐还朝与再领州郡（1085–1093）",
      range: "1085–1093",
      description: "旧党执政，苏轼还朝任翰林学士等要职，又自请外任、再知杭州，主持疏浚西湖、修筑苏堤。荣枯起落之间，心态趋于平和成熟。",
    },
    {
      id: "lingnan",
      title: "岭海远谪（1094–1101）",
      range: "1094–1101",
      description: "新党再起，苏轼远谪惠州、再贬儋州（海南），是当时几近最重的处分。然而他身处南荒而安之若素，「日啖荔枝」「兹游奇绝」，把九死一生过成了旷达。北归途中卒于常州。",
    },
  ];

  const state = {
    entries: [],
    filtered: [],
    selectedId: null,
    map: null,
    markers: new Map(),
  };

  function getPeriod(id) {
    return PERIODS.find((period) => period.id === id) || null;
  }

  function filterEntries(entries, filters) {
    const query = normalizeSearchQuery(filters.query);
    return entries.filter((entry) => {
      const cityMatches = !filters.city || filters.city === "all" || entry.city === filters.city;
      const genreMatches = !filters.genre || filters.genre === "all" || entry.genre === filters.genre;
      const periodMatches = !filters.period || filters.period === "all" || entry.period === filters.period;
      const queryMatches = !query || getEntrySearchText(entry).includes(query);
      return cityMatches && genreMatches && periodMatches && queryMatches;
    });
  }

  function normalizeSearchQuery(query) {
    return String(query || "").trim().toLowerCase();
  }

  function getEntrySearchText(entry) {
    const period = getPeriod(entry.period);
    return [
      entry.work,
      entry.catalogue,
      entry.city,
      entry.country,
      entry.genre,
      entry.year,
      period ? period.title : "",
      entry.original,
    ].filter(Boolean).join(" ").toLowerCase();
  }

  function getFilterOptions(entries, key) {
    return [...new Set(entries.map((entry) => entry[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
  }

  function byYearThenCity(a, b) {
    return a.year - b.year || a.city.localeCompare(b.city, "zh-Hans-CN");
  }

  function getEntryCoordinates(entry) {
    if (entry.place && typeof entry.place.lat === "number" && typeof entry.place.lng === "number") {
      return [entry.place.lat, entry.place.lng];
    }
    return [entry.lat, entry.lng];
  }

  function getAge(year) {
    return year - SUSHI_BIRTH_YEAR;
  }

  function formatAge(year) {
    return `${getAge(year)} 岁`;
  }

  function getPeriodGroups(entries) {
    return PERIODS.map((period) => ({
      ...period,
      entries: entries
        .filter((entry) => entry.period === period.id || (Array.isArray(entry.collections) && entry.collections.includes(period.id)))
        .sort(byYearThenCity),
    })).filter((period) => period.entries.length > 0);
  }

  function $(id) {
    return document.getElementById(id);
  }

  function setText(id, text) {
    const element = $(id);
    if (element) {
      element.textContent = text;
    }
  }

  function getStoredTheme() {
    try {
      return window.localStorage ? window.localStorage.getItem(THEME_STORAGE_KEY) : null;
    } catch (error) {
      return null;
    }
  }

  function saveTheme(theme) {
    try {
      if (window.localStorage) {
        window.localStorage.setItem(THEME_STORAGE_KEY, theme);
      }
    } catch (error) {
      // localStorage 在 file:// 或隐私模式下可能不可用。
    }
  }

  function normalizeTheme(theme) {
    return theme === "dark" ? "dark" : "light";
  }

  function applyTheme(theme, persist) {
    const normalized = normalizeTheme(theme);
    document.documentElement.dataset.theme = normalized;
    const button = $("theme-toggle");
    if (button) {
      const isDark = normalized === "dark";
      button.textContent = isDark ? "白天" : "黑夜";
      button.setAttribute("aria-pressed", isDark ? "true" : "false");
      button.setAttribute("aria-label", isDark ? "切换到白天模式" : "切换到黑夜模式");
    }
    if (persist) {
      saveTheme(normalized);
    }
    return normalized;
  }

  function getInitialTheme() {
    const stored = getStoredTheme();
    if (stored === "dark" || stored === "light") {
      return stored;
    }
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
    return "light";
  }

  function toggleTheme() {
    const current = normalizeTheme(document.documentElement.dataset.theme);
    return applyTheme(current === "dark" ? "light" : "dark", true);
  }

  function initTheme() {
    applyTheme(getInitialTheme(), false);
    const button = $("theme-toggle");
    if (button) {
      button.addEventListener("click", toggleTheme);
    }
  }

  async function loadEntries() {
    try {
      const response = await fetch(DATA_URL);
      if (!response.ok) {
        throw new Error(`无法加载 ${DATA_URL}`);
      }
      return response.json();
    } catch (error) {
      if (Array.isArray(window.SUSHI_JOURNEY_DATA)) {
        return window.SUSHI_JOURNEY_DATA;
      }
      throw error;
    }
  }

  function buildSelect(select, options, allLabel) {
    select.innerHTML = "";
    const all = document.createElement("option");
    all.value = "all";
    all.textContent = allLabel;
    select.appendChild(all);

    for (const optionValue of options) {
      const option = document.createElement("option");
      option.value = optionValue;
      option.textContent = optionValue;
      select.appendChild(option);
    }
  }

  function buildPeriodSelect(select, periods) {
    select.innerHTML = "";
    const all = document.createElement("option");
    all.value = "all";
    all.textContent = "全部时期";
    select.appendChild(all);

    for (const period of periods) {
      const option = document.createElement("option");
      option.value = period.id;
      option.textContent = period.title;
      select.appendChild(option);
    }
  }

  function currentFilters() {
    const search = $("search-filter");
    return {
      city: $("city-filter").value,
      genre: $("genre-filter").value,
      period: $("period-filter").value,
      query: search ? search.value : "",
    };
  }

  function initFilters(entries) {
    buildSelect($("city-filter"), getFilterOptions(entries, "city"), "全部地点");
    buildSelect($("genre-filter"), getFilterOptions(entries, "genre"), "全部体裁");
    const presentPeriods = PERIODS.filter((period) => entries.some((entry) => entry.period === period.id));
    buildPeriodSelect($("period-filter"), presentPeriods);
    for (const id of ["city-filter", "genre-filter", "period-filter"]) {
      $(id).addEventListener("change", applyFilters);
    }
    const search = $("search-filter");
    if (search) {
      search.addEventListener("input", applyFilters);
    }
  }

  function initMap() {
    const warning = $("map-warning");
    if (!window.L) {
      warning.hidden = false;
      return;
    }

    state.map = L.map("map", {
      scrollWheelZoom: true,
      worldCopyJump: true,
    }).setView([31.5, 114], 5);

    const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    });

    tiles.on("tileerror", () => {
      warning.hidden = false;
    });
    tiles.addTo(state.map);
  }

  function renderMarkers(entries) {
    if (!state.map) {
      return;
    }

    state.map.closePopup();
    for (const marker of state.markers.values()) {
      marker.closePopup();
      state.map.removeLayer(marker);
    }
    state.map.closePopup();
    document.querySelectorAll(".leaflet-popup").forEach((popup) => popup.remove());
    state.markers.clear();

    for (const entry of entries) {
      const coords = getEntryCoordinates(entry);
      const placeLine = entry.place ? `<br><span>${entry.place.name}</span>` : "";
      const marker = L.marker(coords).addTo(state.map);
      marker.bindPopup(`
        <strong>${entry.city} · ${entry.year}</strong><br>
        《${entry.work}》${placeLine}
        <br><button type="button" class="popup-detail-link" data-id="${entry.id}" aria-label="查看《${entry.work}》的作品详情">查看作品详情</button>
      `);
      marker.on("click", () => selectEntry(entry.id, false, false));
      marker.on("popupopen", () => {
        const popup = marker.getPopup && marker.getPopup().getElement ? marker.getPopup().getElement() : null;
        const detailLink = popup ? popup.querySelector(".popup-detail-link") : null;
        if (detailLink) {
          detailLink.addEventListener("click", () => selectEntry(entry.id, false, true), { once: true });
        }
      });
      state.markers.set(entry.id, marker);
    }

    if (entries.length > 1) {
      const bounds = L.latLngBounds(entries.map(getEntryCoordinates));
      state.map.fitBounds(bounds, { padding: [36, 36] });
    } else if (entries.length === 1) {
      state.map.setView(getEntryCoordinates(entries[0]), 7);
    }
  }

  function renderTimeline(entries) {
    const list = $("timeline-list");
    list.innerHTML = "";

    for (const entry of entries.slice().sort(byYearThenCity)) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "timeline-item";
      button.dataset.id = entry.id;
      button.innerHTML = `
        <span class="timeline-year">${entry.year}<small>${formatAge(entry.year)}</small></span>
        <span class="timeline-body">
          <strong>${entry.city}</strong>
          <span>《${entry.work}》· ${entry.genre}</span>
        </span>
      `;
      button.addEventListener("click", () => selectEntry(entry.id, true, false));
      list.appendChild(button);
    }
  }

  function renderSources(entries) {
    const container = $("source-list");
    container.innerHTML = "";
    for (const entry of entries.slice().sort(byYearThenCity)) {
      const link = document.createElement("a");
      link.href = entry.source.url;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = `${entry.year} ${entry.city}《${entry.work}》：${entry.source.label}`;
      container.appendChild(link);
    }
  }

  function renderPeriods(entries) {
    const container = $("period-list");
    if (!container) {
      return;
    }

    const groups = getPeriodGroups(entries);
    container.innerHTML = "";
    renderPeriodNav(groups);
    for (const period of groups) {
      const section = document.createElement("article");
      section.className = "period-card";
      section.id = `period-${period.id}`;

      const items = period.entries.map((entry) => `
        <button type="button" class="period-item" data-id="${entry.id}" aria-pressed="false">
          <span>${entry.year} · ${formatAge(entry.year)} · ${entry.city}</span>
          <strong>《${entry.work}》</strong>
          <small>${entry.catalogue}</small>
        </button>
      `).join("");

      section.innerHTML = `
        <div class="period-card-head">
          <h3>${period.title}</h3>
          <p>${period.description}</p>
        </div>
        <div class="period-items">${items}</div>
      `;

      section.querySelectorAll(".period-item").forEach((button) => {
        button.addEventListener("click", () => selectEntry(button.dataset.id, true, true));
      });
      container.appendChild(section);
    }
    highlightSelected();
  }

  function renderPeriodNav(periods) {
    const nav = $("period-nav");
    if (!nav) {
      return;
    }

    nav.replaceChildren();
    for (const period of periods) {
      const link = document.createElement("a");
      link.href = `#period-${period.id}`;
      link.textContent = `${period.title}（${period.entries.length}）`;
      nav.appendChild(link);
    }
  }

  function highlightSelected() {
    document.querySelectorAll(".timeline-item").forEach((item) => {
      item.classList.toggle("is-active", item.dataset.id === state.selectedId);
    });
    document.querySelectorAll(".period-item").forEach((item) => {
      const selected = item.dataset.id === state.selectedId;
      item.classList.toggle("is-active", selected);
      item.setAttribute("aria-pressed", selected ? "true" : "false");
    });
  }

  function updateTimelineSelection(entry) {
    const container = $("timeline-selection");
    const text = $("timeline-selection-text");
    if (!container || !text) {
      return;
    }
    if (!entry) {
      text.textContent = "";
      container.hidden = true;
      return;
    }
    text.textContent = `已选中：${entry.year} ·《${entry.work}》`;
    container.hidden = false;
  }

  function renderDetail(entry) {
    if (!entry) {
      setText("detail-work", "没有匹配的作品");
      setText("detail-meta", "请调整筛选条件。");
      renderOriginal(null);
      renderDetailPeriod(null);
      renderReading(null);
      setText("detail-context", "当前筛选没有结果。");
      setText("detail-meaning", "当前筛选没有结果。");
      renderPlace(null);
      const mapLink = $("detail-map-link");
      if (mapLink) {
        mapLink.hidden = true;
      }
      $("detail-source").hidden = true;
      return;
    }

    const period = getPeriod(entry.period);
    setText("detail-work", `《${entry.work}》`);
    setText("detail-meta", `${entry.year} · ${formatAge(entry.year)} · ${entry.city}，${entry.country} · ${entry.genre}（${entry.catalogue}）`);
    renderOriginal(entry);
    renderDetailPeriod(period);
    renderReading(entry);
    setText("detail-context", entry.context);
    setText("detail-meaning", entry.meaning);
    renderPlace(entry.place);
    const mapLink = $("detail-map-link");
    if (mapLink) {
      mapLink.hidden = false;
    }
    const source = $("detail-source");
    source.href = entry.source.url;
    source.textContent = `查看参考来源：${entry.source.label}`;
    source.hidden = false;
  }

  function renderOriginal(entry) {
    const container = $("detail-original");
    const text = $("detail-original-text");
    if (!container || !text) {
      return;
    }
    if (!entry || !entry.original) {
      text.textContent = "";
      container.hidden = true;
      return;
    }
    text.textContent = entry.original;
    container.hidden = false;
  }

  function renderDetailPeriod(period) {
    const container = $("detail-period");
    if (!container) {
      return;
    }
    container.replaceChildren();
    if (!period) {
      container.hidden = true;
      return;
    }
    const link = document.createElement("a");
    link.className = "detail-period-link";
    link.href = `#period-${period.id}`;
    link.textContent = period.title;
    container.appendChild(link);
    container.hidden = false;
  }

  function renderReading(entry) {
    const container = $("detail-reading");
    const links = $("detail-reading-links");
    const note = $("detail-reading-note");
    if (!container || !links) {
      return;
    }
    if (!entry) {
      links.replaceChildren();
      if (note) {
        note.textContent = "";
      }
      container.hidden = true;
      return;
    }

    // 通过公开诗词库的检索链接，方便读者查看全文、注释与不同版本。
    const keyword = encodeURIComponent(`苏轼 ${entry.work}`);
    const actions = [
      ["古诗文网", `https://so.gushiwen.cn/search.aspx?type=guwen&page=1&value=${encodeURIComponent(entry.work)}`],
      ["搜韵", `https://sou-yun.cn/Query.aspx?type=poem1&key=${encodeURIComponent(entry.work)}`],
      ["维基文库", `https://zh.wikisource.org/wiki/Special:Search?search=${keyword}`],
    ];

    links.replaceChildren();
    if (note) {
      note.textContent = `延伸阅读：《${entry.work}》全文、注释与版本`;
    }
    for (const [label, url] of actions) {
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = label;
      link.setAttribute("aria-label", `在 ${label} 检索《${entry.work}》`);
      links.appendChild(link);
    }
    container.hidden = false;
  }

  function renderPlace(place) {
    const container = $("detail-place");
    if (!container || !place) {
      if (container) {
        container.hidden = true;
      }
      return;
    }

    setText("detail-place-kind", `${place.kind} · 定位可信度：${place.certainty}`);
    setText("detail-place-name", place.name);
    setText("detail-place-address", place.address);
    setText("detail-place-note", place.note);
    const source = $("detail-place-source");
    source.href = place.source.url;
    source.textContent = `查看地点来源：${place.source.label}`;
    container.hidden = false;
  }

  function focusEntryOnMap(entry, scrollToMap) {
    const mapElement = $("map");
    if (scrollToMap && mapElement && typeof mapElement.scrollIntoView === "function") {
      mapElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    if (state.map) {
      state.map.setView(getEntryCoordinates(entry), Math.max(state.map.getZoom(), 6), { animate: true });
      if (state.markers.has(entry.id)) {
        state.markers.get(entry.id).openPopup();
      }
    }
  }

  function selectEntry(id, focusMap, scrollToDetail) {
    const entry = state.filtered.find((item) => item.id === id) || state.entries.find((item) => item.id === id);
    if (!entry) {
      return;
    }
    state.selectedId = entry.id;
    renderDetail(entry);
    highlightSelected();
    updateTimelineSelection(entry);

    if (scrollToDetail) {
      const detail = $("detail");
      if (detail && typeof detail.scrollIntoView === "function") {
        detail.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }

    if (focusMap) {
      focusEntryOnMap(entry, false);
    }
  }

  function initDetailActions() {
    const mapLink = $("detail-map-link");
    if (!mapLink) {
      return;
    }
    mapLink.addEventListener("click", () => {
      const entry = state.entries.find((item) => item.id === state.selectedId);
      if (entry) {
        focusEntryOnMap(entry, true);
      }
    });
  }

  function initTimelineActions() {
    const detailLink = $("timeline-detail-link");
    if (!detailLink) {
      return;
    }
    detailLink.addEventListener("click", () => {
      if (state.selectedId) {
        selectEntry(state.selectedId, false, true);
      }
    });
  }

  function applyFilters() {
    state.filtered = filterEntries(state.entries, currentFilters()).sort(byYearThenCity);
    setText("result-count", `${state.filtered.length} 处足迹`);
    renderMarkers(state.filtered);
    renderTimeline(state.filtered);
    const stillVisible = state.filtered.some((entry) => entry.id === state.selectedId);
    const nextEntry = stillVisible ? state.filtered.find((entry) => entry.id === state.selectedId) : state.filtered[0];
    state.selectedId = nextEntry ? nextEntry.id : null;
    renderDetail(nextEntry);
    highlightSelected();
    updateTimelineSelection(nextEntry);
  }

  async function init() {
    try {
      initTheme();
      state.entries = (await loadEntries()).sort(byYearThenCity);
      initFilters(state.entries);
      initMap();
      initDetailActions();
      initTimelineActions();
      renderPeriods(state.entries);
      renderSources(state.entries);
      applyFilters();
    } catch (error) {
      console.error(error);
      setText("result-count", "数据未加载");
      setText("detail-work", "数据加载失败");
      setText("detail-meta", "请通过本地静态服务器打开本页面，例如 python -m http.server 8000。");
      setText("detail-context", "浏览器直接打开 file:// 页面时，可能会禁止读取 data/sushi-journey.json。");
      setText("detail-meaning", "启动本地服务器后再访问 http://localhost:8000 即可完整查看地图与时间线。");
      $("map-warning").hidden = false;
    }
  }

  window.SushiJourney = {
    PERIODS,
    filterEntries,
    getFilterOptions,
    getEntryCoordinates,
    getAge,
    formatAge,
    getPeriod,
    getPeriodGroups,
    applyTheme,
    getInitialTheme,
    toggleTheme,
    loadEntries,
  };

  if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", init);
  }
})();
