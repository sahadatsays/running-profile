const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_MS = 86400000;

const pad = (n) => String(n).padStart(2, "0");
const sum = (arr, pick) => arr.reduce((total, item) => total + pick(item), 0);
const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

export const toSeconds = (value) =>
  String(value || "0").split(":").map(Number).reduce((total, part) => total * 60 + part, 0);

export const parseDay = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const weekStart = (d) => addDays(d, -((d.getDay() + 6) % 7));
const daysBetween = (a, b) => Math.round((b - a) / DAY_MS);

const isoWeek = (d) => {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - yearStart) / DAY_MS + 1) / 7);
};

export const fmt = {
  pace(sec) {
    const s = Math.round(sec);
    return `${Math.floor(s / 60)}:${pad(s % 60)}`;
  },
  duration(sec) {
    const s = Math.round(sec);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
  },
  km(value, decimals = 1) {
    return Number(value.toFixed(decimals)).toLocaleString("en");
  },
  date: (d) => `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
  shortDate: (d) => `${d.getDate()} ${MONTHS[d.getMonth()]}`,
  month: (d) => MONTHS[d.getMonth()],
};

export const tierOf = (km) => (km >= 50 ? "Ultra" : km >= 42 ? "Marathon+" : km >= 21 ? "Half+" : "Long run");

const MIX_BUCKETS = [
  { name: "Under 5K", min: 0, max: 5, color: "#7aa0ff" },
  { name: "5–15K", min: 5, max: 15, color: "#3d6bff" },
  { name: "15–30K", min: 15, max: 30, color: "#c6f432" },
  { name: "30K+", min: 30, max: Infinity, color: "#ff4d2e" },
];

const HR_BANDS = [
  { label: "<120", min: 0, max: 120, color: "#7aa0ff" },
  { label: "120–139", min: 120, max: 140, color: "#3d6bff" },
  { label: "140–154", min: 140, max: 155, color: "#c6f432" },
  { label: "155–164", min: 155, max: 165, color: "#ff8a3d" },
  { label: "165+", min: 165, max: Infinity, color: "#ff4d2e" },
];

const BEST_BUCKETS = [
  { short: "5K", range: "5–10 km", min: 5, max: 10 },
  { short: "10K", range: "10–21 km", min: 10, max: 21 },
  { short: "Half", range: "21–42 km", min: 21, max: 42 },
  { short: "Full", range: "42–50 km", min: 42, max: 50 },
  { short: "50K+", range: "50 km +", min: 50, max: Infinity, ultra: true },
];

const LONG_EFFORT_KM = 20;
const ULTRA_KM = 50;
const MAX_RUNNING_PACE = 12 * 60;

const heatLevel = (km) => (km <= 0 ? 0 : km < 5 ? 1 : km < 10 ? 2 : km < 20 ? 3 : km < 30 ? 4 : 5);

export function buildStats(data) {
  const runs = data.records
    .filter((r) => r.distanceKm > 0)
    .map((r) => {
      const seconds = toSeconds(r.duration);
      return {
        name: r.name,
        date: parseDay(r.date),
        km: r.distanceKm,
        seconds,
        pace: toSeconds(r.averagePace) || seconds / r.distanceKm,
        hr: r.averageHeartRateBpm,
        calories: r.calories || 0,
        indoor: r.sportType === 101 || /indoor/i.test(r.sport),
      };
    })
    .sort((a, b) => a.date - b.date);

  if (!runs.length) throw new Error("data.json has no runs to show");

  const first = runs[0].date;
  const last = runs[runs.length - 1].date;
  const asOf = data.generatedAt ? parseDay(data.generatedAt) : last;

  const daily = new Map();
  runs.forEach((r) => daily.set(dayKey(r.date), (daily.get(dayKey(r.date)) || 0) + r.km));

  const totalKm = sum(runs, (r) => r.km);
  const totalSec = sum(runs, (r) => r.seconds);
  const longest = runs.reduce((a, r) => (r.km > a.km ? r : a));
  const spanDays = daysBetween(first, last) + 1;

  let streak = 0;
  let longestStreak = 0;
  for (let d = first; d <= last; d = addDays(d, 1)) {
    streak = daily.has(dayKey(d)) ? streak + 1 : 0;
    longestStreak = Math.max(longestStreak, streak);
  }

  const lastWeekStart = weekStart(last);
  const weeks = Array.from({ length: 12 }, (_, i) => {
    const start = addDays(lastWeekStart, (i - 11) * 7);
    const end = addDays(start, 7);
    const inWeek = runs.filter((r) => r.date >= start && r.date < end);
    return { start, label: `W${isoWeek(start)}`, km: sum(inWeek, (r) => r.km), runs: inWeek.length };
  });
  const weekKm = weeks.map((w) => w.km);
  const earlyAvg = mean(weekKm.slice(0, 6));
  const lateAvg = mean(weekKm.slice(6));

  const monthMap = new Map();
  runs.forEach((r) => {
    const key = `${r.date.getFullYear()}-${r.date.getMonth()}`;
    const m = monthMap.get(key) || { date: new Date(r.date.getFullYear(), r.date.getMonth(), 1), km: 0, seconds: 0, runs: 0 };
    m.km += r.km;
    m.seconds += r.seconds;
    m.runs += 1;
    monthMap.set(key, m);
  });
  const months = [...monthMap.values()]
    .sort((a, b) => a.date - b.date)
    .map((m) => ({ ...m, label: fmt.month(m.date), pace: m.seconds / m.km }));

  const mix = MIX_BUCKETS.map((b) => {
    const km = sum(runs.filter((r) => r.km >= b.min && r.km < b.max), (r) => r.km);
    return { name: b.name, color: b.color, km, value: Math.round((km / totalKm) * 100) };
  });

  const hrBands = HR_BANDS.map((b) => {
    const seconds = sum(runs.filter((r) => r.hr >= b.min && r.hr < b.max), (r) => r.seconds);
    return { label: b.label, color: b.color, hours: seconds / 3600, value: Math.round((seconds / totalSec) * 100) };
  });

  const heatStart = weekStart(first);
  const heatWeeks = Math.floor(daysBetween(heatStart, last) / 7) + 1;
  const heatCells = [];
  const heatMonths = [];
  for (let w = 0; w < heatWeeks; w++) {
    const colStart = addDays(heatStart, w * 7);
    const prevStart = addDays(colStart, -7);
    if (w === 0 || colStart.getMonth() !== prevStart.getMonth()) heatMonths.push({ column: w, label: fmt.month(colStart) });
    for (let d = 0; d < 7; d++) {
      const date = addDays(colStart, d);
      const km = daily.get(dayKey(date)) || 0;
      heatCells.push({ date, km, week: w, level: heatLevel(km), outside: date < first || date > last });
    }
  }

  const bests = BEST_BUCKETS.map((b) => {
    const pool = runs.filter((r) => r.km >= b.min && r.km < b.max);
    if (!pool.length) return null;
    return { ...b, run: pool.reduce((a, r) => (r.pace < a.pace ? r : a)) };
  }).filter(Boolean);

  const longRuns = runs.filter((r) => r.km >= LONG_EFFORT_KM);

  return {
    source: data.source || "Watch",
    generatedAt: asOf,
    first,
    last,
    latest: runs[runs.length - 1],
    totals: {
      km: totalKm,
      runs: runs.length,
      hours: totalSec / 3600,
      calories: sum(runs, (r) => r.calories),
      runDays: daily.size,
      spanDays,
      longestStreak,
      ultras: runs.filter((r) => r.km >= ULTRA_KM).length,
      avgHr: sum(runs, (r) => r.hr * r.seconds) / totalSec,
      last30Km: sum(runs.filter((r) => r.date > addDays(asOf, -30)), (r) => r.km),
    },
    longest,
    weeks,
    weekly: { avg: mean(weekKm), trend: earlyAvg ? (lateAvg - earlyAvg) / earlyAvg : 0 },
    months,
    mix,
    hrBands,
    heatmap: { weeks: heatWeeks, cells: heatCells, months: heatMonths },
    bests,
    longRuns,
    efforts: runs.filter((r) => r.pace <= MAX_RUNNING_PACE && r.hr > 0),
    maxRunningPace: MAX_RUNNING_PACE,
  };
}
