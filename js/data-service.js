import { approximateRoute, parseGpx, routeFromRecord } from "./route.js";

let activityCache = null;

export function loadActivityData(url = "data.json") {
  activityCache ??= fetch(url, { cache: "no-cache" }).then(async (res) => {
    if (!res.ok) throw new Error(`Could not load ${url} (${res.status})`);
    const data = await res.json();
    if (!Array.isArray(data.records)) throw new Error(`${url} has no "records" array`);
    return data;
  });
  return activityCache;
}

/* routes/index.json lists the labelIds that have a routes/<labelId>.gpx file */
async function routeManifest() {
  try {
    const res = await fetch("routes/index.json", { cache: "no-cache" });
    return res.ok ? new Set((await res.json()).map(String)) : new Set();
  } catch {
    return new Set();
  }
}

export async function loadRoute(run) {
  const inline = routeFromRecord(run);
  if (inline) return inline;

  if ((await routeManifest()).has(run.id)) {
    try {
      const res = await fetch(`routes/${encodeURIComponent(run.id)}.gpx`);
      if (res.ok) {
        const parsed = parseGpx(await res.text(), run);
        if (parsed) return parsed;
      }
    } catch (err) {
      console.warn(`GPX for ${run.id} could not be read`, err);
    }
  }
  return approximateRoute(run);
}
