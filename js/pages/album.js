import { loadAlbums } from "../data-service.js";
import { findAlbum } from "../albums.js";
import { legsBar, morningTimeline, shotMarkup, stageCards } from "../album-view.js";
import { icon } from "../icons.js";
import { fmt } from "../stats.js";
import { $, $$, clockCounter, escapeHtml as esc } from "../ui.js";

export async function render() {
  const id = new URLSearchParams(window.location.search).get("id");
  const album = findAlbum(await loadAlbums(), id);
  if (!album) {
    $("#albumHero").innerHTML = `<div class="container empty-state">${icon("camera")}<h3>No album yet</h3><p>Add one to albums.json.</p></div>`;
    return;
  }
  document.title = `${album.title} — Sahadat Hossain`;
  renderHero(album);
  renderMetrics(album);
  renderStory(album);
  renderPhotos(album);
}

function renderHero(album) {
  const [first, ...rest] = album.title.split(" ");
  const cover = $("#albumCover");
  cover.src = album.cover.full;
  cover.alt = album.cover.alt;
  if (album.cover.focus) cover.style.objectPosition = album.cover.focus;

  $("#albumCrumb").textContent = album.title;
  $("#albumEyebrow").textContent = `${fmt.date(album.date)} · ${album.location}`;
  $("#albumTitle").innerHTML = `<span class="line"><span>${esc(first)}</span></span><span class="line"><span class="outline">${esc(rest.join(" "))}</span></span>`;
  $("#albumChips").innerHTML = [
    ["bike", album.sport],
    album.conditions && ["rain", album.conditions],
    album.presenter && ["flag", `Presented by ${album.presenter}`],
    ["camera", `${album.photos.length} photos`],
  ]
    .filter(Boolean)
    .map(([name, text]) => `<span class="album-chip">${icon(name)}${esc(text)}</span>`)
    .join("");
  $("#albumStatus").innerHTML = `${icon("medal")}${esc(album.result.status)}`;
  clockCounter($("#albumClock"), album.finishSeconds);
  $("#albumLegs").innerHTML = legsBar(album);
}

function renderMetrics(album) {
  const legKm = (key) => album.legs.find((l) => l.key === key)?.km ?? 0;
  const runKm = album.legs.filter((l) => l.sport === "run").reduce((s, l) => s + l.km, 0);
  const tiles = [
    { icon: "time", label: "Finish time", value: album.result.finishTime, sub: album.result.status, color: "#ffc94d" },
    { icon: "distance", label: "Total distance", value: album.totalKm, unit: "km", sub: album.legs.map((l) => l.km).join(" + ") + " km", color: "#7aa0ff" },
    { icon: "speed", label: "Average speed", value: album.avgSpeed?.toFixed(1) ?? "—", unit: "km/h", sub: "Across all legs, transitions included", color: "#c6f432" },
    { icon: "bike", label: "Bike / run split", value: `${legKm("bike")}/${runKm}`, unit: "km", sub: `${Math.round((legKm("bike") / album.totalKm) * 100)}% of the course on the bike`, color: "#ff4d2e" },
  ];
  $("#albumMetrics").innerHTML = tiles
    .map(
      (t, i) => `
    <article class="metric reveal" data-delay="${i}" style="--accent:${t.color}">
      <span class="metric__icon">${icon(t.icon)}</span>
      <span class="label">${t.label}</span>
      <span class="metric__value">${t.value}${t.unit ? `<small>${t.unit}</small>` : ""}</span>
      <span class="metric__sub">${esc(t.sub)}</span>
    </article>`
    )
    .join("");
  $("#albumSummary").textContent = album.summary;
}

function renderStory(album) {
  $("#stageCards").innerHTML = stageCards(album);
  $("#morning").innerHTML = morningTimeline(album);
  const timed = album.morning?.photos.length ?? 0;
  const untimed = album.photos.length - timed;
  $("#morningNote").textContent = untimed
    ? `${timed} photos are placed by the time the camera took them. ${untimed} more come from a second camera whose clock was off, so they appear in the album but not on this line.`
    : `${timed} photos, placed by the time the camera took them.`;
}

function renderPhotos(album) {
  $("#filters").innerHTML = [
    `<button class="filter is-active" data-filter="all" role="tab">All<sup>${album.photos.length}</sup></button>`,
    ...album.stages
      .filter((s) => s.count)
      .map((s) => `<button class="filter" data-filter="${s.key}" role="tab">${esc(s.label)}<sup>${s.count}</sup></button>`),
  ].join("");
  $("#masonry").innerHTML = album.photos.map((p, i) => shotMarkup(p, album, i % 3)).join("");

  const showStage = (key) => {
    $(`.filter[data-filter="${key}"]`)?.click();
    $("#photos").scrollIntoView({ behavior: "smooth", block: "start" });
  };
  $$(".stage-card").forEach((card) => card.addEventListener("click", () => showStage(card.dataset.stage)));

  $$(".morning__dot").forEach((dot) =>
    dot.addEventListener("click", () => {
      const shot = $(`.shot[data-index="${dot.dataset.index}"]`);
      if (shot?.classList.contains("is-hidden")) $('.filter[data-filter="all"]').click();
      shot?.click();
    })
  );
}
