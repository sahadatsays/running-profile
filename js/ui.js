export const $ = (s, root = document) => root.querySelector(s);
export const $$ = (s, root = document) => [...root.querySelectorAll(s)];
export const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function onVisible(target, fn, threshold = 0.3) {
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
}

/* Tooltip */
export const tooltip = {
  show(evt, html) {
    const tip = $("#tooltip");
    if (!tip) return;
    tip.innerHTML = html;
    tip.style.left = `${evt.clientX}px`;
    tip.style.top = `${evt.clientY}px`;
    tip.classList.add("is-on");
  },
  hide() {
    $("#tooltip")?.classList.remove("is-on");
  },
};

/* Nav */
export function initNav() {
  const nav = $("#nav");
  if (!nav) return;
  const page = document.body.dataset.page === "run" ? "history" : document.body.dataset.page;
  $$("[data-nav]", nav).forEach((a) => a.classList.toggle("is-active", a.dataset.nav === page));
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

/* Scroll reveal */
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

export function observeReveals(root = document) {
  $$(".reveal:not(.is-visible)", root).forEach((n) => revealIO.observe(n));
}

/* Counters */
export function initCounters(root = document) {
  $$("[data-count]", root).forEach((node) => {
    const end = Number(node.dataset.count);
    const decimals = Number(node.dataset.decimals || 0);
    const format = (v) => v.toLocaleString("en", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    onVisible(node, () => {
      if (reduceMotion) {
        node.textContent = format(end);
        return;
      }
      const start = performance.now();
      const tick = (now) => {
        const p = Math.min((now - start) / 1800, 1);
        node.textContent = format(end * (1 - Math.pow(1 - p, 4)));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, 0.5);
  });
}

/* Rolling-digit odometer: every digit is a column of 0–9 that slides into place */
export function odometer(node, value, decimals = 0) {
  if (!node) return;
  const text = value.toLocaleString("en", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  node.setAttribute("aria-label", text);
  node.innerHTML = [...text]
    .map((ch) =>
      /\d/.test(ch)
        ? `<span class="odo__digit" data-d="${ch}"><span class="odo__reel">${"0123456789".split("").map((n) => `<span>${n}</span>`).join("")}</span></span>`
        : `<span class="odo__sep">${ch}</span>`
    )
    .join("");
  onVisible(node, () => {
    [...node.querySelectorAll(".odo__digit")].forEach((d, i) => {
      const reel = d.firstElementChild;
      reel.style.transitionDelay = `${i * 110}ms`;
      reel.style.transform = `translateY(-${Number(d.dataset.d) * 10}%)`;
    });
  }, 0.2);
}

/* Pointer tilt for cards and photos */
export function initTilt(selector = "[data-tilt]") {
  if (reduceMotion || !window.matchMedia("(hover: hover)").matches) return;
  $$(selector).forEach((node) => {
    const max = Number(node.dataset.tilt || 8);
    node.addEventListener("pointermove", (e) => {
      const r = node.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      node.style.setProperty("--rx", `${(-py * max).toFixed(2)}deg`);
      node.style.setProperty("--ry", `${(px * max).toFixed(2)}deg`);
      node.style.setProperty("--mx", `${((px + 0.5) * 100).toFixed(1)}%`);
      node.style.setProperty("--my", `${((py + 0.5) * 100).toFixed(1)}%`);
    });
    node.addEventListener("pointerleave", () => {
      node.style.setProperty("--rx", "0deg");
      node.style.setProperty("--ry", "0deg");
    });
  });
}

export function initMagnetic(selector = ".btn--magnetic") {
  if (reduceMotion || !window.matchMedia("(hover: hover)").matches) return;
  $$(selector).forEach((btn) => {
    btn.addEventListener("pointermove", (e) => {
      const r = btn.getBoundingClientRect();
      btn.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.18}px, ${(e.clientY - r.top - r.height / 2) * 0.3}px)`;
    });
    btn.addEventListener("pointerleave", () => (btn.style.transform = ""));
  });
}

/* Timeline progress line */
export function initTimelineProgress() {
  const timeline = $("#timeline");
  const bar = $("#timelineProgress");
  if (!timeline || !bar) return;
  const update = () => {
    const rect = timeline.getBoundingClientRect();
    const p = Math.min(Math.max((window.innerHeight * 0.6 - rect.top) / rect.height, 0), 1);
    bar.style.height = `${p * 100}%`;
  };
  update();
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
}

/* Gallery: filters + lightbox */
export function initGallery() {
  const masonry = $("#masonry");
  if (!masonry) return;
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
