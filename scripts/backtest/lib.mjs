// Pure helpers for the walk-forward harness (todo P1). No I/O here — everything is
// unit-tested in tests/backtest-lib.test.mjs.

const DAY_MS = 86_400_000;

export const dayNum = iso => Math.floor(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);

const isoCache = new Map();
export function isoOf(day) {
  let iso = isoCache.get(day);
  if (!iso) { iso = new Date(day * DAY_MS).toISOString().slice(0, 10); isoCache.set(day, iso); }
  return iso;
}

// Greatest index with days[i] <= day, or -1. days is ascending.
export function asofIndex(days, day) {
  let lo = 0, hi = days.length - 1, ans = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (days[mid] <= day) { ans = mid; lo = mid + 1; } else hi = mid - 1; }
  return ans;
}

// Least index with days[i] >= day, or -1.
export function firstAtOrAfter(days, day) {
  let lo = 0, hi = days.length - 1, ans = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (days[mid] >= day) { ans = mid; hi = mid - 1; } else lo = mid + 1; }
  return ans;
}

// Price as of `day`: last observation within `staleDays` back. NaN when none.
export function priceAsOf(days, prices, day, staleDays = 7) {
  const i = asofIndex(days, day);
  return i >= 0 && day - days[i] <= staleDays ? prices[i] : NaN;
}

// Forward return: first observation at/after day+horizon (within `tolerance` late).
export function forwardReturn(days, prices, day, horizon, p0, tolerance = 7) {
  if (!Number.isFinite(p0) || p0 <= 0) return NaN;
  const i = firstAtOrAfter(days, day + horizon);
  if (i < 0 || days[i] > day + horizon + tolerance) return NaN;
  return prices[i] / p0 - 1;
}

// Worst (buy) / best (sell) excursion over (day, day+window]: min/max price vs p0.
export function excursion(days, prices, day, window, p0, kind) {
  if (!Number.isFinite(p0) || p0 <= 0) return NaN;
  const from = firstAtOrAfter(days, day + 1);
  if (from < 0) return NaN;
  let extreme = NaN;
  for (let i = from; i < days.length && days[i] <= day + window; i++) {
    const p = prices[i];
    if (!Number.isFinite(extreme)) extreme = p;
    else extreme = kind === "min" ? Math.min(extreme, p) : Math.max(extreme, p);
  }
  return Number.isFinite(extreme) ? extreme / p0 - 1 : NaN;
}

// Raw % distance from the window extreme on each side (mirrors the production
// evaluator's distance definition). Window = observations in (day-windowDays, day].
export function extremeDistances(days, prices, day, windowDays, current) {
  let min = Infinity, max = -Infinity, n = 0;
  const from = firstAtOrAfter(days, day - windowDays + 1);
  if (from >= 0) for (let i = from; i < days.length && days[i] <= day; i++) {
    const p = prices[i];
    if (p > 0) { n++; if (p < min) min = p; if (p > max) max = p; }
  }
  if (n < 2 || !Number.isFinite(current) || current <= 0) return { buy: NaN, sell: NaN };
  return { buy: Math.max(0, (current / min - 1) * 100), sell: Math.max(0, (1 - current / max) * 100) };
}

export function median(values) {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return NaN;
  const mid = v.length >> 1;
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

export function quantileSorted(sorted, q) {
  if (!sorted.length) return NaN;
  const i = (sorted.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

// Cohort key: singles group by game|set|rarity, sealed by game|set|productType.
export const cohortKeyOf = row =>
  `${row.kind}|${row.game}|${row.setName}|${row.kind === "single" ? (row.rarity ?? "?") : (row.productType ?? "?")}`;

// Deterministic PRNG for the random baseline.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
