import { loadActivityData } from "../data-service.js";
import { icon } from "../icons.js";
import { runCard, runRow, runUrl } from "../run-card.js";
import { buildStats, fmt, hrBandOf } from "../stats.js";
import { $, $$, escapeHtml as esc, initCounters, observeReveals, tooltip } from "../ui.js";

const FILTERS = [
  { id: "all", label: "All runs", icon: "layers", test: () => true },
  { id: "outdoor", label: "Outdoor", icon: "outdoor", test: (r) => !r.indoor },
  { id: "indoor", label: "Indoor", icon: "treadmill", test: (r) => r.indoor },
  { id: "10k", label: "10K+", icon: "distance", test: (r) => r.km >= 10 },
  { id: "20k", label: "20K+", icon: "route", test: (r) => r.km >= 20 },
  { id: "ultra", label: "Ultra 42K+", icon: "trophy", test: (r) => r.km >= 42 },
];

const SORTS = {
  newest: { label: "Newest first", fn: (a, b) => b.date - a.date || b.index - a.index },
  oldest: { label: "Oldest first", fn: (a, b) => a.date - b.date || a.index - b.index },
  longest: { label: "Longest", fn: (a, b) => b.km - a.km },
  shortest: { label: "Shortest", fn: (a, b) => a.km - b.km },
  fastest: { label: "Fastest pace", fn: (a, b) => a.pace - b.pace },
  slowest: { label: "Slowest pace", fn: (a, b) => b.pace - a.pace },
  hr: { label: "Highest heart rate", fn: (a, b) => b.hr - a.hr },
  calories: { label: "Most calories", fn: (a, b) => b.calories - a.calories },
};

const PER_PAGE = [12, 24, 48];
const DEFAULTS = { q: "", type: "all", month: "all", sort: "newest", view: "grid", page: 1, per: 12 };

let stats;
let state;

export async function render() {
  stats = buildStats(await loadActivityData());
  state = readState();
  renderHeader();
  renderControls();
  renderBarcode();
  update({ scroll: false });
  initCounters();

  window.addEventListener("popstate", () => {
    state = readState();
    syncControls();
    update({ scroll: false, push: false });
  });
}

/* ---------- URL state ---------- */
function readState() {
  const p = new URLSearchParams(window.location.search);
  const s = { ...DEFAULTS };
  if (p.get("q")) s.q = p.get("q");
  if (FILTERS.some((f) => f.id === p.get("type"))) s.type = p.get("type");
  if (p.get("month")) s.month = p.get("month");
  if (SORTS[p.get("sort")]) s.sort = p.get("sort");
  if (p.get("view") === "list") s.view = "list";
  if (PER_PAGE.includes(Number(p.get("per")))) s.per = Number(p.get("per"));
  s.page = Math.max(1, parseInt(p.get("page"), 10) || 1);
  return s;
}

function writeState(push) {
  const p = new URLSearchParams();
  Object.entries(state).forEach(([k, v]) => {
    if (v !== DEFAULTS[k] && v !== "") p.set(k, v);
  });
  const url = `${window.location.pathname}${p.toString() ? `?${p}` : ""}`;
  if (push) history.pushState(null, "", url);
  else history.replaceState(null, "", url);
}

const monthKey = (d) => `${d.getFullYear()}-${d.getMonth() + 1}`;

function filtered() {
  const q = state.q.trim().toLowerCase();
  const test = FILTERS.find((f) => f.id === state.type).test;
  return stats.runs
    .filter((r) => test(r))
    .filter((r) => state.month === "all" || monthKey(r.date) === state.month)
    .filter((r) => !q || `${r.name} ${fmt.date(r.date)} ${r.sport}`.toLowerCase().includes(q))
    .sort(SORTS[state.sort].fn);
}

/* ---------- Static parts ---------- */
function renderHeader() {
  const t = stats.totals;
  const set = (key, v) => {
    const node = $(`[data-count-key="${key}"]`);
    if (node) node.dataset.count = v;
  };
  set("runs", t.runs);
  set("km", Math.round(t.km));
  set("hours", Math.round(t.hours));
  set("kcal", Math.round(t.calories));
  const period = $('[data-bind="period"]');
  if (period) period.textContent = `${fmt.date(stats.first)} – ${fmt.date(stats.last)}`;
}

