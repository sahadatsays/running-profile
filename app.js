import { hydrateIcons } from "./js/icons.js";
import { escapeHtml, initGallery, initMagnetic, initNav, initTilt, observeReveals } from "./js/ui.js";

const PAGES = {
  profile: () => import("./js/pages/profile.js"),
  history: () => import("./js/pages/history.js"),
  run: () => import("./js/pages/run-detail.js"),
};

initNav();
hydrateIcons();
initGallery();

const load = PAGES[document.body.dataset.page];

(async () => {
  try {
    if (load) await (await load()).render();
  } catch (err) {
    console.error(err);
    const notice = document.createElement("div");
    notice.className = "data-error";
    notice.innerHTML = `<strong>Couldn’t load the running data.</strong> ${escapeHtml(err.message)}. If you opened the file directly, serve the folder instead (for example <code>python3 -m http.server</code>).`;
    document.body.appendChild(notice);
  }
  hydrateIcons();
  observeReveals();
  initTilt();
  initMagnetic();
})();
