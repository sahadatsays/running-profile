const PLACES = [
  { test: /hatirjheel/i, name: "Hatirjheel, Dhaka", center: [23.7695, 90.4108] },
  { test: /sylhet/i, name: "Sylhet tea gardens", center: [24.9215, 91.8745] },
  { test: /rangpur/i, name: "Rangpur", center: [25.7439, 89.2752] },
  { test: /turaag|dhaka/i, name: "Dhaka", center: [23.7806, 90.4074] },
];
const DEFAULT_PLACE = { name: "Dhaka", center: [23.7806, 90.4074] };

export const placeOf = (run) => PLACES.find((p) => p.test.test(run.name)) || DEFAULT_PLACE;

const seeded = (text) => {
  let seed = [...text].reduce((h, c) => (Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0), 2166136261);
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const toRad = (d) => (d * Math.PI) / 180;

export function haversineKm([lat1, lng1], [lat2, lng2]) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

/* Adds cumulative distance to every point so playback can be driven by distance */
export function withDistance(points) {
  let total = 0;
  return points.map((p, i) => {
    if (i) total += haversineKm(points[i - 1].latlng, p.latlng);
    return { ...p, km: total };
  });
}

/* A smooth, seeded loop whose length matches the run distance */
export function approximateRoute(run) {
  const place = placeOf(run);
  const rnd = seeded(run.id);
  const [lat0, lng0] = place.center;
  const kmPerLng = 111.32 * Math.cos(toRad(lat0));
  const shift = Math.min(run.km * 0.04, 1.6);
  const cLat = lat0 + ((rnd() - 0.5) * shift) / 111.32;
  const cLng = lng0 + ((rnd() - 0.5) * shift) / kmPerLng;

  const harmonics = Array.from({ length: 4 }, (_, i) => ({ k: i + 2, a: (rnd() * 0.22) / (i + 1), p: rnd() * Math.PI * 2 }));
  const stretch = 0.65 + rnd() * 0.6;
  const tilt = rnd() * Math.PI;
  const dir = rnd() > 0.5 ? 1 : -1;
  const N = Math.min(900, Math.max(160, Math.round(run.km * 18)));

  const shape = Array.from({ length: N + 1 }, (_, i) => {
    const t = (i / N) * Math.PI * 2 * dir;
    const r = 1 + harmonics.reduce((acc, h) => acc + h.a * Math.sin(h.k * t + h.p), 0);
    const x = Math.cos(t) * r * stretch;
    const y = Math.sin(t) * r;
    return [x * Math.cos(tilt) - y * Math.sin(tilt), x * Math.sin(tilt) + y * Math.cos(tilt)];
  });

  let unit = 0;
  for (let i = 1; i < shape.length; i++) unit += Math.hypot(shape[i][0] - shape[i - 1][0], shape[i][1] - shape[i - 1][1]);
  const scaleKm = run.km / unit;

  const [sx, sy] = shape[0];
  const points = shape.map(([x, y], i) => ({
    latlng: [cLat + ((y - sy) * scaleKm) / 111.32, cLng + ((x - sx) * scaleKm) / kmPerLng],
    t: (i / N) * run.seconds,
  }));
  return { points: withDistance(points), approximate: true, place: place.name };
}

export function parseGpx(xmlText, run) {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  const pts = [...doc.getElementsByTagName("trkpt")];
  if (pts.length < 2) return null;
  const child = (node, name) => [...node.getElementsByTagName("*")].find((c) => c.localName === name)?.textContent;
  const t0 = Date.parse(child(pts[0], "time") || "");

  const points = pts.map((p, i) => {
    const time = Date.parse(child(p, "time") || "");
    const ele = parseFloat(child(p, "ele"));
    const hr = parseFloat(child(p, "hr"));
    return {
      latlng: [parseFloat(p.getAttribute("lat")), parseFloat(p.getAttribute("lon"))],
      t: Number.isFinite(time) && Number.isFinite(t0) ? (time - t0) / 1000 : (i / (pts.length - 1)) * run.seconds,
      ele: Number.isFinite(ele) ? ele : null,
      hr: Number.isFinite(hr) ? hr : null,
    };
  });
  return { points: withDistance(points), approximate: false, place: placeOf(run).name };
}

export function routeFromRecord(run) {
  if (!run.route || run.route.length < 2) return null;
  const points = run.route.map((p, i) => ({
    latlng: Array.isArray(p) ? [p[0], p[1]] : [p.lat, p.lng ?? p.lon],
    t: (i / (run.route.length - 1)) * run.seconds,
    ele: p.ele ?? null,
    hr: p.hr ?? null,
  }));
  return { points: withDistance(points), approximate: false, place: placeOf(run).name };
}

/* Position + live values at a given share of the run */
export function sampleAt(route, progress) {
  const pts = route.points;
  const target = progress * pts[pts.length - 1].km;
  let lo = 0;
  let hi = pts.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (pts[mid].km < target) lo = mid;
    else hi = mid;
  }
  const a = pts[lo];
  const b = pts[hi];
  const f = b.km === a.km ? 0 : (target - a.km) / (b.km - a.km);
  return {
    index: lo,
    latlng: [a.latlng[0] + (b.latlng[0] - a.latlng[0]) * f, a.latlng[1] + (b.latlng[1] - a.latlng[1]) * f],
    km: target,
    t: a.t + (b.t - a.t) * f,
    ele: a.ele,
    hr: a.hr ?? b.hr,
  };
}

/* Per-kilometre splits; only meaningful for real tracks with timestamps */
export function splitsOf(route) {
  const pts = route.points;
  const total = pts[pts.length - 1].km;
  const splits = [];
  for (let k = 1; k <= Math.ceil(total); k++) {
    const from = sampleAt(route, Math.min((k - 1) / total, 1));
    const to = sampleAt(route, Math.min(k / total, 1));
    const km = to.km - from.km;
    if (km > 0.2) splits.push({ km: k, pace: (to.t - from.t) / km });
  }
  return splits;
}
