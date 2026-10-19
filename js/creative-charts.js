import { el, gradient, niceMax, svgPoint, viewBox } from "./charts.js";
import { onVisible, reduceMotion, tooltip } from "./ui.js";

const polar = (cx, cy, r, a) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
const pt = (p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`;
const kmColor = (km) => (km < 5 ? "#4b6bd6" : km < 10 ? "#3d6bff" : km < 20 ? "#7aa0ff" : km < 30 ? "#c6f432" : "#ff4d2e");

const animateOnVisible = (svg) => onVisible(svg, () => svg.classList.add("is-drawn"), 0.25);

/* Every day of the season as a spoke around a clock face */
export function radialDays(svg, days, { tip, onClick } = {}) {
  if (!svg || !days.length) return;
  svg.replaceChildren();
  const [W, H] = viewBox(svg);
  const cx = W / 2;
  const cy = H / 2;
  const inner = W * 0.21;
  const outer = W * 0.43;
  const max = Math.max(...days.map((d) => d.km), 1);
  const radius = (km) => inner + Math.sqrt(km / max) * (outer - inner);
  const step = (Math.PI * 2) / days.length;
  const width = Math.max(1.5, Math.min(9, ((Math.PI * 2 * inner) / days.length) * 0.75));

  const defs = el("defs", {}, svg);
  const sweepGrad = el("linearGradient", { id: `${svg.id}-sweep`, x1: 0, y1: 0, x2: 1, y2: 0 }, defs);
  el("stop", { offset: 0, "stop-color": "#3d6bff", "stop-opacity": 0 }, sweepGrad);
  el("stop", { offset: 1, "stop-color": "#3d6bff", "stop-opacity": 0.35 }, sweepGrad);

  const sweep = el("g", { class: "radial-sweep" }, svg);
  const a1 = -Math.PI / 2;
  const a0 = a1 - 0.7;
  el("path", {
    d: `M${cx},${cy} L${pt(polar(cx, cy, outer + 8, a0))} A${outer + 8},${outer + 8} 0 0 1 ${pt(polar(cx, cy, outer + 8, a1))} Z`,
    fill: `url(#${svg.id}-sweep)`,
  }, sweep);

  const grid = el("g", { class: "grid" }, svg);
  [5, 10, 20, 40].filter((k) => k < max).forEach((k) => {
    el("circle", { cx, cy, r: radius(k), fill: "none" }, grid);
    const [lx, ly] = polar(cx, cy, radius(k), -Math.PI / 2 + 0.02);
    el("text", { x: lx + 4, y: ly + 3, class: "radial-ring-label" }, svg).textContent = `${k}k`;
  });
  el("circle", { cx, cy, r: inner - 6, fill: "none", stroke: "rgba(255,255,255,.08)" }, svg);

  const spokes = el("g", {}, svg);
  days.forEach((d, i) => {
    const a = -Math.PI / 2 + i * step + step / 2;
    if (d.km > 0) {
      const [x1, y1] = polar(cx, cy, inner, a);
      const [x2, y2] = polar(cx, cy, radius(d.km), a);
      const line = el("line", { x1, y1, x2, y2, stroke: kmColor(d.km), "stroke-width": width, "stroke-linecap": "round", pathLength: 1, class: "spoke" }, spokes);
      line.style.transitionDelay = `${i * 9}ms`;
    } else {
      const [x, y] = polar(cx, cy, inner, a);
      el("circle", { cx: x, cy: y, r: 1.4, fill: "rgba(255,255,255,.18)" }, spokes);
    }
    const [hx1, hy1] = polar(cx, cy, inner - 8, a);
    const [hx2, hy2] = polar(cx, cy, outer + 4, a);
    const hit = el("line", { x1: hx1, y1: hy1, x2: hx2, y2: hy2, stroke: "transparent", "stroke-width": Math.max(width, 6) }, svg);
    hit.addEventListener("mousemove", (e) => tooltip.show(e, tip(d)));
    hit.addEventListener("mouseleave", tooltip.hide);
    if (onClick && d.km > 0) {
      hit.style.cursor = "pointer";
      hit.addEventListener("click", () => onClick(d));
    }
  });

  days.forEach((d, i) => {
    if (i !== 0 && d.date.getDate() !== 1) return;
    const a = -Math.PI / 2 + i * step;
    const [tx1, ty1] = polar(cx, cy, outer + 10, a);
    const [tx2, ty2] = polar(cx, cy, outer + 20, a);
    el("line", { x1: tx1, y1: ty1, x2: tx2, y2: ty2, stroke: "rgba(255,255,255,.35)" }, svg);
    const [lx, ly] = polar(cx, cy, outer + 34, a + 0.12);
    el("text", { x: lx, y: ly + 4, "text-anchor": "middle", class: "radial-month" }, svg).textContent = d.date
      .toLocaleString("en", { month: "short" })
      .toUpperCase();
  });

  animateOnVisible(svg);
}

