const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
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

export const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const weekStart = (d) => addDays(d, -((d.getDay() + 6) % 7));
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
  weekday: (d) => WEEKDAYS[(d.getDay() + 6) % 7],
  monthYear: (d) => `${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][d.getMonth()]} ${d.getFullYear()}`,
};

export const tierOf = (km) => (km >= 50 ? "Ultra" : km >= 42 ? "Marathon+" : km >= 21 ? "Half+" : km >= 10 ? "10K+" : km >= 5 ? "5K+" : "Short");

export const HR_BANDS = [
  { label: "<120", name: "Recovery", min: 0, max: 120, color: "#7aa0ff" },
  { label: "120–139", name: "Easy", min: 120, max: 140, color: "#3d6bff" },
  { label: "140–154", name: "Steady", min: 140, max: 155, color: "#c6f432" },
  { label: "155–164", name: "Tempo", min: 155, max: 165, color: "#ff8a3d" },
  { label: "165+", name: "Hard", min: 165, max: Infinity, color: "#ff4d2e" },
];

export const hrBandOf = (hr) => HR_BANDS.find((b) => hr >= b.min && hr < b.max) || HR_BANDS[0];

const MIX_BUCKETS = [
  { name: "Under 5K", min: 0, max: 5, color: "#7aa0ff" },
  { name: "5–15K", min: 5, max: 15, color: "#3d6bff" },
  { name: "15–30K", min: 15, max: 30, color: "#c6f432" },
  { name: "30K+", min: 30, max: Infinity, color: "#ff4d2e" },
];

const BEST_BUCKETS = [
  { short: "5K", range: "5–10 km", min: 5, max: 10 },
  { short: "10K", range: "10–21 km", min: 10, max: 21 },
  { short: "Half", range: "21–42 km", min: 21, max: 42 },
  { short: "Full", range: "42–50 km", min: 42, max: 50 },
  { short: "50K+", range: "50 km +", min: 50, max: Infinity, ultra: true },
];

const PREDICTION_TARGETS = [
  { label: "5K", km: 5 },
  { label: "10K", km: 10 },
  { label: "Half", km: 21.0975 },
  { label: "Marathon", km: 42.195 },
  { label: "50K", km: 50 },
];

const LONG_EFFORT_KM = 20;
const ULTRA_KM = 50;
const MAX_RUNNING_PACE = 12 * 60;
const MILESTONES = [100, 250, 500, 750, 1000, 1500, 2000, 3000, 5000];

const heatLevel = (km) => (km <= 0 ? 0 : km < 5 ? 1 : km < 10 ? 2 : km < 20 ? 3 : km < 30 ? 4 : 5);

/* Every page starts from the same normalized, chronologically sorted run list */
export function normalizeRuns(data) {
  const runs = data.records
    .filter((r) => r.distanceKm > 0)
    .map((r, i) => {
      const seconds = toSeconds(r.duration);
      return {
        id: String(r.labelId || `${r.date}-${i}`),
        name: r.name,
        sport: r.sport,
        date: parseDay(r.date),
        km: r.distanceKm,
        seconds,
        pace: toSeconds(r.averagePace) || seconds / r.distanceKm,
        hr: r.averageHeartRateBpm || 0,
        calories: r.calories || 0,
        indoor: r.sportType === 101 || /indoor/i.test(r.sport),
        route: Array.isArray(r.route) ? r.route : null,
      };
    })
    .sort((a, b) => a.date - b.date || a.id.localeCompare(b.id));
  runs.forEach((r, i) => (r.index = i));
  return runs;
}

