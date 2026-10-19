import { $$, onVisible, reduceMotion, tooltip } from "./ui.js";

const NS = "http://www.w3.org/2000/svg";

const el = (tag, attrs = {}, parent) => {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (parent) parent.appendChild(node);
  return node;
};

const viewBox = (svg) => svg.getAttribute("viewBox").split(" ").map(Number).slice(2);

const gradient = (defs, id, stops, vertical = true) => {
  const g = el("linearGradient", { id, x1: 0, y1: 0, x2: vertical ? 0 : 1, y2: 1 }, defs);
  stops.forEach(([offset, color, opacity = 1]) => el("stop", { offset, "stop-color": color, "stop-opacity": opacity }, g));
};

const niceMax = (v, step) => Math.max(step, Math.ceil(v / step) * step);

const svgPoint = (svg, evt) => new DOMPoint(evt.clientX, evt.clientY).matrixTransform(svg.getScreenCTM().inverse());

const smoothPath = (pts) => {
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    d += ` C${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]},${p2[1]}`;
  }
  return d;
};

/* Vertical bars */
export function barChart(svg, { values, labels, highlight = () => false, topLabel, tip, step = 20, onClick }) {
  if (!svg || !values.length) return;
  svg.replaceChildren();
  const [W, H] = viewBox(svg);
  const pad = { t: 28, r: 4, b: 30, l: 36 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const max = niceMax(Math.max(...values), step);
  const y = (v) => pad.t + ih - (v / max) * ih;

  const defs = el("defs", {}, svg);
  gradient(defs, `${svg.id}-blue`, [[0, "#7aa0ff"], [1, "#2443c9"]]);
  gradient(defs, `${svg.id}-fire`, [[0, "#ff8a3d"], [1, "#d92c12"]]);

  const grid = el("g", { class: "grid" }, svg);
  for (let i = 0; i <= 4; i++) {
    const v = (max / 4) * i;
    el("line", { x1: pad.l, x2: W - pad.r, y1: y(v), y2: y(v) }, grid);
    el("text", { x: 0, y: y(v) + 4 }, svg).textContent = Math.round(v);
  }

  const slot = iw / values.length;
  const bw = Math.min(slot * 0.58, 40);

  values.forEach((v, i) => {
    const x = pad.l + slot * i + (slot - bw) / 2;
    const top = y(v);
    const hot = highlight(v, i);
    const bar = el("rect", {
      x, y: top, width: bw, height: Math.max(pad.t + ih - top, 0), rx: 6,
      class: "bar", fill: `url(#${svg.id}-${hot ? "fire" : "blue"})`,
    }, svg);
    bar.style.transitionDelay = `${i * 70}ms`;

    const label = topLabel?.(v, i);
    if (label) {
      const t = el("text", { x: x + bw / 2, y: top - 10, "text-anchor": "middle", class: "value" }, svg);
      t.textContent = label;
    }
    el("text", { x: x + bw / 2, y: H - 8, "text-anchor": "middle" }, svg).textContent = labels[i];

    const hit = el("rect", { x: pad.l + slot * i, y: pad.t, width: slot, height: ih, fill: "transparent" }, svg);
    hit.addEventListener("mousemove", (e) => {
      bar.style.filter = "brightness(1.3)";
      tooltip.show(e, tip(v, i));
    });
    hit.addEventListener("mouseleave", () => {
      bar.style.filter = "";
      tooltip.hide();
    });
    if (onClick) {
      hit.style.cursor = "pointer";
      hit.addEventListener("click", () => onClick(i));
    }
  });
}

/* Smooth line with gradient area */
export function lineChart(svg, { values, labels, color, invert = false, tip, dots = true }) {
  if (!svg || values.length < 2) return;
  svg.replaceChildren();
  const [W, H] = viewBox(svg);
  const pad = { t: 16, r: 10, b: 28, l: 10 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const lo = Math.min(...values);
  const span = Math.max(...values) - lo || 1;
  const x = (i) => pad.l + (iw / (values.length - 1)) * i;
  const y = (v) => {
    const n = (v - lo) / span;
    return pad.t + ih * 0.07 + ih * 0.86 * (invert ? n : 1 - n);
  };
  const pts = values.map((v, i) => [x(i), y(v)]);

  const defs = el("defs", {}, svg);
  gradient(defs, `${svg.id}-area`, [[0, color, 0.35], [1, color, 0]]);

  const grid = el("g", { class: "grid" }, svg);
  for (let i = 0; i <= 3; i++) {
    const gy = pad.t + (ih / 3) * i;
    el("line", { x1: pad.l, x2: W - pad.r, y1: gy, y2: gy }, grid);
  }

  const line = smoothPath(pts);
  el("path", { d: `${line} L${x(values.length - 1)},${pad.t + ih} L${x(0)},${pad.t + ih} Z`, fill: `url(#${svg.id}-area)`, class: "area-path" }, svg);
  const path = el("path", { d: line, stroke: color, class: "line-path" }, svg);

  labels.forEach((l, i) => {
    const anchor = i === 0 ? "start" : i === labels.length - 1 ? "end" : "middle";
    el("text", { x: x(i), y: H - 6, "text-anchor": anchor }, svg).textContent = l;
  });

  if (dots) {
    pts.forEach(([px, py], i) => {
      const d = el("circle", { cx: px, cy: py, r: 4, class: "dot", stroke: color }, svg);
      d.style.transitionDelay = `${0.8 + i * 0.1}s`;
    });
  }

  const guide = el("line", { y1: pad.t, y2: pad.t + ih, stroke: "rgba(255,255,255,.25)", "stroke-dasharray": "3 4", opacity: 0 }, svg);
  const focus = el("circle", { r: 6, fill: color, stroke: "#07090c", "stroke-width": 3, opacity: 0 }, svg);

  svg.addEventListener("mousemove", (e) => {
    const p = svgPoint(svg, e);
    const i = Math.max(0, Math.min(values.length - 1, Math.round((p.x - pad.l) / (iw / (values.length - 1)))));
    guide.setAttribute("x1", pts[i][0]);
    guide.setAttribute("x2", pts[i][0]);
    guide.setAttribute("opacity", 1);
    focus.setAttribute("cx", pts[i][0]);
    focus.setAttribute("cy", pts[i][1]);
    focus.setAttribute("opacity", 1);
    tooltip.show(e, tip(values[i], i));
  });
  svg.addEventListener("mouseleave", () => {
    guide.setAttribute("opacity", 0);
    focus.setAttribute("opacity", 0);
    tooltip.hide();
  });

  const len = path.getTotalLength();
  path.style.strokeDasharray = len;
  path.style.strokeDashoffset = reduceMotion ? 0 : len;
  onVisible(svg, () => (path.style.strokeDashoffset = 0));
}

/* Scatter: x = pace (faster on the right), y = heart rate */
export function scatterChart(svg, { points, maxPace, highlight, tip, onClick }) {
  if (!svg || !points.length) return;
  svg.replaceChildren();
  const [W, H] = viewBox(svg);
  const pad = { t: 14, r: 14, b: 30, l: 36 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const paces = points.map((p) => p.pace);
  const hrs = points.map((p) => p.hr);
  const xMin = Math.floor(Math.min(...paces) / 60) * 60;
  const xMax = Math.max(Math.ceil(Math.max(...paces) / 60) * 60, Math.min(maxPace, xMin + 120));
  const yMin = Math.floor(Math.min(...hrs) / 10) * 10;
  const yMax = Math.ceil(Math.max(...hrs) / 10) * 10;
  const x = (pace) => pad.l + iw - ((pace - xMin) / (xMax - xMin)) * iw;
  const y = (hr) => pad.t + ih - ((hr - yMin) / (yMax - yMin || 1)) * ih;

  const grid = el("g", { class: "grid" }, svg);
  for (let hr = yMin; hr <= yMax; hr += 10) {
    el("line", { x1: pad.l, x2: W - pad.r, y1: y(hr), y2: y(hr) }, grid);
    el("text", { x: 0, y: y(hr) + 4 }, svg).textContent = hr;
  }
  for (let pace = xMin; pace <= xMax; pace += 60) {
    el("line", { x1: x(pace), x2: x(pace), y1: pad.t, y2: pad.t + ih }, grid);
    el("text", { x: x(pace), y: H - 8, "text-anchor": "middle" }, svg).textContent = `${pace / 60}:00`;
  }

  [...points].sort((a, b) => b.km - a.km).forEach((p, i) => {
    const hot = highlight(p);
    const c = el("circle", {
      cx: x(p.pace), cy: y(p.hr), r: 3 + Math.sqrt(p.km) * 1.4,
      class: "scatter-dot", fill: hot ? "#ff4d2e" : "#3d6bff", "fill-opacity": hot ? 0.9 : 0.55,
      stroke: hot ? "#ff8a3d" : "#7aa0ff", "stroke-width": 1.5,
    }, svg);
    c.style.transitionDelay = `${i * 12}ms`;
    c.addEventListener("mousemove", (e) => tooltip.show(e, tip(p)));
    c.addEventListener("mouseleave", tooltip.hide);
    if (onClick) c.addEventListener("click", () => onClick(p));
  });
}

/* Progress ring */
export function ringChart(circle, ratio) {
  if (!circle) return;
  const C = 2 * Math.PI * Number(circle.getAttribute("r"));
  circle.style.strokeDasharray = C;
  circle.style.strokeDashoffset = C;
  onVisible(circle.closest("svg"), () => (circle.style.strokeDashoffset = C * (1 - Math.min(ratio, 1))));
}

/* Donut */
export function donutChart(svg, legend, segments, tip) {
  if (!svg) return;
  svg.replaceChildren();
  const r = 60;
  const C = 2 * Math.PI * r;
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  el("circle", { cx: 80, cy: 80, r, stroke: "rgba(255,255,255,.05)" }, svg);

  let offset = 0;
  const arcs = segments.map((s) => {
    const len = (s.value / total) * C;
    const c = el("circle", { cx: 80, cy: 80, r, stroke: s.color, "stroke-dasharray": `0 ${C}`, "stroke-dashoffset": -offset }, svg);
    c.addEventListener("mousemove", (e) => tooltip.show(e, tip(s)));
    c.addEventListener("mouseleave", tooltip.hide);
    offset += len;
    return { c, len };
  });

  onVisible(svg, () =>
    arcs.forEach(({ c, len }, i) =>
      setTimeout(() => c.setAttribute("stroke-dasharray", `${len > 4 ? len - 3 : len} ${C}`), i * 180)
    )
  );

  legend.innerHTML = segments.map((s) => `<li><i style="background:${s.color}"></i>${s.name}<b>${s.value}%</b></li>`).join("");
}

/* Horizontal bar list */
export function barList(container, rows) {
  if (!container) return;
  const max = Math.max(...rows.map((r) => r.value), 1);
  container.innerHTML = rows
    .map(
      (r) => `
      <div class="zone__row"${r.title ? ` title="${r.title}"` : ""}>
        <span class="mono">${r.label}</span>
        <div class="zone__bar"><span style="background:${r.color}" data-w="${(r.value / max) * 100}"></span></div>
        <span class="mono">${r.display}</span>
      </div>`
    )
    .join("");
  onVisible(container, () =>
    $$(".zone__bar span", container).forEach((s, i) => {
      s.style.transitionDelay = `${i * 120}ms`;
      s.style.width = `${s.dataset.w}%`;
    })
  );
}

/* Calendar heatmap: one column per week, Monday at the top */
export function heatmap(container, monthsRow, { weeks, cells, months }, tip) {
  if (!container) return;
  const columns = `repeat(${weeks}, minmax(0, 40px))`;
  container.style.gridTemplateColumns = columns;
  monthsRow.style.gridTemplateColumns = columns;

  const frag = document.createDocumentFragment();
  cells.forEach((cell) => {
    const span = document.createElement("span");
    span.dataset.l = cell.outside ? "x" : cell.level;
    span.style.transitionDelay = `${cell.week * 30}ms`;
    if (!cell.outside) {
      span.addEventListener("mousemove", (e) => tooltip.show(e, tip(cell)));
      span.addEventListener("mouseleave", tooltip.hide);
    }
    frag.appendChild(span);
  });
  container.replaceChildren(frag);

  monthsRow.innerHTML = months
    .map((m, i) => {
      const end = months[i + 1]?.column ?? weeks;
      return end - m.column >= 2 ? `<span style="grid-column:${m.column + 1} / ${end + 1}">${m.label}</span>` : "";
    })
    .join("");
}

export { el, gradient, niceMax, smoothPath, svgPoint, viewBox };
