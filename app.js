import { loadActivityData } from "./js/data-service.js";
import { buildStats, fmt, tierOf } from "./js/stats.js";
import * as charts from "./js/charts.js";
import {
  $,
  $$,
  escapeHtml as esc,
  initCounters,
  initGallery,
  initNav,
  initTimelineProgress,
  observeReveals,
} from "./js/ui.js";

initNav();
initGallery();

if (document.body.dataset.page === "profile") {
  renderProfile();
} else {
  observeReveals();
}

async function renderProfile() {
  try {
    const stats = buildStats(await loadActivityData());
    bindText(textBindings(stats));
    bindCounts(countBindings(stats));
    renderMarquee(stats);
    renderDashboard(stats);
    renderFeatured(stats);
    renderBests(stats);
    renderTimeline(stats);
  } catch (err) {
    console.error(err);
    showDataError(err);
  }
  observeReveals();
  initCounters();
  initTimelineProgress();
}

/* =========================================================
   Bindings: [data-bind="key"] gets text, [data-count-key="key"] gets an animated number
   ========================================================= */
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const signed = (pct) => `${pct >= 0 ? "▲" : "▼"} ${Math.abs(Math.round(pct * 100))}%`;

function textBindings(s) {
  const { totals, longest, latest, months } = s;
  const firstMonth = months[0];
  const lastMonth = months[months.length - 1];
  const paceDelta = lastMonth.pace - firstMonth.pace;

  return {
    latestRun: `Last run · ${fmt.shortDate(latest.date)} · ${fmt.km(latest.km)} km`,
    heroLongest: `${fmt.km(longest.km, 0)} km longest run`,
    chipLongestKm: `${fmt.km(longest.km, 0)} KM`,
    chipLongestName: longest.name,
    chipLast30: `${fmt.km(totals.last30Km, 0)} km`,
    period: `${fmt.shortDate(s.first)} – ${fmt.date(s.last)}`,
    syncSummary: `${totals.runs} runs and ${fmt.km(totals.hours, 0)} hours on feet, synced from ${s.source}. Every chart below is built from that log.`,
    weeklyTrend: `${signed(s.weekly.trend)} vs previous 6 weeks`,
    runDaysTitle: `${totals.spanDays} days of training`,
    runDays: totals.runDays.toLocaleString("en"),
    restDays: (totals.spanDays - totals.runDays).toLocaleString("en"),
    paceLatest: fmt.pace(lastMonth.pace),
    paceTrend:
      months.length > 1
        ? `${paceDelta <= 0 ? "▼" : "▲"} ${fmt.pace(Math.abs(paceDelta))} ${paceDelta <= 0 ? "faster" : "slower"} since ${firstMonth.label}`
        : "",
    longestStreak: `Longest streak · ${totals.longestStreak} days`,
    totalHours: `${fmt.km(totals.hours, 0)} h`,
    totalCalories: `${Math.round(totals.calories).toLocaleString("en")} kcal`,
    featuredKm: fmt.km(longest.km, 0),
    featuredLead: `${longest.name} on ${fmt.date(longest.date)}: ${fmt.km(longest.km, 2)} km in ${fmt.duration(longest.seconds)}, holding ${fmt.pace(longest.pace)}/km at ${longest.hr} bpm. The longest day in the log.`,
    featuredTag: `${tierOf(longest.km)} · ${fmt.km(longest.km, 0)}K`,
    featuredName: longest.name,
    featuredDate: fmt.shortDate(longest.date),
    featuredTime: fmt.duration(longest.seconds),
    featuredPace: `${fmt.pace(longest.pace)}/km`,
    featuredHr: `${longest.hr} bpm`,
    featuredCalories: `${longest.calories.toLocaleString("en")} kcal`,
    longCount: `${s.longRuns.length}`,
    effortHr: `${Math.round(totals.avgHr)}`,
    effortSubtitle: `${s.efforts.length} runs faster than ${fmt.pace(s.maxRunningPace)}/km`,
    footerSource: `Data · ${s.source} · updated ${fmt.date(s.generatedAt)}`,
  };
}

function countBindings(s) {
  return {
    totalKm: Math.round(s.totals.km),
    runs: s.totals.runs,
    hours: Math.round(s.totals.hours),
    longestKm: Math.round(s.longest.km),
    ultras: s.totals.ultras,
    weeklyAvg: Math.round(s.weekly.avg),
    runDaysPct: Math.round((s.totals.runDays / s.totals.spanDays) * 100),
    heatRunDays: s.totals.runDays,
  };
}

function bindText(map) {
  $$("[data-bind]").forEach((node) => {
    const value = map[node.dataset.bind];
    if (value !== undefined) node.textContent = value;
  });
}

function bindCounts(map) {
  $$("[data-count-key]").forEach((node) => {
    const value = map[node.dataset.countKey];
    if (value !== undefined) node.dataset.count = value;
  });
}

/* =========================================================
   Sections
   ========================================================= */
function renderMarquee(s) {
  const track = $("#marqueeTrack");
  if (!track) return;
  const names = [...new Map([...s.longRuns].sort((a, b) => b.km - a.km).map((r) => [r.name, r])).values()]
    .map((r) => `${r.name} · ${fmt.km(r.km, 0)}K`);
  let items = names.length ? names : [`${fmt.km(s.totals.km, 0)} km logged`];
  while (items.length < 5) items = items.concat(items);
  track.innerHTML = [...items, ...items].map((t) => `<span class="marquee__item">${esc(t)}</span>`).join("");
}

