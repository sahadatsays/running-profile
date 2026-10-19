import { loadActivityData, loadRoute } from "../data-service.js";
import { icon } from "../icons.js";
import * as charts from "../charts.js";
import { gaugeChart, trackLoop } from "../creative-charts.js";
import { sampleAt, splitsOf } from "../route.js";
import { runCard, runUrl } from "../run-card.js";
import { fmt, HR_BANDS, normalizeRuns, runAnalytics } from "../stats.js";
import { $, escapeHtml as esc, initCounters, onVisible, reduceMotion } from "../ui.js";

const REPLAY_MS = 14000;

export async function render() {
  const data = await loadActivityData();
  const runs = normalizeRuns(data);
  const id = new URLSearchParams(window.location.search).get("id");
  const run = id ? runs.find((r) => r.id === id) : runs[runs.length - 1];

  if (!run) {
    $("#runMain").innerHTML = `
      <section class="section"><div class="container empty-state">
        ${icon("route")}
        <h3>Run not found</h3>
        <p>There’s no run with id “${esc(id)}” in data.json.</p>
        <a class="btn btn--primary" href="runs.html">Back to run history ${icon("arrowRight")}</a>
      </div></section>`;
    return;
  }

  const a = runAnalytics(run, runs);
  document.title = `${run.name} · ${fmt.date(run.date)} — Sahadat Hossain`;
  const longestKm = Math.max(...runs.map((r) => r.km));

  renderHeader(run, a);
  renderMetrics(run, a);
  renderAnalytics(run, a);
  renderPredictions(run, a);
  renderRelated(run, a, longestKm);
  initCounters();

  if (run.indoor) renderTrack(run);
  else await renderMap(run);
}

/* ---------- Header ---------- */
function renderHeader(run, a) {
  const set = (key, html) => {
    const node = $(`[data-run="${key}"]`);
    if (node) node.innerHTML = html;
  };
  set("date", `${fmt.weekday(run.date)} · ${fmt.date(run.date)}`);
  set("name", esc(run.name));
  set("tier", `${icon(run.indoor ? "treadmill" : "outdoor")} ${run.indoor ? "Indoor" : "Outdoor"} · ${a.tier}`);
  set("summary", `${fmt.km(run.km, 2)} km · ${fmt.duration(run.seconds)} · ${fmt.pace(run.pace)}/km · ${run.hr || "—"} bpm`);
  set("crumb", esc(run.name));

  const nav = $("#runPager");
  if (nav) {
    nav.innerHTML = [
      a.prev ? `<a class="pager-link" href="${runUrl(a.prev)}">${icon("arrowLeft")}<span><small>Previous run</small>${esc(a.prev.name)} · ${fmt.shortDate(a.prev.date)}</span></a>` : "<span></span>",
      a.next ? `<a class="pager-link pager-link--next" href="${runUrl(a.next)}"><span><small>Next run</small>${esc(a.next.name)} · ${fmt.shortDate(a.next.date)}</span>${icon("arrowRight")}</a>` : "<span></span>",
    ].join("");
  }
}