/* Cumulative distance with milestone flags and the next goal */
export function cumulativeChart(svg, { days, milestones, next, tip }) {
  if (!svg || days.length < 2) return;
  svg.replaceChildren();
  const [W, H] = viewBox(svg);
  const pad = { t: 34, r: 18, b: 30, l: 46 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const total = days[days.length - 1].cumulative;
  const yMax = niceMax(Math.max(next || 0, total) * 1.06, 100);
  const x = (i) => pad.l + (i / (days.length - 1)) * iw;
  const y = (v) => pad.t + ih - (v / yMax) * ih;

  const defs = el("defs", {}, svg);
  gradient(defs, `${svg.id}-area`, [[0, "#3d6bff", 0.45], [1, "#3d6bff", 0]]);
  gradient(defs, `${svg.id}-line`, [[0, "#7aa0ff"], [0.7, "#3d6bff"], [1, "#ff4d2e"]], false);

  const grid = el("g", { class: "grid" }, svg);
  for (let i = 0; i <= 4; i++) {
    const v = (yMax / 4) * i;
    el("line", { x1: pad.l, x2: W - pad.r, y1: y(v), y2: y(v) }, grid);
    el("text", { x: 0, y: y(v) + 4 }, svg).textContent = Math.round(v).toLocaleString("en");
  }
  days.forEach((d, i) => {
    if (d.date.getDate() === 1 || i === 0) {
      el("text", { x: x(i), y: H - 8, "text-anchor": i === 0 ? "start" : "middle" }, svg).textContent = d.date.toLocaleString("en", { month: "short" });
    }
  });

  if (next) {
    el("line", { x1: pad.l, x2: W - pad.r, y1: y(next), y2: y(next), class: "goal-line" }, svg);
    const t = el("text", { x: W - pad.r, y: y(next) - 10, "text-anchor": "end", class: "goal-label" }, svg);
    t.textContent = `${next.toLocaleString("en")} km goal · ${(next - total).toFixed(1)} to go`;
  }

  const line = days.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.cumulative).toFixed(1)}`).join(" ");
  el("path", { d: `${line} L${x(days.length - 1)},${pad.t + ih} L${pad.l},${pad.t + ih} Z`, fill: `url(#${svg.id}-area)`, class: "area-path" }, svg);
  const path = el("path", { d: line, stroke: `url(#${svg.id}-line)`, class: "line-path", "stroke-width": 3 }, svg);

  milestones.forEach((m, k) => {
    const i = days.findIndex((d) => d.date.getTime() === m.date.getTime());
    const mx = x(i);
    const my = y(m.km);
    const g = el("g", { class: "milestone" }, svg);
    g.style.transitionDelay = `${0.6 + k * 0.25}s`;
    el("line", { x1: mx, x2: mx, y1: my, y2: pad.t + ih, stroke: "rgba(255,255,255,.22)", "stroke-dasharray": "2 4" }, g);
    el("circle", { cx: mx, cy: my, r: 5, fill: "#07090c", stroke: "#c6f432", "stroke-width": 2.5 }, g);
    el("rect", { x: mx - 30, y: my - 30, width: 60, height: 18, rx: 9, fill: "#c6f432" }, g);
    const t = el("text", { x: mx, y: my - 17, "text-anchor": "middle", class: "milestone-label" }, g);
    t.textContent = `${m.km.toLocaleString("en")} km`;
  });

  const endX = x(days.length - 1);
  const endY = y(total);
  el("circle", { cx: endX, cy: endY, r: 14, class: "pulse-ring" }, svg);
  el("circle", { cx: endX, cy: endY, r: 5, fill: "#ff4d2e", stroke: "#07090c", "stroke-width": 2 }, svg);

  const guide = el("line", { y1: pad.t, y2: pad.t + ih, stroke: "rgba(255,255,255,.25)", "stroke-dasharray": "3 4", opacity: 0 }, svg);
  const focus = el("circle", { r: 5, fill: "#7aa0ff", stroke: "#07090c", "stroke-width": 2, opacity: 0 }, svg);
  svg.addEventListener("mousemove", (e) => {
    const p = svgPoint(svg, e);
    const i = Math.max(0, Math.min(days.length - 1, Math.round(((p.x - pad.l) / iw) * (days.length - 1))));
    guide.setAttribute("x1", x(i));
    guide.setAttribute("x2", x(i));
    guide.setAttribute("opacity", 1);
    focus.setAttribute("cx", x(i));
    focus.setAttribute("cy", y(days[i].cumulative));
    focus.setAttribute("opacity", 1);
    tooltip.show(e, tip(days[i]));
  });
  svg.addEventListener("mouseleave", () => {
    guide.setAttribute("opacity", 0);
    focus.setAttribute("opacity", 0);
    tooltip.hide();
  });

  const len = path.getTotalLength();
  path.style.strokeDasharray = len;
  path.style.strokeDashoffset = reduceMotion ? 0 : len;
  onVisible(svg, () => {
    path.style.strokeDashoffset = 0;
    svg.classList.add("is-drawn");
  });
}

