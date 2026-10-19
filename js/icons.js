const PATHS = {
  distance: '<path d="M4 19c4 0 4-6 8-6s4-8 8-8"/><circle cx="4" cy="19" r="2"/><circle cx="20" cy="5" r="2"/>',
  time: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/>',
  pace: '<path d="M12 14l4-4"/><path d="M3.3 19a10 10 0 1 1 17.4 0"/>',
  speed: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21.2l8.8-8.8a5.5 5.5 0 0 0 0-7.8z"/>',
  pulse: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  flame: '<path d="M12 22c4.4 0 8-3.1 8-7.5 0-5.5-5-7-4.5-12.5C12 4 9 7.5 9 11c-1.2-1-2-2.3-2-4.5C4.8 8.6 4 11.2 4 14.5 4 18.9 7.6 22 12 22z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  route: '<circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H17a3.5 3.5 0 0 0 0-7H7a3.5 3.5 0 0 1 0-7h8.5"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
  mountain: '<path d="M3 20l6-11 4 6 2-3 6 8z"/><path d="M8 11l1.5 1.5L11 11"/>',
  shoe: '<path d="M3 15c0-2 1-5 2-7l4 2c1.5.8 3 1 4.5 1H16a5 5 0 0 1 5 5v1H5a2 2 0 0 1-2-2z"/><path d="M3 18h18M9 10l1-2M12 11l1-2"/>',
  treadmill: '<path d="M4 18h13l3-3"/><circle cx="6" cy="18" r="2"/><circle cx="16" cy="18" r="2"/><path d="M17 15l-3-9h3"/><circle cx="11" cy="4" r="1.5"/><path d="M11 6l-1 4 3 2"/>',
  outdoor: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  runner: '<circle cx="14" cy="4" r="2"/><path d="M7 21l3-6 3 2v4M10 15l1.5-5.5 4 3H19M8 10.5l3.5-2"/>',
  zap: '<path d="M13 2L3 14h9l-1 8 10-12h-9z"/>',
  gauge: '<path d="M12 14l4-4"/><path d="M3.3 19a10 10 0 1 1 17.4 0z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  trend: '<path d="M3 17l6-6 4 4 8-8M14 7h7v7"/>',
  load: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  battery: '<rect x="2" y="7" width="17" height="10" rx="2"/><path d="M22 11v2M6 10v4M10 10v4"/>',
  pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  play: '<path d="M7 4l13 8-13 8z"/>',
  pause: '<path d="M7 4h4v16H7zM14 4h4v16h-4z"/>',
  replay: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.5-4.5"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>',
  sort: '<path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4"/>',
  chevronLeft: '<path d="M15 6l-6 6 6 6"/>',
  chevronRight: '<path d="M9 6l6 6-6 6"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  arrowLeft: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  medal: '<circle cx="12" cy="15" r="6"/><path d="M8.5 10L6 3h4l2 4 2-4h4l-2.5 7"/><path d="M12 12.5l.9 1.8 2 .3-1.4 1.4.3 2-1.8-.9-1.8.9.3-2-1.4-1.4 2-.3z"/>',
  week: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M7 14h2M11 14h2M15 14h2M7 17h2"/>',
  steps: '<path d="M8 3c2 0 3 2 3 5s-1 5-3 5-3-2-3-5 1-5 3-5zM6 15h4v3a2 2 0 0 1-4 0z"/><path d="M16 7c2 0 3 2 3 5s-1 5-3 5-3-2-3-5 1-5 3-5zM14 19h4"/>',
};

export function icon(name, cls = "") {
  const body = PATHS[name] || PATHS.info;
  return `<svg class="ico${cls ? ` ${cls}` : ""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

export function hydrateIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((node) => {
    node.innerHTML = icon(node.dataset.icon, node.dataset.iconClass || "");
  });
}
