import { icon } from "./icons.js";
import { fmt, hrBandOf, tierOf } from "./stats.js";
import { escapeHtml as esc } from "./ui.js";

export const runUrl = (run) => `run.html?id=${encodeURIComponent(run.id)}`;

const HR_MIN = 90;
const HR_MAX = 190;

function hrRing(hr, color) {
  const C = 2 * Math.PI * 26;
  const ratio = hr ? Math.min(Math.max((hr - HR_MIN) / (HR_MAX - HR_MIN), 0.04), 1) : 0;
  return `
    <svg class="hr-ring" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="26" class="hr-ring__track"/>
      <circle cx="32" cy="32" r="26" class="hr-ring__value" stroke="${color}"
              style="stroke-dasharray:${C};--off:${C * (1 - ratio)};stroke-dashoffset:${C}"/>
    </svg>`;
}

export function runCard(run, { longestKm, delay = 0 } = {}) {
  const band = hrBandOf(run.hr);
  const progress = Math.max(Math.min(run.km / longestKm, 1), 0.02) * 100;
  return `
  <a class="run-card reveal" href="${runUrl(run)}" style="--accent:${band.color};transition-delay:${delay}ms">
    <div class="run-card__top">
      <div class="run-card__date">
        <strong>${run.date.getDate()}</strong>
        <span>${fmt.month(run.date)}<small>${fmt.weekday(run.date)}</small></span>
      </div>
      <span class="run-card__type">${icon(run.indoor ? "treadmill" : "outdoor")}${run.indoor ? "Indoor" : "Outdoor"}</span>
    </div>

    <h3 class="run-card__name">${esc(run.name)}</h3>

    <div class="run-card__hero">
      <div class="run-card__km">
        <span>${fmt.km(run.km, 2)}</span><small>km</small>
        <em class="tier-badge">${tierOf(run.km)}</em>
      </div>
      <div class="run-card__hr" title="Average heart rate · ${band.name}">
        ${hrRing(run.hr, band.color)}
        <span>${icon("heart")}<b>${run.hr || "—"}</b></span>
      </div>
    </div>

    <div class="run-card__track" title="${fmt.km(run.km)} km of your ${fmt.km(longestKm, 0)} km longest run">
      <span class="run-card__fill" style="--w:${progress}%"></span>
      <span class="run-card__runner" style="--w:${progress}%">${icon("runner")}</span>
    </div>

    <ul class="run-card__metrics">
      <li>${icon("time")}<span><b>${fmt.duration(run.seconds)}</b><small>Time</small></span></li>
      <li>${icon("pace")}<span><b>${fmt.pace(run.pace)}</b><small>/km</small></span></li>
      <li>${icon("flame")}<span><b>${run.calories.toLocaleString("en")}</b><small>kcal</small></span></li>
    </ul>

    <span class="run-card__go">View analysis ${icon("arrowRight")}</span>
  </a>`;
}

export function runRow(run) {
  const band = hrBandOf(run.hr);
  return `
  <a class="run-row" href="${runUrl(run)}" style="--accent:${band.color}">
    <span class="run-row__date"><b>${fmt.shortDate(run.date)}</b><small>${fmt.weekday(run.date)} · ${run.date.getFullYear()}</small></span>
    <span class="run-row__name">${icon(run.indoor ? "treadmill" : "outdoor")}<span>${esc(run.name)}<small>${tierOf(run.km)}</small></span></span>
    <span class="run-row__cell" data-label="Distance">${fmt.km(run.km, 2)} <small>km</small></span>
    <span class="run-row__cell" data-label="Time">${fmt.duration(run.seconds)}</span>
    <span class="run-row__cell" data-label="Pace">${fmt.pace(run.pace)} <small>/km</small></span>
    <span class="run-row__cell run-row__hr" data-label="HR"><i></i>${run.hr || "—"} <small>bpm</small></span>
    <span class="run-row__cell" data-label="Calories">${run.calories.toLocaleString("en")}</span>
    <span class="run-row__go">${icon("chevronRight")}</span>
  </a>`;
}