/* ---------- Metric tiles ---------- */
function renderMetrics(run, a) {
  const tiles = [
    { icon: "distance", label: "Distance", count: run.km, decimals: 2, unit: "km", sub: `#${a.ranks.distance} longest of ${a.ranks.total}` },
    { icon: "time", label: "Moving time", text: fmt.duration(run.seconds), sub: `#${a.ranks.duration} longest time` },
    { icon: "pace", label: "Average pace", text: fmt.pace(run.pace), unit: "/km", sub: `Faster than ${Math.round(a.percentiles.pace * 100)}% of runs` },
    { icon: "speed", label: "Average speed", count: a.speed, decimals: 1, unit: "km/h", sub: `${fmt.pace(3600 / a.speed)} per km` },
    { icon: "heart", label: "Average heart rate", count: run.hr, unit: "bpm", sub: `${a.band.name} · ${a.band.label} bpm`, accent: a.band.color },
    { icon: "flame", label: "Calories", count: run.calories, unit: "kcal", sub: `#${a.ranks.calories} of ${a.ranks.total}` },
    { icon: "zap", label: "Burn rate", count: a.kcalPerHour, unit: "kcal/h", sub: `${Math.round(a.kcalPerKm)} kcal per km` },
    { icon: "load", label: "Relative load", count: a.load, unit: "pts", sub: `Higher than ${Math.round(a.percentiles.load * 100)}% of runs` },
  ];
  $("#metricGrid").innerHTML = tiles
    .map(
      (t, i) => `
      <article class="metric reveal" data-delay="${i % 4}" ${t.accent ? `style="--accent:${t.accent}"` : ""}>
        <span class="metric__icon">${icon(t.icon)}</span>
        <span class="label">${t.label}</span>
        <div class="metric__value">
          ${t.text ? `<span>${t.text}</span>` : `<span data-count="${t.count}" data-decimals="${t.decimals || 0}">0</span>`}
          ${t.unit ? `<small>${t.unit}</small>` : ""}
        </div>
        <span class="metric__sub">${t.sub}</span>
      </article>`
    )
    .join("");
}