export function buildStats(data) {
  const runs = normalizeRuns(data);
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
  const days = [];
  let cumulative = 0;
  for (let d = first; d <= last; d = addDays(d, 1)) {
    const km = daily.get(dayKey(d)) || 0;
    streak = km ? streak + 1 : 0;
    longestStreak = Math.max(longestStreak, streak);
    cumulative += km;
    days.push({ date: d, km, cumulative });
  }

  const milestones = MILESTONES.filter((m) => m <= cumulative).map((m) => ({
    km: m,
    date: days.find((d) => d.cumulative >= m).date,
  }));
  const nextMilestone = MILESTONES.find((m) => m > cumulative) || null;

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

  const weekdays = WEEKDAYS.map((label, i) => {
    const pool = runs.filter((r) => (r.date.getDay() + 6) % 7 === i);
    return { label, km: sum(pool, (r) => r.km), runs: pool.length };
  });

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
    if (w === 0 || colStart.getMonth() !== addDays(colStart, -7).getMonth()) heatMonths.push({ column: w, label: fmt.month(colStart) });
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
  const efforts = runs.filter((r) => r.pace <= MAX_RUNNING_PACE && r.hr > 0);
  const fastest5k = runs.filter((r) => r.km >= 5).reduce((a, r) => (!a || r.pace < a.pace ? r : a), null);
  const aerobicShare = sum(runs.filter((r) => r.hr < 155), (r) => r.seconds) / totalSec;
  const longShare = sum(longRuns, (r) => r.km) / totalKm;
  const clamp = (v) => Math.max(4, Math.min(100, Math.round(v)));

  const dna = [
    { label: "Endurance", score: clamp(longest.km), value: `${fmt.km(longest.km, 0)} km longest` },
    { label: "Volume", score: clamp(mean(weekKm)), value: `${fmt.km(mean(weekKm), 0)} km / week` },
    { label: "Consistency", score: clamp((daily.size / spanDays) * 100), value: `${Math.round((daily.size / spanDays) * 100)}% of days` },
    { label: "Speed", score: fastest5k ? clamp(((600 - fastest5k.pace) / 360) * 100) : 4, value: fastest5k ? `${fmt.pace(fastest5k.pace)}/km best 5K+` : "—" },
    { label: "Aerobic", score: clamp(aerobicShare * 100), value: `${Math.round(aerobicShare * 100)}% under 155 bpm` },
    { label: "Long runs", score: clamp(longShare * 100 * 2), value: `${Math.round(longShare * 100)}% of km from 20K+` },
  ];

  return {
    source: data.source || "Watch",
    generatedAt: asOf,
    runs,
    first,
    last,
    latest: runs[runs.length - 1],
    recent: runs.slice(-8).reverse(),
    totals: {
      km: totalKm,
      runs: runs.length,
      hours: totalSec / 3600,
      seconds: totalSec,
      calories: sum(runs, (r) => r.calories),
      runDays: daily.size,
      spanDays,
      longestStreak,
      ultras: runs.filter((r) => r.km >= ULTRA_KM).length,
      avgHr: sum(runs, (r) => r.hr * r.seconds) / totalSec,
      avgPace: totalSec / totalKm,
      last30Km: sum(runs.filter((r) => r.date > addDays(asOf, -30)), (r) => r.km),
    },
    longest,
    days,
    milestones,
    nextMilestone,
    weeks,
    weekly: { avg: mean(weekKm), trend: earlyAvg ? (lateAvg - earlyAvg) / earlyAvg : 0 },
    months,
    weekdays,
    mix,
    hrBands,
    heatmap: { weeks: heatWeeks, cells: heatCells, months: heatMonths },
    bests,
    longRuns,
    efforts,
    dna,
    maxRunningPace: MAX_RUNNING_PACE,
  };
}