/* Weekday rose: wedge radius = distance on that weekday */
export function roseChart(svg, items, tip) {
  if (!svg || !items.length) return;
  svg.replaceChildren();
  const [W] = viewBox(svg);
  const c = W / 2;
  const inner = W * 0.08;
  const R = W * 0.36;
  const max = Math.max(...items.map((d) => d.km), 1);
  const slice = (Math.PI * 2) / items.length;
  const gap = 0.06;

  const grid = el("g", { class: "grid" }, svg);
  [0.33, 0.66, 1].forEach((f) => el("circle", { cx: c, cy: c, r: inner + f * (R - inner), fill: "none" }, grid));

  items.forEach((d, i) => {
    const a0 = -Math.PI / 2 + i * slice + gap;
    const a1 = a0 + slice - gap * 2;
    const r = inner + Math.sqrt(d.km / max) * (R - inner);
    const hot = d.km === max;
    const wedge = el("path", {
      d: `M${pt(polar(c, c, inner, a0))} L${pt(polar(c, c, r, a0))} A${r},${r} 0 0 1 ${pt(polar(c, c, r, a1))} L${pt(polar(c, c, inner, a1))} A${inner},${inner} 0 0 0 ${pt(polar(c, c, inner, a0))} Z`,
      fill: hot ? "#ff4d2e" : "#3d6bff",
      "fill-opacity": hot ? 0.92 : 0.35 + (d.km / max) * 0.55,
      class: "rose-wedge",
    }, svg);
    wedge.style.transformOrigin = `${c}px ${c}px`;
    wedge.style.transitionDelay = `${i * 90}ms`;
    wedge.addEventListener("mousemove", (e) => tooltip.show(e, tip(d)));
    wedge.addEventListener("mouseleave", tooltip.hide);

    const mid = (a0 + a1) / 2;
    const [lx, ly] = polar(c, c, R + 22, mid);
    el("text", { x: lx, y: ly + 4, "text-anchor": "middle", class: `rose-label${hot ? " is-hot" : ""}` }, svg).textContent = d.label.toUpperCase();
  });
  animateOnVisible(svg);
}

/* Six-axis runner profile */
export function radarChart(svg, axes) {
  if (!svg || axes.length < 3) return;
  svg.replaceChildren();
  const [W, H] = viewBox(svg);
  const cx = W / 2;
  const cy = H / 2 + 6;
  const R = Math.min(W, H) * 0.34;
  const angle = (i) => -Math.PI / 2 + (i / axes.length) * Math.PI * 2;

  const defs = el("defs", {}, svg);
  const rg = el("radialGradient", { id: `${svg.id}-fill` }, defs);
  el("stop", { offset: 0, "stop-color": "#ff4d2e", "stop-opacity": 0.55 }, rg);
  el("stop", { offset: 1, "stop-color": "#3d6bff", "stop-opacity": 0.35 }, rg);

  const grid = el("g", { class: "grid" }, svg);
  [0.25, 0.5, 0.75, 1].forEach((f) => {
    el("polygon", { points: axes.map((_, i) => pt(polar(cx, cy, R * f, angle(i)))).join(" "), fill: "none" }, grid);
  });
  axes.forEach((_, i) => {
    const [x2, y2] = polar(cx, cy, R, angle(i));
    el("line", { x1: cx, y1: cy, x2, y2 }, grid);
  });

  const shape = el("polygon", {
    points: axes.map((a, i) => pt(polar(cx, cy, (R * a.score) / 100, angle(i)))).join(" "),
    fill: `url(#${svg.id}-fill)`,
    stroke: "#7aa0ff",
    "stroke-width": 2,
    "stroke-linejoin": "round",
    class: "radar-shape",
  }, svg);
  shape.style.transformOrigin = `${cx}px ${cy}px`;

  axes.forEach((a, i) => {
    const [x, y] = polar(cx, cy, (R * a.score) / 100, angle(i));
    const dot = el("circle", { cx: x, cy: y, r: 5, fill: "#07090c", stroke: "#c6f432", "stroke-width": 2.5, class: "radar-dot" }, svg);
    dot.style.transitionDelay = `${0.6 + i * 0.08}s`;
    dot.addEventListener("mousemove", (e) => tooltip.show(e, `${a.label} · ${a.score}/100 <span>· ${a.value}</span>`));
    dot.addEventListener("mouseleave", tooltip.hide);

    const [lx, ly] = polar(cx, cy, R + 30, angle(i));
    const anchor = Math.abs(lx - cx) < 8 ? "middle" : lx > cx ? "start" : "end";
    el("text", { x: lx, y: ly, "text-anchor": anchor, class: "radar-label" }, svg).textContent = a.label.toUpperCase();
    el("text", { x: lx, y: ly + 16, "text-anchor": anchor, class: "radar-score" }, svg).textContent = a.score;
  });
  animateOnVisible(svg);
}

