import { parseDay, toSeconds } from "./stats.js";

export const STAGE_COLORS = {
  run1: "#7aa0ff",
  bike: "#ff4d2e",
  transition: "#c6f432",
  run2: "#3d6bff",
  finish: "#ffc94d",
};

export const albumUrl = (album) => `album.html?id=${encodeURIComponent(album.id)}`;

const minutesOf = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export function normalizeAlbum(raw) {
  const date = parseDay(raw.date);
  const finishSeconds = toSeconds(raw.result?.finishTime);
  const totalKm = raw.legs.reduce((sum, leg) => sum + leg.km, 0);

  let offset = 0;
  const legs = raw.legs.map((leg) => {
    const share = leg.km / totalKm;
    const item = { ...leg, share, offset, color: STAGE_COLORS[leg.key] };
    offset += share;
    return item;
  });

  const stageMeta = new Map(raw.stages.map((s) => [s.key, s]));
  const photos = raw.photos.map((p, index) => ({
    ...p,
    index,
    thumb: `${raw.path}/${p.file}-800.jpg`,
    full: `${raw.path}/${p.file}-1800.jpg`,
    portrait: p.h > p.w,
    minutes: p.time ? minutesOf(p.time) : null,
    stageLabel: stageMeta.get(p.stage)?.label ?? p.stage,
    color: STAGE_COLORS[p.stage],
  }));

  const stages = raw.stages.map((s) => {
    const own = photos.filter((p) => p.stage === s.key);
    const timed = own.filter((p) => p.minutes !== null);
    const leg = legs.find((l) => l.key === s.key);
    return {
      ...s,
      color: STAGE_COLORS[s.key],
      km: leg?.km ?? null,
      count: own.length,
      cover: own.find((p) => p.highlight) ?? own[0],
      from: timed[0]?.time ?? null,
      to: timed[timed.length - 1]?.time ?? null,
      fromMinutes: timed[0]?.minutes ?? null,
      toMinutes: timed[timed.length - 1]?.minutes ?? null,
    };
  });

  const timed = photos.filter((p) => p.minutes !== null);
  const flagged = photos.filter((p) => p.highlight);

  return {
    ...raw,
    date,
    finishSeconds,
    totalKm,
    avgSpeed: finishSeconds ? totalKm / (finishSeconds / 3600) : null,
    legs,
    stages,
    photos,
    cover: photos.find((p) => p.file === raw.cover) ?? photos[0],
    highlights: flagged.length ? flagged : photos.slice(0, 6),
    morning: timed.length
      ? { start: timed[0].minutes, end: timed[timed.length - 1].minutes, photos: timed }
      : null,
  };
}

export const findAlbum = (albums, id) => {
  const raw = albums.find((a) => a.id === id) ?? albums[0];
  return raw ? normalizeAlbum(raw) : null;
};

export const latestAlbum = (albums) =>
  albums.length ? normalizeAlbum([...albums].sort((a, b) => b.date.localeCompare(a.date))[0]) : null;

export const clockLabel = (minutes) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