function renderDashboard(s) {
  const paceDelta = s.months[s.months.length - 1].pace - s.months[0].pace;
  $('[data-bind="weeklyTrend"]')?.classList.toggle("trend--muted", s.weekly.trend < 0);
  $('[data-bind="paceTrend"]')?.classList.toggle("trend--muted", paceDelta > 0);

  const weekKm = s.weeks.map((w) => w.km);
  const peak = Math.max(...weekKm);
  charts.barChart($("#weeklyChart"), {
    values: weekKm,
    labels: s.weeks.map((w) => w.label),
    highlight: (v) => v > 0 && v === peak,
    topLabel: (v) => (v > 0 && v === peak ? `${fmt.km(v, 0)} km` : ""),
    tip: (v, i) => {
      const w = s.weeks[i];
      return `${fmt.shortDate(w.start)} – ${fmt.shortDate(addDays(w.start, 6))} · ${fmt.km(v)} km <span>· ${w.runs} runs</span>`;
    },
  });

  charts.ringChart($("#runDaysRing .progress"), s.totals.runDays / s.totals.spanDays);

  charts.donutChart($("#mixDonut"), $("#mixLegend"), s.mix, (seg) => `${esc(seg.name)} · ${fmt.km(seg.km, 0)} km`);

  charts.barList(
    $("#hrBands"),
    s.hrBands.map((b) => ({ label: b.label, value: b.value, color: b.color, display: `${b.value}%`, title: `${b.hours.toFixed(1)} hours` }))
  );

  charts.lineChart($("#paceChart"), {
    values: s.months.map((m) => m.pace),
    labels: s.months.map((m) => m.label),
    color: "#c6f432",
    invert: true,
    tip: (v, i) => `${s.months[i].label} · ${fmt.pace(v)}/km <span>· ${fmt.km(s.months[i].km, 0)} km</span>`,
  });

  charts.heatmap($("#heatmap"), $("#heatMonths"), s.heatmap, (cell) =>
    cell.km ? `${fmt.shortDate(cell.date)} · ${fmt.km(cell.km)} km` : `${fmt.shortDate(cell.date)} · Rest`
  );

  charts.barList(
    $("#monthList"),
    s.months.map((m) => ({ label: m.label, value: m.km, color: "#3d6bff", display: `${fmt.km(m.km, 0)} km`, title: `${m.runs} runs` }))
  );
}

function renderFeatured(s) {
  const runTip = (r) =>
    `${esc(r.name)} · ${fmt.shortDate(r.date)} <span>· ${fmt.km(r.km)} km · ${fmt.pace(r.pace)}/km · ${r.hr} bpm</span>`;

  charts.barChart($("#longChart"), {
    values: s.longRuns.map((r) => r.km),
    labels: s.longRuns.map((r) => fmt.shortDate(r.date)),
    highlight: (v) => v >= 42,
    topLabel: (v) => fmt.km(v, 0),
    tip: (_, i) => runTip(s.longRuns[i]),
  });

  charts.scatterChart($("#effortChart"), {
    points: s.efforts,
    maxPace: s.maxRunningPace,
    highlight: (r) => r.km >= 42,
    tip: runTip,
  });
}

function renderBests(s) {
  const wrap = $("#pbs");
  if (!wrap) return;
  wrap.innerHTML = s.bests
    .map(
      (b, i) => `
      <div class="pb${b.ultra ? " pb--ultra" : ""} reveal" data-delay="${Math.min(i, 4)}">
        <span class="label"${b.ultra ? ' style="color:var(--blue-2)"' : ""}>${b.range}</span>
        <div class="pb__dist">${b.short}</div>
        <span class="pb__time">${fmt.pace(b.run.pace)}<small>/km</small></span>
        <span class="pb__race">${esc(b.run.name)} · ${fmt.shortDate(b.run.date)}</span>
        <span class="pb__race">${fmt.km(b.run.km, 2)} km in ${fmt.duration(b.run.seconds)}</span>
      </div>`
    )
    .join("");
}

function renderTimeline(s) {
  const list = $("#timeline");
  if (!list) return;
  const longestKm = s.longest.km;
  const items = [...s.longRuns]
    .reverse()
    .map(
      (r) => `
      <li class="tl${r.km >= 42 ? " tl--ultra" : ""} reveal">
        <span class="tl__date">${fmt.date(r.date)}</span>
        <div>
          <div class="tl__name">${esc(r.name)}</div>
          <span class="tl__sub">${fmt.km(r.km, 2)} km · ${fmt.pace(r.pace)}/km · ${r.hr} bpm</span>
        </div>
        <div class="tl__result">
          <strong>${fmt.duration(r.seconds)}</strong>
          <span class="label">${r.km === longestKm ? "Longest" : tierOf(r.km)}</span>
        </div>
      </li>`
    )
    .join("");
  list.innerHTML = `<li class="timeline__progress" id="timelineProgress" aria-hidden="true"></li>${items}`;
}

function showDataError(err) {
  const notice = document.createElement("div");
  notice.className = "data-error";
  notice.innerHTML = `<strong>Couldn’t load data.json.</strong> ${esc(err.message)}. If you opened the file directly, serve the folder instead (for example <code>python3 -m http.server</code>).`;
  document.body.appendChild(notice);
}