/* Half-circle gauge with coloured bands and an animated needle */
export function gaugeChart(svg, { value, min, max, bands }) {
  if (!svg) return;
  svg.replaceChildren();
  const [W, H] = viewBox(svg);
  const cx = W / 2;
  const cy = H - 18;
  const r = Math.min(W / 2 - 16, H - 34);
  const toAngle = (v) => Math.PI + ((Math.min(Math.max(v, min), max) - min) / (max - min)) * Math.PI;

  bands.forEach((b) => {
    const from = Math.max(b.min, min);
    const to = Math.min(b.max, max);
    if (to <= from) return;
    const a0 = toAngle(from) + 0.015;
    const a1 = toAngle(to) - 0.015;
    el("path", {
      d: `M${pt(polar(cx, cy, r, a0))} A${r},${r} 0 0 1 ${pt(polar(cx, cy, r, a1))}`,
      stroke: b.color, "stroke-width": 16, fill: "none", "stroke-linecap": "butt",
      opacity: value >= b.min && value < b.max ? 1 : 0.3,
    }, svg);
  });

  [min, max].forEach((v, i) => {
    const [x, y] = polar(cx, cy, r + 2, toAngle(v));
    el("text", { x: x + (i ? -4 : 4), y: y + 18, "text-anchor": i ? "end" : "start" }, svg).textContent = v;
  });

  const needle = el("g", { class: "gauge-needle" }, svg);
  el("path", { d: `M${cx - 5},${cy} L${cx},${cy - r + 22} L${cx + 5},${cy} Z`, fill: "#f4f6fa" }, needle);
  el("circle", { cx, cy, r: 9, fill: "#f4f6fa" }, needle);
  el("circle", { cx, cy, r: 4, fill: "#07090c" }, needle);
  needle.style.transformOrigin = `${cx}px ${cy}px`;
  needle.style.transform = "rotate(-90deg)";
  const deg = ((toAngle(value) - Math.PI) / Math.PI) * 180 - 90;
  onVisible(svg, () => (needle.style.transform = `rotate(${deg}deg)`));
}

/* Animated oval track for indoor / treadmill runs */
export function trackLoop(svg, { laps, seconds }) {
  if (!svg) return;
  svg.replaceChildren();
  const [W, H] = viewBox(svg);
  const rx = W * 0.4;
  const ry = H * 0.32;
  const cx = W / 2;
  const cy = H / 2;
  const d = `M${cx - rx},${cy} a${rx},${ry} 0 1,0 ${rx * 2},0 a${rx},${ry} 0 1,0 ${-rx * 2},0`;
  [0, 14, 28].forEach((o, i) =>
    el("path", { d: `M${cx - rx - o},${cy} a${rx + o},${ry + o} 0 1,0 ${(rx + o) * 2},0 a${rx + o},${ry + o} 0 1,0 ${-(rx + o) * 2},0`, fill: "none", stroke: i ? "rgba(255,255,255,.06)" : "rgba(61,107,255,.5)", "stroke-width": i ? 12 : 3, "stroke-dasharray": i ? "none" : "6 10", class: i ? "" : "track-lane" }, svg)
  );
  const lapTime = Math.max(2.4, Math.min(6, seconds / Math.max(laps, 1) / 30));
  const path = el("path", { d, fill: "none", stroke: "none" }, svg);
  const length = path.getTotalLength();
  const runner = el("g", {}, svg);
  el("circle", { r: 16, fill: "rgba(255,77,46,.25)", class: "runner-glow" }, runner);
  el("circle", { r: 8, fill: "#ff4d2e", stroke: "#fff", "stroke-width": 2 }, runner);
  const place = (progress) => {
    const p = path.getPointAtLength(progress * length);
    runner.setAttribute("transform", `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
  };
  place(0);
  if (!reduceMotion) {
    const t0 = performance.now();
    const tick = (now) => {
      if (!svg.isConnected) return;
      place((((now - t0) / 1000) % lapTime) / lapTime);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  const t = el("text", { x: cx, y: cy - 6, "text-anchor": "middle", class: "track-laps" }, svg);
  t.textContent = Math.round(laps);
  el("text", { x: cx, y: cy + 18, "text-anchor": "middle", class: "track-sub" }, svg).textContent = "LAPS OF A 400 M TRACK";
}