function renderControls() {
  const chips = $("#filterChips");
  chips.innerHTML = FILTERS.map((f) => {
    const count = stats.runs.filter(f.test).length;
    return `<button class="chip-filter" data-type="${f.id}" aria-pressed="false">${icon(f.icon)}${f.label}<sup>${count}</sup></button>`;
  }).join("");
  chips.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-type]");
    if (!btn) return;
    state.type = btn.dataset.type;
    state.page = 1;
    syncControls();
    update();
  });

  const months = [...new Map(stats.runs.map((r) => [monthKey(r.date), r.date])).entries()].reverse();
  $("#monthSelect").innerHTML =
    `<option value="all">All months</option>` + months.map(([k, d]) => `<option value="${k}">${fmt.monthYear(d)}</option>`).join("");
  $("#sortSelect").innerHTML = Object.entries(SORTS).map(([k, s]) => `<option value="${k}">${s.label}</option>`).join("");
  $("#perSelect").innerHTML = PER_PAGE.map((n) => `<option value="${n}">${n} per page</option>`).join("");

  $("#monthSelect").addEventListener("change", (e) => {
    state.month = e.target.value;
    state.page = 1;
    update();
  });
  $("#sortSelect").addEventListener("change", (e) => {
    state.sort = e.target.value;
    state.page = 1;
    update();
  });
  $("#perSelect").addEventListener("change", (e) => {
    state.per = Number(e.target.value);
    state.page = 1;
    update();
  });

  let timer;
  $("#searchInput").addEventListener("input", (e) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      state.q = e.target.value;
      state.page = 1;
      update({ scroll: false });
    }, 180);
  });

  $$("[data-view]").forEach((btn) =>
    btn.addEventListener("click", () => {
      state.view = btn.dataset.view;
      syncControls();
      update({ scroll: false });
    })
  );

  $("#pagination").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-page]");
    if (!btn || btn.disabled) return;
    state.page = Number(btn.dataset.page);
    update({ push: true });
  });

  $("#clearFilters")?.addEventListener("click", () => {
    state = { ...DEFAULTS, view: state.view, per: state.per };
    syncControls();
    update();
  });

  syncControls();
}

function syncControls() {
  $$("[data-type]").forEach((b) => {
    const on = b.dataset.type === state.type;
    b.classList.toggle("is-active", on);
    b.setAttribute("aria-pressed", on);
  });
  $("#monthSelect").value = state.month;
  $("#sortSelect").value = state.sort;
  $("#perSelect").value = String(state.per);
  $("#searchInput").value = state.q;
  $$("[data-view]").forEach((b) => b.classList.toggle("is-active", b.dataset.view === state.view));
}

/* Every run in the log as one bar, in date order */
function renderBarcode() {
  const wrap = $("#runBarcode");
  if (!wrap) return;
  const max = Math.max(...stats.runs.map((r) => r.km));
  wrap.innerHTML = stats.runs
    .map((r, i) => {
      const h = 8 + Math.sqrt(r.km / max) * 92;
      return `<a href="${runUrl(r)}" data-i="${i}" style="--h:${h}%;--c:${hrBandOf(r.hr).color};--d:${i * 8}ms" aria-label="${esc(r.name)} ${fmt.date(r.date)}"></a>`;
    })
    .join("");
  wrap.addEventListener("mousemove", (e) => {
    const a = e.target.closest("[data-i]");
    if (!a) return tooltip.hide();
    const r = stats.runs[a.dataset.i];
    tooltip.show(e, `${esc(r.name)} · ${fmt.shortDate(r.date)} <span>· ${fmt.km(r.km)} km · ${r.hr} bpm</span>`);
  });
  wrap.addEventListener("mouseleave", tooltip.hide);
}