/* Analytics for a single run, relative to every other run in the log */
export function runAnalytics(run, runs) {
  const n = runs.length;
  const share = (pick, better) => runs.filter((r) => r !== run && better(pick(r), pick(run))).length / Math.max(n - 1, 1);
  const rank = (pick) => runs.filter((r) => pick(r) > pick(run)).length + 1;

  const meanHr = mean(runs.filter((r) => r.hr).map((r) => r.hr)) || 1;
  const loadOf = (r) => (r.seconds / 60) * (r.hr ? r.hr / meanHr : 1);
  const avg = {
    km: mean(runs.map((r) => r.km)),
    seconds: mean(runs.map((r) => r.seconds)),
    pace: sum(runs, (r) => r.seconds) / sum(runs, (r) => r.km),
    hr: meanHr,
    calories: mean(runs.map((r) => r.calories)),
    load: mean(runs.map(loadOf)),
  };

  const start = weekStart(run.date);
  const week = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, i);
    const dayRuns = runs.filter((r) => dayKey(r.date) === dayKey(date));
    return { date, label: WEEKDAYS[i], km: sum(dayRuns, (r) => r.km), isRunDay: dayKey(date) === dayKey(run.date) };
  });

  const predictions =
    run.km >= 3 && !run.indoor
      ? PREDICTION_TARGETS.map((t) => ({ ...t, seconds: run.seconds * Math.pow(t.km / run.km, 1.06) }))
      : [];

  const similar = runs
    .filter((r) => r !== run)
    .sort((a, b) => Math.abs(a.km - run.km) - Math.abs(b.km - run.km) || b.date - a.date)
    .slice(0, 3);

  const sameDay = runs.filter((r) => r !== run && dayKey(r.date) === dayKey(run.date));

  return {
    speed: run.km / (run.seconds / 3600),
    kcalPerHour: run.calories / (run.seconds / 3600),
    kcalPerKm: run.calories / run.km,
    load: loadOf(run),
    band: hrBandOf(run.hr),
    tier: tierOf(run.km),
    ranks: {
      distance: rank((r) => r.km),
      duration: rank((r) => r.seconds),
      calories: rank((r) => r.calories),
      load: rank(loadOf),
      total: n,
    },
    percentiles: {
      distance: share((r) => r.km, (other, mine) => other < mine),
      pace: share((r) => r.pace, (other, mine) => other > mine),
      hr: share((r) => r.hr, (other, mine) => other < mine),
      load: share(loadOf, (other, mine) => other < mine),
    },
    avg,
    compare: [
      { key: "distance", label: "Distance", icon: "distance", diff: run.km / avg.km - 1, value: `${fmt.km(run.km, 2)} km`, base: `${fmt.km(avg.km)} km avg` },
      { key: "duration", label: "Duration", icon: "time", diff: run.seconds / avg.seconds - 1, value: fmt.duration(run.seconds), base: `${fmt.duration(avg.seconds)} avg` },
      { key: "pace", label: "Pace", icon: "pace", diff: avg.pace / run.pace - 1, value: `${fmt.pace(run.pace)}/km`, base: `${fmt.pace(avg.pace)}/km avg`, note: "positive = faster" },
      { key: "hr", label: "Heart rate", icon: "heart", diff: run.hr / avg.hr - 1, value: `${run.hr} bpm`, base: `${Math.round(avg.hr)} bpm avg` },
      { key: "calories", label: "Calories", icon: "flame", diff: run.calories / avg.calories - 1, value: `${run.calories.toLocaleString("en")} kcal`, base: `${Math.round(avg.calories)} kcal avg` },
    ],
    week,
    weekTotal: sum(week, (d) => d.km),
    predictions,
    similar,
    sameDay,
    prev: runs[run.index - 1] || null,
    next: runs[run.index + 1] || null,
    paceHistogram: histogram(runs.filter((r) => r.pace <= MAX_RUNNING_PACE).map((r) => r.pace), 30),
  };
}

function histogram(values, step) {
  if (!values.length) return { bins: [], step };
  const lo = Math.floor(Math.min(...values) / step) * step;
  const hi = Math.ceil(Math.max(...values) / step) * step;
  const bins = [];
  for (let from = lo; from < hi; from += step) {
    bins.push({ from, to: from + step, count: values.filter((v) => v >= from && v < from + step).length });
  }
  return { bins, step };
}
