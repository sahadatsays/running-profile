import { albumUrl, clockLabel } from "./albums.js";
import { icon } from "./icons.js";
import { fmt } from "./stats.js";
import { escapeHtml as esc } from "./ui.js";

const LEG_ICON = { run: "runner", bike: "bike" };

/* Run → bike → run strip, each leg sized by its distance */
export function legsBar(album, { compact = false } = {}) {
  return `
  <div class="legs${compact ? " legs--compact" : ""}" role="img"
       aria-label="${album.legs.map((l) => `${l.label} ${l.km} km`).join(", ")}">
    ${album.legs
      .map(
        (leg, i) => `
      <div class="legs__leg" style="--grow:${leg.km};--c:${leg.color};--i:${i}">
        <div class="legs__head">${icon(LEG_ICON[leg.sport] ?? "route")}<span>${esc(leg.label)}</span><b>${leg.km}<small>km</small></b></div>
        <div class="legs__bar"><i></i></div>
      </div>`
      )
      .join('<span class="legs__t" aria-hidden="true"></span>')}
  </div>`;
}

/* Gallery tile; data-* attributes feed the shared lightbox */
export function shotMarkup(photo, album, delay = 0) {
  const meta = [photo.stageLabel, photo.time ? `${photo.time} on camera` : null, fmt.date(album.date)].filter(Boolean).join(" · ");
  return `
  <button class="shot shot--album${photo.portrait ? " shot--tall" : ""} reveal" data-delay="${delay}" data-cat="${photo.stage}" data-index="${photo.index}"
          data-full="${photo.full}" data-title="${esc(photo.caption)}" data-meta="${esc(meta)}">
    <img src="${photo.thumb}" width="${photo.w}" height="${photo.h}" loading="lazy" alt="${esc(photo.alt)}"
         ${photo.focus ? `style="object-position:${photo.focus}"` : ""} />
    <span class="shot__stage" style="--c:${photo.color}">${esc(photo.stageLabel)}</span>
    <span class="shot__zoom">${icon("search")}</span>
    <span class="shot__info"><span class="label">${esc(photo.stageLabel)}${photo.time ? ` · ${photo.time}` : ""}</span><strong>${esc(photo.caption)}</strong></span>
  </button>`;
}

export function albumCard(album) {
  return `
  <a class="album-card reveal" href="${albumUrl(album)}">
    <div class="album-card__media">
      ${[album.cover, ...album.highlights.filter((p) => p !== album.cover)]
        .slice(0, 3)
        .map((p, i) => `<img src="${p.thumb}" loading="lazy" width="${p.w}" height="${p.h}" alt="${esc(p.alt)}" style="--i:${i}${p.focus ? `;object-position:${p.focus}` : ""}" />`)
        .join("")}
      <span class="album-card__count">${icon("camera")}${album.photos.length} photos</span>
    </div>
    <div class="album-card__body">
      <span class="label">${icon("calendar")}${fmt.date(album.date)} · ${esc(album.sport)}</span>
      <h3 class="album-card__title">${esc(album.title)}</h3>
      <div class="album-card__result">
        <span>${icon("time")}<b>${esc(album.result.finishTime)}</b><small>Finish</small></span>
        <span>${icon("distance")}<b>${album.totalKm} km</b><small>Total</small></span>
        <span>${icon("medal")}<b>${esc(album.result.status)}</b><small>Result</small></span>
      </div>
      ${legsBar(album, { compact: true })}
      <span class="run-card__go">Open album ${icon("arrowRight")}</span>
    </div>
  </a>`;
}

export function stageCards(album) {
  return album.stages
    .filter((s) => s.count)
    .map(
      (s, i) => `
    <button class="stage-card reveal" data-delay="${i % 4}" data-stage="${s.key}" style="--c:${s.color}">
      <img src="${s.cover.thumb}" loading="lazy" width="${s.cover.w}" height="${s.cover.h}" alt="" />
      <span class="stage-card__step">${String(i + 1).padStart(2, "0")}</span>
      <span class="stage-card__body">
        <span class="stage-card__icon">${icon(s.icon)}</span>
        <strong>${esc(s.label)}</strong>
        <small>${[s.km ? `${s.km} km` : null, `${s.count} photo${s.count > 1 ? "s" : ""}`, s.from ? (s.from === s.to ? s.from : `${s.from}–${s.to}`) : null]
          .filter(Boolean)
          .join(" · ")}</small>
      </span>
    </button>`
    )
    .join("");
}

/* Photos placed on a clock axis by camera time; equal times stack upwards */
export function morningTimeline(album) {
  const { morning } = album;
  if (!morning) return "";
  const from = Math.floor(morning.start / 15) * 15 - 15;
  const to = Math.ceil(morning.end / 15) * 15 + 15;
  const x = (m) => ((m - from) / (to - from)) * 100;
  const ticks = [];
  for (let m = from; m <= to; m += 15) ticks.push(m);
  const stacks = new Map();

  const bands = album.stages
    .filter((s) => s.from)
    .map((s) => {
      const a = x(s.fromMinutes);
      const b = x(s.toMinutes);
      return `<span class="morning__band" style="--a:${a}%;--w:${Math.max(b - a, 0)}%;--c:${s.color}"><em>${esc(s.label)}</em></span>`;
    })
    .join("");

  const dots = morning.photos
    .map((p) => {
      const level = stacks.get(p.minutes) ?? 0;
      stacks.set(p.minutes, level + 1);
      return `<button class="morning__dot" data-index="${p.index}" style="--x:${x(p.minutes)}%;--y:${level};--c:${p.color};--d:${p.index * 40}ms"
                      aria-label="${esc(p.caption)} · ${p.time}"><img src="${p.thumb}" alt="" loading="lazy" /></button>`;
    })
    .join("");

  return `
  <div class="morning">
    <div class="morning__plot">
      ${bands}
      ${dots}
      <div class="morning__axis"><i></i></div>
    </div>
    <div class="morning__ticks">
      ${ticks.map((m) => `<span style="--x:${x(m)}%">${clockLabel(m)}</span>`).join("")}
    </div>
  </div>`;
}