/* ---------- Results ---------- */
function pageList(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, current, current - 1, current + 1]);
  if (current <= 3) [2, 3, 4].forEach((n) => set.add(n));
  if (current >= total - 2) [total - 1, total - 2, total - 3].forEach((n) => set.add(n));
  const nums = [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  return nums.flatMap((n, i) => (i && n - nums[i - 1] > 1 ? ["…", n] : [n]));
}

function update({ scroll = true, push = false } = {}) {
  const list = filtered();
  const pages = Math.max(1, Math.ceil(list.length / state.per));
  state.page = Math.min(state.page, pages);
  writeState(push);

  const start = (state.page - 1) * state.per;
  const slice = list.slice(start, start + state.per);
  const km = list.reduce((a, r) => a + r.km, 0);

  $("#resultMeta").innerHTML = list.length
    ? `Showing <b>${start + 1}–${start + slice.length}</b> of <b>${list.length}</b> runs <span>·</span> <b>${fmt.km(km)}</b> km in view`
    : "No runs match these filters";

  const ids = new Set(list.map((r) => r.id));
  $$("#runBarcode [data-i]").forEach((a) => a.classList.toggle("is-dim", !ids.has(stats.runs[a.dataset.i].id)));

  const results = $("#results");
  results.className = `results results--${state.view}`;
  if (!slice.length) {
    results.innerHTML = `
      <div class="empty-state">
        ${icon("search")}
        <h3>No runs found</h3>
        <p>Try a different search or clear the filters.</p>
        <button class="btn" id="emptyClear">Clear filters</button>
      </div>`;
    $("#emptyClear").addEventListener("click", () => {
      state = { ...DEFAULTS, view: state.view, per: state.per };
      syncControls();
      update();
    });
  } else {
    results.innerHTML = state.view === "grid" ? gridHtml(slice, list) : listHtml(slice);
  }

  renderPagination(pages);
  observeReveals(results);
  if (scroll) $("#historyTop").scrollIntoView({ behavior: "smooth", block: "start" });
}

function gridHtml(slice, list) {
  const byDate = state.sort === "newest" || state.sort === "oldest";
  let lastMonth = null;
  return slice
    .map((r, i) => {
      let divider = "";
      if (byDate && monthKey(r.date) !== lastMonth) {
        lastMonth = monthKey(r.date);
        const inMonth = list.filter((x) => monthKey(x.date) === lastMonth);
        const mkm = inMonth.reduce((a, x) => a + x.km, 0);
        divider = `
          <div class="month-divider reveal">
            <span>${fmt.monthYear(r.date)}</span>
            <i></i>
            <small>${inMonth.length} runs · ${fmt.km(mkm, 0)} km</small>
          </div>`;
      }
      return divider + runCard(r, { longestKm: stats.longest.km, delay: (i % 6) * 60 });
    })
    .join("");
}

function listHtml(slice) {
  return `
    <div class="run-table reveal">
      <div class="run-row run-row--head">
        <span>Date</span><span>Run</span><span>Distance</span><span>Time</span><span>Pace</span><span>HR</span><span>Calories</span><span></span>
      </div>
      ${slice.map(runRow).join("")}
    </div>`;
}

function renderPagination(pages) {
  const nav = $("#pagination");
  if (pages <= 1) {
    nav.innerHTML = "";
    return;
  }
  const p = state.page;
  nav.innerHTML = `
    <button class="page-btn page-btn--nav" data-page="${p - 1}" ${p === 1 ? "disabled" : ""} aria-label="Previous page">${icon("chevronLeft")}<span>Prev</span></button>
    <div class="page-nums">
      ${pageList(p, pages)
        .map((n) =>
          n === "…"
            ? `<span class="page-gap">…</span>`
            : `<button class="page-btn${n === p ? " is-current" : ""}" data-page="${n}" ${n === p ? 'aria-current="page"' : ""}>${n}</button>`
        )
        .join("")}
    </div>
    <span class="page-mobile">Page ${p} of ${pages}</span>
    <button class="page-btn page-btn--nav" data-page="${p + 1}" ${p === pages ? "disabled" : ""} aria-label="Next page"><span>Next</span>${icon("chevronRight")}</button>`;
}
