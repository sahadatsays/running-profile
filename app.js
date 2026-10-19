(() => {
  "use strict";

  /* =========================================================
     Profile data — edit these values to update the charts
     ========================================================= */
  const DATA = {
    weeklyKm: [64, 72, 78, 60, 84, 90, 96, 74, 98, 108, 92, 116],
    goal: { target: 3000, done: 2436 },
    terrain: [
      { name: "Road", value: 58, color: "#3d6bff" },
      { name: "Trail", value: 24, color: "#ff4d2e" },
      { name: "Track", value: 10, color: "#c6f432" },
      { name: "Treadmill", value: 8, color: "#7aa0ff" },
    ],
    hrZones: [
      { zone: "Z1", label: "Recovery", value: 18, color: "#7aa0ff" },
      { zone: "Z2", label: "Endurance", value: 46, color: "#3d6bff" },
      { zone: "Z3", label: "Tempo", value: 22, color: "#c6f432" },
      { zone: "Z4", label: "Threshold", value: 10, color: "#ff8a3d" },
      { zone: "Z5", label: "VO2 max", value: 4, color: "#ff4d2e" },
    ],
    paceByMonth: {
      labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"],
      seconds: [373, 368, 365, 360, 356, 354, 350, 348, 345, 342],
    },
    raceSplits: [395, 400, 405, 412, 420, 432, 440, 434, 425, 415],
    raceDays: [32, 36, 44, 49],
  };

  /* =========================================================
     Helpers
     ========================================================= */
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const NS = "http://www.w3.org/2000/svg";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const el = (tag, attrs = {}, parent) => {
    const node = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (parent) parent.appendChild(node);
    return node;
  };

  const fmtPace = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

  const seeded = (seed) => () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const onVisible = (target, fn, threshold = 0.3) => {
    if (!target) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            fn(e.target);
            io.disconnect();
          }
        });
      },
      { threshold }
    );
    io.observe(target);
  };

  const smoothPath = (pts) => {
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const c1x = p1[0] + (p2[0] - p0[0]) / 6;
      const c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6;
      const c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
    }
    return d;
  };

  const svgPoint = (svg, evt) => {
    const pt = new DOMPoint(evt.clientX, evt.clientY);
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  };

  /* Tooltip */
  const tip = $("#tooltip");
  const showTip = (evt, html) => {
    if (!tip) return;
    tip.innerHTML = html;
    tip.style.left = `${evt.clientX}px`;
    tip.style.top = `${evt.clientY}px`;
    tip.classList.add("is-on");
  };
  const hideTip = () => tip && tip.classList.remove("is-on");

  /* =========================================================
     Nav
     ========================================================= */
  const nav = $("#nav");
  if (nav) {
    const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const toggle = $(".nav__toggle", nav);
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open);
    });
    $$(".nav__links a", nav).forEach((a) =>
      a.addEventListener("click", () => {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      })
    );
  }

  /* =========================================================
     Scroll reveal
     ========================================================= */
  const revealIO = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("is-visible");
          revealIO.unobserve(e.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
  );
  $$(".reveal").forEach((n) => revealIO.observe(n));

  /* =========================================================
     Counters
     ========================================================= */
  $$("[data-count]").forEach((node) => {
    const end = Number(node.dataset.count);
    onVisible(node, () => {
      if (reduceMotion) {
        node.textContent = end.toLocaleString();
        return;
      }
      const dur = 1800;
      const start = performance.now();
      const tick = (now) => {
        const p = Math.min((now - start) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 4);
        node.textContent = Math.round(end * eased).toLocaleString();
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, 0.5);
  });

  /* =========================================================
     Bar chart
     ========================================================= */
  function barChart(svg, values, opts) {
    if (!svg) return;
    const [, , W, H] = svg.getAttribute("viewBox").split(" ").map(Number);
    const pad = { t: 28, r: 4, b: 30, l: opts.axis ? 36 : 4 };
    const iw = W - pad.l - pad.r;
    const ih = H - pad.t - pad.b;
    const min = opts.min ?? 0;
    const max = opts.max ?? Math.ceil(Math.max(...values) / 20) * 20;
    const y = (v) => pad.t + ih - ((v - min) / (max - min)) * ih;

    const defs = el("defs", {}, svg);
    const g1 = el("linearGradient", { id: "barGrad", x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el("stop", { offset: 0, "stop-color": "#7aa0ff" }, g1);
    el("stop", { offset: 1, "stop-color": "#2443c9" }, g1);
    const g2 = el("linearGradient", { id: "barGradFire", x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el("stop", { offset: 0, "stop-color": "#ff8a3d" }, g2);
    el("stop", { offset: 1, "stop-color": "#d92c12" }, g2);

    if (opts.axis) {
      const grid = el("g", { class: "grid" }, svg);
      for (let i = 0; i <= 4; i++) {
        const v = min + ((max - min) / 4) * i;
        el("line", { x1: pad.l, x2: W - pad.r, y1: y(v), y2: y(v) }, grid);
        el("text", { x: 0, y: y(v) + 4 }, svg).textContent = Math.round(v);
      }
    }

    const slot = iw / values.length;
    const bw = Math.min(slot * 0.58, 40);

    values.forEach((v, i) => {
      const x = pad.l + slot * i + (slot - bw) / 2;
      const top = y(v);
      const bar = el("rect", {
        x,
        y: top,
        width: bw,
        height: pad.t + ih - top,
        rx: 6,
        class: `bar${opts.highlight(v, i) ? " is-peak" : ""}`,
      }, svg);
      bar.style.transitionDelay = `${i * 70}ms`;

      if (opts.topLabel && opts.topLabel(v, i)) {
        const t = el("text", { x: x + bw / 2, y: top - 10, "text-anchor": "middle" }, svg);
        t.textContent = opts.topLabel(v, i);
        t.style.fill = "#f4f6fa";
        t.style.fontWeight = 600;
      }

      el("text", { x: x + bw / 2, y: H - 8, "text-anchor": "middle" }, svg).textContent = opts.labels[i];

      const hit = el("rect", { x: pad.l + slot * i, y: pad.t, width: slot, height: ih, fill: "transparent" }, svg);
      hit.addEventListener("mousemove", (e) => {
        bar.style.filter = "brightness(1.3)";
        showTip(e, opts.tip(v, i));
      });
      hit.addEventListener("mouseleave", () => {
        bar.style.filter = "";
        hideTip();
      });
    });
  }

  barChart($("#weeklyChart"), DATA.weeklyKm, {
    axis: true,
    labels: DATA.weeklyKm.map((_, i) => `W${i + 1}`),
    highlight: (v) => v === Math.max(...DATA.weeklyKm),
    topLabel: (v) => (v === Math.max(...DATA.weeklyKm) ? `${v} km` : ""),
    tip: (v, i) => `Week ${i + 1} · ${v} km <span>· ${(v / 7).toFixed(1)} km/day</span>`,
  });

  const splitSpeed = DATA.raceSplits.map((s) => 3600 / s);
  barChart($("#splitsChart"), splitSpeed, {
    min: 7,
    max: 9.5,
    labels: DATA.raceSplits.map((_, i) => `${(i + 1) * 5}K`),
    highlight: (_, i) => i >= 7,
    topLabel: (_, i) => fmtPace(DATA.raceSplits[i]),
    tip: (v, i) => `${i * 5}–${(i + 1) * 5} km · ${fmtPace(DATA.raceSplits[i])}/km <span>· ${v.toFixed(1)} km/h</span>`,
  });

  /* =========================================================
     Line / area chart
     ========================================================= */
  function lineChart(svg, values, opts) {
    if (!svg) return;
    const [, , W, H] = svg.getAttribute("viewBox").split(" ").map(Number);
    const pad = { t: 16, r: 8, b: opts.labels ? 28 : 12, l: 8 };
    const iw = W - pad.l - pad.r;
    const ih = H - pad.t - pad.b;
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const span = hi - lo || 1;
    const x = (i) => pad.l + (iw / (values.length - 1)) * i;
    const y = (v) => {
      const n = (v - lo) / span;
      return pad.t + ih * (opts.invert ? n : 1 - n) * 0.86 + ih * 0.07;
    };
    const pts = values.map((v, i) => [x(i), y(v)]);
    const gid = `area-${svg.id}`;

    const defs = el("defs", {}, svg);
    const grad = el("linearGradient", { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el("stop", { offset: 0, "stop-color": opts.color, "stop-opacity": 0.35 }, grad);
    el("stop", { offset: 1, "stop-color": opts.color, "stop-opacity": 0 }, grad);

    const grid = el("g", { class: "grid" }, svg);
    for (let i = 0; i <= 3; i++) {
      const gy = pad.t + (ih / 3) * i;
      el("line", { x1: pad.l, x2: W - pad.r, y1: gy, y2: gy }, grid);
    }

    const line = smoothPath(pts);
    el("path", {
      d: `${line} L${x(values.length - 1)},${pad.t + ih} L${x(0)},${pad.t + ih} Z`,
      fill: `url(#${gid})`,
      class: "area-path",
    }, svg);
    const path = el("path", { d: line, stroke: opts.color, class: "line-path" }, svg);

    if (opts.labels) {
      opts.labels.forEach((l, i) => {
        el("text", { x: x(i), y: H - 6, "text-anchor": i === 0 ? "start" : i === opts.labels.length - 1 ? "end" : "middle" }, svg).textContent = l;
      });
    }

    if (opts.dots) {
      pts.forEach(([px, py], i) => {
        const d = el("circle", { cx: px, cy: py, r: 4, class: "dot", stroke: opts.color }, svg);
        d.style.transitionDelay = `${0.8 + i * 0.1}s`;
      });
    }

    const guide = el("line", { y1: pad.t, y2: pad.t + ih, stroke: "rgba(255,255,255,.25)", "stroke-dasharray": "3 4", opacity: 0 }, svg);
    const focus = el("circle", { r: 6, fill: opts.color, stroke: "#07090c", "stroke-width": 3, opacity: 0 }, svg);

    svg.addEventListener("mousemove", (e) => {
      const p = svgPoint(svg, e);
      const i = Math.max(0, Math.min(values.length - 1, Math.round((p.x - pad.l) / (iw / (values.length - 1)))));
      guide.setAttribute("x1", pts[i][0]);
      guide.setAttribute("x2", pts[i][0]);
      guide.setAttribute("opacity", 1);
      focus.setAttribute("cx", pts[i][0]);
      focus.setAttribute("cy", pts[i][1]);
      focus.setAttribute("opacity", 1);
      showTip(e, opts.tip(values[i], i));
    });
    svg.addEventListener("mouseleave", () => {
      guide.setAttribute("opacity", 0);
      focus.setAttribute("opacity", 0);
      hideTip();
    });

    const len = path.getTotalLength();
    path.style.strokeDasharray = len;
    path.style.strokeDashoffset = reduceMotion ? 0 : len;
    onVisible(svg, () => {
      path.style.strokeDashoffset = 0;
    });
  }

  lineChart($("#paceChart"), DATA.paceByMonth.seconds, {
    color: "#c6f432",
    invert: true,
    dots: true,
    labels: DATA.paceByMonth.labels.map((l, i) => (i % 3 === 0 || i === 9 ? l : "")),
    tip: (v, i) => `${DATA.paceByMonth.labels[i]} · ${fmtPace(v)}/km`,
  });

  const rnd = seeded(50);
  const hr = Array.from({ length: 50 }, (_, i) => {
    const drift = 136 + i * 0.42;
    const climb = i > 40 ? (i - 40) * 1.3 : 0;
    return Math.round(drift + climb + (rnd() - 0.5) * 7);
  });
  lineChart($("#hrChart"), hr, {
    color: "#ff4d2e",
    labels: hr.map((_, i) => (i === hr.length - 1 ? "50K" : i % 10 === 0 ? `${i}K` : "")),
    tip: (v, i) => `${i + 1} km · ${v} bpm`,
  });

  /* =========================================================
     Goal ring
     ========================================================= */
  const ring = $("#goalRing .progress");
  if (ring) {
    const C = 2 * Math.PI * 84;
    ring.style.strokeDasharray = C;
    ring.style.strokeDashoffset = C;
    onVisible(ring.closest("svg"), () => {
      ring.style.strokeDashoffset = C * (1 - DATA.goal.done / DATA.goal.target);
    });
  }

  /* =========================================================
     Terrain donut
     ========================================================= */
  const donut = $("#terrainDonut");
  if (donut) {
    const r = 60;
    const C = 2 * Math.PI * r;
    const total = DATA.terrain.reduce((a, t) => a + t.value, 0);
    const gap = 3;
    el("circle", { cx: 80, cy: 80, r, stroke: "rgba(255,255,255,.05)" }, donut);

    let offset = 0;
    const segs = DATA.terrain.map((t) => {
      const len = (t.value / total) * C;
      const c = el("circle", { cx: 80, cy: 80, r, stroke: t.color, "stroke-dasharray": `0 ${C}`, "stroke-dashoffset": -offset }, donut);
      c.addEventListener("mousemove", (e) => showTip(e, `${t.name} · ${t.value}%`));
      c.addEventListener("mouseleave", hideTip);
      offset += len;
      return { c, len };
    });

    onVisible(donut, () => {
      segs.forEach(({ c, len }, i) => {
        setTimeout(() => c.setAttribute("stroke-dasharray", `${Math.max(len - gap, 0)} ${C}`), i * 180);
      });
    });

    $("#terrainLegend").innerHTML = DATA.terrain
      .map((t) => `<li><i style="background:${t.color}"></i>${t.name}<b>${t.value}%</b></li>`)
      .join("");
  }

  /* =========================================================
     HR zones
     ========================================================= */
  const zones = $("#hrZones");
  if (zones) {
    const max = Math.max(...DATA.hrZones.map((z) => z.value));
    zones.innerHTML = DATA.hrZones
      .map(
        (z) => `
        <div class="zone__row" title="${z.label}">
          <span class="mono">${z.zone}</span>
          <div class="zone__bar"><span style="background:${z.color}" data-w="${(z.value / max) * 100}"></span></div>
          <span class="mono">${z.value}%</span>
        </div>`
      )
      .join("");
    onVisible(zones, () => {
      $$(".zone__bar span", zones).forEach((s, i) => {
        s.style.transitionDelay = `${i * 120}ms`;
        s.style.width = `${s.dataset.w}%`;
      });
    });
  }

  /* =========================================================
     Activity heatmap
     ========================================================= */
  const heat = $("#heatmap");
  if (heat) {
    const r = seeded(2026);
    const frag = document.createDocumentFragment();
    for (let w = 0; w < 52; w++) {
      for (let d = 0; d < 7; d++) {
        const cell = document.createElement("span");
        let level;
        if (DATA.raceDays.includes(w) && d === 6) level = 5;
        else {
          const base = r();
          const build = w / 52;
          if (d === 6) level = base < 0.15 ? 0 : 4;
          else if (d === 0 && base < 0.6) level = 0;
          else level = base < 0.2 ? 0 : Math.min(4, Math.ceil((base + build * 0.4) * 3));
        }
        cell.dataset.l = level;
        cell.style.transitionDelay = `${w * 14}ms`;
        cell.addEventListener("mousemove", (e) =>
          showTip(e, level === 5 ? "Race day" : level === 0 ? "Rest day" : `Week ${w + 1} · ${["", "Easy", "Steady", "Tempo", "Long run"][level]}`)
        );
        cell.addEventListener("mouseleave", hideTip);
        frag.appendChild(cell);
      }
    }
    heat.appendChild(frag);

    const now = new Date();
    const months = [];
    for (let i = 11; i >= 0; i--) {
      months.push(new Date(now.getFullYear(), now.getMonth() - i, 1).toLocaleString("en", { month: "short" }));
    }
    $("#heatMonths").innerHTML = months.map((m) => `<span>${m}</span>`).join("");
  }

  /* =========================================================
     Timeline progress line
     ========================================================= */
  const timeline = $("#timeline");
  const tlProgress = $("#timelineProgress");
  if (timeline && tlProgress) {
    const update = () => {
      const rect = timeline.getBoundingClientRect();
      const mid = window.innerHeight * 0.6;
      const p = Math.min(Math.max((mid - rect.top) / rect.height, 0), 1);
      tlProgress.style.height = `${p * 100}%`;
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
  }

  /* =========================================================
     Gallery: filters + lightbox
     ========================================================= */
  const masonry = $("#masonry");
  if (masonry) {
    const shots = $$(".shot", masonry);
    const filters = $$(".filter");

    filters.forEach((btn) =>
      btn.addEventListener("click", () => {
        filters.forEach((b) => b.classList.toggle("is-active", b === btn));
        const f = btn.dataset.filter;
        shots.forEach((s, i) => {
          const show = f === "all" || s.dataset.cat === f;
          s.classList.toggle("is-hidden", !show);
          if (show) {
            s.classList.add("is-entering");
            setTimeout(() => s.classList.remove("is-entering"), 30 + i * 60);
          }
        });
      })
    );

    const lb = $("#lightbox");
    const img = $("#lbImg");
    let list = [];
    let idx = 0;

    const render = () => {
      const s = list[idx];
      img.classList.add("is-swapping");
      const next = new Image();
      next.onload = () => {
        img.src = next.src;
        img.alt = s.querySelector("img").alt;
        img.classList.remove("is-swapping");
      };
      next.src = s.dataset.full;
      $("#lbTitle").textContent = s.dataset.title;
      $("#lbMeta").textContent = s.dataset.meta;
      $("#lbCount").textContent = `${String(idx + 1).padStart(2, "0")} / ${String(list.length).padStart(2, "0")}`;
    };

    const open = (shot) => {
      list = shots.filter((s) => !s.classList.contains("is-hidden"));
      idx = list.indexOf(shot);
      render();
      lb.classList.add("is-open");
      document.body.style.overflow = "hidden";
      $("#lbClose").focus();
    };
    const close = () => {
      lb.classList.remove("is-open");
      document.body.style.overflow = "";
      list[idx]?.focus();
    };
    const step = (d) => {
      idx = (idx + d + list.length) % list.length;
      render();
    };

    shots.forEach((s) => s.addEventListener("click", () => open(s)));
    $("#lbClose").addEventListener("click", close);
    $("#lbPrev").addEventListener("click", () => step(-1));
    $("#lbNext").addEventListener("click", () => step(1));
    lb.addEventListener("click", (e) => {
      if (e.target === lb || e.target.classList.contains("lightbox__stage")) close();
    });

    document.addEventListener("keydown", (e) => {
      if (!lb.classList.contains("is-open")) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    });

    let touchX = null;
    lb.addEventListener("touchstart", (e) => (touchX = e.touches[0].clientX), { passive: true });
    lb.addEventListener("touchend", (e) => {
      if (touchX === null) return;
      const dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
      touchX = null;
    });
  }
})();