/* ---------- Analytics ---------- */
function renderAnalytics(run, a) {
  gaugeChart($("#hrGauge"), { value: run.hr, min: 90, max: 190, bands: HR_BANDS });
  $("#gaugeValue").innerHTML = `${run.hr || "—"}<small>bpm</small>`;
  $("#gaugeBand").innerHTML = `<i style="background:${a.band.color}"></i>${a.band.name} effort`;
  $("#gaugeNote").textContent = `Higher than ${Math.round(a.percentiles.hr * 100)}% of your runs. Your average is ${Math.round(a.avg.hr)} bpm.`;

  const rows = [
    { label: "Distance", icon: "distance", rank: a.ranks.distance, pct: a.percentiles.distance },
    { label: "Duration", icon: "time", rank: a.ranks.duration, pct: 1 - (a.ranks.duration - 1) / Math.max(a.ranks.total - 1, 1) },
    { label: "Pace", icon: "pace", rank: null, pct: a.percentiles.pace },
    { label: "Calories", icon: "flame", rank: a.ranks.calories, pct: 1 - (a.ranks.calories - 1) / Math.max(a.ranks.total - 1, 1) },
    { label: "Load", icon: "load", rank: a.ranks.load, pct: a.percentiles.load },
  ];
  $("#rankList").innerHTML = rows
    .map(
      (r) => `
      <li>
        <span class="rank__icon">${icon(r.icon)}</span>
        <span class="rank__label">${r.label}<small>${r.rank ? `#${r.rank} of ${a.ranks.total}` : `faster than ${Math.round(r.pct * 100)}%`}</small></span>
        <span class="rank__bar"><i style="--w:${Math.max(r.pct * 100, 2)}%"></i></span>
        <b>${Math.round(r.pct * 100)}<small>th</small></b>
      </li>`
    )
    .join("");
  onVisible($("#rankList"), (n) => n.classList.add("is-on"));

  const maxDiff = Math.max(...a.compare.map((c) => Math.abs(c.diff)), 0.2);
  $("#compareList").innerHTML = a.compare
    .map((c) => {
      const w = (Math.abs(c.diff) / maxDiff) * 50;
      const pos = c.diff >= 0;
      return `
      <li class="${pos ? "is-up" : "is-down"}">
        <span class="cmp__label">${icon(c.icon)}${c.label}<small>${c.value} · ${c.base}</small></span>
        <span class="cmp__track"><i style="--w:${w}%"></i></span>
        <b>${pos ? "+" : "−"}${Math.abs(Math.round(c.diff * 100))}%</b>
      </li>`;
    })
    .join("");
  onVisible($("#compareList"), (n) => n.classList.add("is-on"));

  const bins = a.paceHistogram.bins;
  const hit = bins.findIndex((b) => run.pace >= b.from && run.pace < b.to);
  charts.barChart($("#paceHist"), {
    values: bins.map((b) => b.count),
    labels: bins.map((b, i) => (i % 2 === 0 ? fmt.pace(b.from) : "")),
    highlight: (_, i) => i === hit,
    topLabel: (_, i) => (i === hit ? "THIS RUN" : ""),
    tip: (v, i) => `${fmt.pace(bins[i].from)}–${fmt.pace(bins[i].to)}/km · ${v} runs`,
    step: 5,
  });
  $("#paceHistNote").textContent =
    hit >= 0 ? `${fmt.pace(run.pace)}/km sits with ${bins[hit].count} runs in the same 30-second band.` : "This run is slower than the running-pace range (walk or warm-up).";

  charts.barChart($("#weekChart"), {
    values: a.week.map((d) => d.km),
    labels: a.week.map((d) => d.label),
    highlight: (_, i) => a.week[i].isRunDay,
    topLabel: (v) => (v ? fmt.km(v, 0) : ""),
    tip: (v, i) => `${fmt.shortDate(a.week[i].date)} · ${v ? `${fmt.km(v)} km` : "Rest"}`,
    step: 10,
  });
  $("#weekTotal").textContent = fmt.km(a.weekTotal);
  $("#weekNote").textContent = `This run was ${Math.round((run.km / Math.max(a.weekTotal, 0.01)) * 100)}% of the week’s distance.`;

  const sameDay = $("#sameDay");
  if (sameDay) {
    sameDay.innerHTML = a.sameDay.length
      ? `${icon("calendar")} Also on this day: ${a.sameDay.map((r) => `<a href="${runUrl(r)}">${esc(r.name)} · ${fmt.km(r.km)} km</a>`).join(", ")}`
      : "";
    sameDay.hidden = !a.sameDay.length;
  }
}

function renderPredictions(run, a) {
  const section = $("#predictions");
  if (!a.predictions.length) {
    section.hidden = true;
    return;
  }
  $("#predictionGrid").innerHTML = a.predictions
    .map(
      (p, i) => `
      <article class="predict reveal" data-delay="${i}">
        <span class="predict__dist">${p.label}</span>
        <strong>${fmt.duration(p.seconds)}</strong>
        <span class="predict__pace">${icon("pace")} ${fmt.pace(p.seconds / p.km)}/km</span>
        <span class="predict__bar" style="--w:${Math.min((run.km / p.km) * 100, 100)}%"></span>
        <small>${run.km >= p.km ? "Covered in this run" : `${Math.round((run.km / p.km) * 100)}% of the distance covered`}</small>
      </article>`
    )
    .join("");
}

function renderRelated(run, a, longestKm) {
  $("#similarGrid").innerHTML = a.similar.map((r, i) => runCard(r, { longestKm, delay: i * 80 })).join("");
}

/* ---------- Map + replay ---------- */
async function renderMap(run) {
  const holder = $("#runMap");
  if (!window.L) {
    holder.innerHTML = `<div class="map-fallback">${icon("pin")}<p>The map library couldn’t load. Check your connection.</p></div>`;
    return;
  }
  const route = await loadRoute(run);
  const latlngs = route.points.map((p) => p.latlng);
  const totalKm = route.points[route.points.length - 1].km;

  $("#routeBadge").innerHTML = route.approximate
    ? `${icon("info")} Approximate route around ${esc(route.place)} · add a GPX file for the real track`
    : `${icon("route")} GPS track · ${esc(route.place)}`;
  $("#routeBadge").classList.toggle("is-approx", route.approximate);

  const map = L.map(holder, { zoomControl: false, scrollWheelZoom: false, attributionControl: true });
  const esri = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas";
  L.tileLayer(`${esri}/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`, {
    attribution: "Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors",
    maxNativeZoom: 16,
    maxZoom: 18,
  }).addTo(map);
  L.tileLayer(`${esri}/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}`, {
    maxNativeZoom: 16,
    maxZoom: 18,
    opacity: 0.8,
  }).addTo(map);
  L.control.zoom({ position: "topright" }).addTo(map);

  const ghost = L.polyline(latlngs, { color: "#7aa0ff", weight: 3, opacity: 0.25, dashArray: "4 8" }).addTo(map);
  const glow = L.polyline([], { color: "#3d6bff", weight: 14, opacity: 0.25, lineCap: "round" }).addTo(map);
  const core = L.polyline([], { color: "#ff4d2e", weight: 4.5, opacity: 1, lineCap: "round", lineJoin: "round" }).addTo(map);

  const pinIcon = (cls, html) => L.divIcon({ className: "", html: `<span class="map-pin ${cls}">${html}</span>`, iconSize: [34, 34], iconAnchor: [17, 17] });
  L.marker(latlngs[0], { icon: pinIcon("map-pin--start", icon("flag")), keyboard: false }).addTo(map).bindTooltip("Start");
  const finish = L.marker(latlngs[latlngs.length - 1], { icon: pinIcon("map-pin--finish", icon("trophy")), keyboard: false, opacity: 0 }).addTo(map);

  const every = totalKm <= 12 ? 1 : totalKm <= 30 ? 5 : 10;
  const kmMarkers = [];
  for (let k = every; k < totalKm - every * 0.3; k += every) {
    const s = sampleAt(route, k / totalKm);
    const m = L.marker(s.latlng, {
      icon: L.divIcon({ className: "", html: `<span class="km-marker">${k}</span>`, iconSize: [26, 26], iconAnchor: [13, 13] }),
      keyboard: false,
      opacity: 0,
    }).addTo(map);
    kmMarkers.push({ k, m });
  }

  const runner = L.marker(latlngs[0], {
    icon: L.divIcon({ className: "", html: `<span class="map-runner"><i></i>${icon("runner")}</span>`, iconSize: [44, 44], iconAnchor: [22, 22] }),
    keyboard: false,
    zIndexOffset: 1000,
  }).addTo(map);

  const fit = () => {
    const wide = window.innerWidth > 900;
    map.fitBounds(ghost.getBounds(), wide
      ? { paddingTopLeft: [40, 110], paddingBottomRight: [400, 60] }
      : { paddingTopLeft: [30, 190], paddingBottomRight: [30, 40] });
  };
  fit();
  window.addEventListener("resize", fit);

  const hasTimes = !route.approximate && route.points.some((p, i) => i && p.t !== route.points[i - 1].t);
  const live = {
    time: $("#liveTime"),
    dist: $("#liveDist"),
    pace: $("#livePace"),
    hr: $("#liveHr"),
    bar: $("#liveScrub"),
    pct: $("#livePct"),
  };

  let progress = 0;
  let playing = false;
  let speed = 1;
  let last = 0;
  let raf = 0;

  const paint = () => {
    const s = sampleAt(route, progress);
    const drawn = latlngs.slice(0, s.index + 1).concat([s.latlng]);
    glow.setLatLngs(drawn);
    core.setLatLngs(drawn);
    runner.setLatLng(s.latlng);
    kmMarkers.forEach(({ k, m }) => m.setOpacity(s.km >= k ? 1 : 0));
    finish.setOpacity(progress >= 1 ? 1 : 0);

    const kmDone = (s.km / totalKm) * run.km;
    live.time.textContent = fmt.duration(s.t);
    live.dist.textContent = fmt.km(kmDone, 2);
    let pace = run.pace;
    if (hasTimes && s.km > 0.3) {
      const back = sampleAt(route, Math.max(0, (s.km - 0.5) / totalKm));
      pace = (s.t - back.t) / Math.max(s.km - back.km, 0.01);
    }
    live.pace.textContent = fmt.pace(pace);
    live.hr.textContent = s.hr ? Math.round(s.hr) : run.hr || "—";
    live.bar.value = Math.round(progress * 1000);
    live.bar.style.setProperty("--p", `${progress * 100}%`);
    live.pct.textContent = `${Math.round(progress * 100)}%`;
  };

  const setPlaying = (on) => {
    playing = on;
    $("#livePlay").innerHTML = on ? icon("pause") : icon(progress >= 1 ? "replay" : "play");
    $("#livePlay").setAttribute("aria-label", on ? "Pause replay" : "Play replay");
    $("#runMapWrap").classList.toggle("is-playing", on);
    if (on) {
      last = performance.now();
      raf = requestAnimationFrame(tick);
    } else cancelAnimationFrame(raf);
  };

  const tick = (now) => {
    progress = Math.min(1, progress + ((now - last) / REPLAY_MS) * speed);
    last = now;
    paint();
    if (progress >= 1) setPlaying(false);
    else if (playing) raf = requestAnimationFrame(tick);
  };

  $("#livePlay").addEventListener("click", () => {
    if (progress >= 1) progress = 0;
    setPlaying(!playing);
  });
  live.bar.addEventListener("input", () => {
    setPlaying(false);
    progress = Number(live.bar.value) / 1000;
    paint();
  });
  document.querySelectorAll("[data-speed]").forEach((b) =>
    b.addEventListener("click", () => {
      speed = Number(b.dataset.speed);
      document.querySelectorAll("[data-speed]").forEach((x) => x.classList.toggle("is-active", x === b));
    })
  );
  $("#liveFactor").textContent = `Replay ≈ ${Math.round(run.seconds / (REPLAY_MS / 1000)).toLocaleString("en")}× real time`;

  paint();
  if (reduceMotion) {
    progress = 1;
    paint();
  } else {
    onVisible(holder, () => setTimeout(() => setPlaying(true), 600), 0.4);
  }

  if (!route.approximate) renderTrackCharts(route);
}

function renderTrackCharts(route) {
  const section = $("#trackCharts");
  const pts = route.points;
  const step = Math.max(1, Math.floor(pts.length / 160));
  const sampled = pts.filter((_, i) => i % step === 0);
  const kmLabels = sampled.map((p, i) => (i % Math.ceil(sampled.length / 6) === 0 ? `${p.km.toFixed(0)}K` : ""));
  let shown = false;

  if (sampled.some((p) => p.ele !== null)) {
    charts.lineChart($("#eleChart"), {
      values: sampled.map((p) => p.ele ?? 0),
      labels: kmLabels,
      color: "#c6f432",
      dots: false,
      tip: (v, i) => `${sampled[i].km.toFixed(1)} km · ${Math.round(v)} m`,
    });
    $("#eleCard").hidden = false;
    shown = true;
  }
  if (sampled.some((p) => p.hr)) {
    charts.lineChart($("#hrLine"), {
      values: sampled.map((p) => p.hr || 0),
      labels: kmLabels,
      color: "#ff4d2e",
      dots: false,
      tip: (v, i) => `${sampled[i].km.toFixed(1)} km · ${Math.round(v)} bpm`,
    });
    $("#hrCard").hidden = false;
    shown = true;
  }
  const splits = splitsOf(route);
  if (splits.length > 1 && pts.some((p, i) => i && p.t !== pts[i - 1].t)) {
    const fastest = Math.min(...splits.map((s) => s.pace));
    charts.barChart($("#splitChart"), {
      values: splits.map((s) => 3600 / s.pace),
      labels: splits.map((s, i) => (splits.length > 20 && i % 5 ? "" : `${s.km}`)),
      highlight: (_, i) => splits[i].pace === fastest,
      tip: (_, i) => `Km ${splits[i].km} · ${fmt.pace(splits[i].pace)}/km`,
      step: 2,
    });
    $("#splitCard").hidden = false;
    shown = true;
  }
  section.hidden = !shown;
}

/* ---------- Indoor ---------- */
function renderTrack(run) {
  $("#runMapWrap").classList.add("is-indoor");
  $("#runMap").innerHTML = `<svg class="track-svg" id="trackSvg" viewBox="0 0 800 420" role="img" aria-label="Animated running track"></svg>`;
  trackLoop($("#trackSvg"), { laps: run.km / 0.4, seconds: run.seconds });
  $("#routeBadge").innerHTML = `${icon("treadmill")} Indoor run · no route to map`;
  $("#liveTime").textContent = fmt.duration(run.seconds);
  $("#liveDist").textContent = fmt.km(run.km, 2);
  $("#livePace").textContent = fmt.pace(run.pace);
  $("#liveHr").textContent = run.hr || "—";
  $("#liveControls").hidden = true;
}
