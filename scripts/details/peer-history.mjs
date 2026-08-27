// Pure set/rarity peer-average accumulation for the fair-value anchor.
// One observation per cohort per TCGCSV publish date; IO stays in build-peer-context.mjs.

export const COHORT_HISTORY_CAP = 120;
export const COHORT_RETENTION_DAYS = 180;

export const cohortKey = card => `${card.game}|${card.set}|${card.rarity}`;

const dayMs = 86_400_000;
const parseDay = date => Date.parse(`${date}T00:00:00Z`);

// Mean market price and contributing-card count per game|set|rarity cohort.
export function dailyPeerAverages(cards) {
  const sums = new Map();
  for (const card of cards) {
    if (!Number.isFinite(card.marketPrice) || card.marketPrice <= 0) continue;
    const key = cohortKey(card);
    const entry = sums.get(key) ?? { total: 0, count: 0 };
    entry.total += card.marketPrice;
    entry.count += 1;
    sums.set(key, entry);
  }
  const averages = {};
  for (const [key, { total, count }] of sums) averages[key] = { average: total / count, count };
  return averages;
}

// Appends one dated observation per cohort, replacing a same-date row so reruns stay
// idempotent, capping rows per cohort, and dropping cohorts stale past the retention window.
export function appendPeerHistory(history, date, dailies) {
  const next = {};
  const keys = new Set([...Object.keys(history ?? {}), ...Object.keys(dailies)]);
  for (const key of [...keys].sort()) {
    const previous = Array.isArray(history?.[key]) ? history[key].filter(row => row.date !== date) : [];
    const rows = dailies[key]
      ? [...previous, { date, average: dailies[key].average, count: dailies[key].count }]
      : previous;
    rows.sort((a, b) => a.date.localeCompare(b.date));
    const latest = rows.at(-1);
    if (!latest || parseDay(date) - parseDay(latest.date) > COHORT_RETENTION_DAYS * dayMs) continue;
    next[key] = rows.slice(-COHORT_HISTORY_CAP);
  }
  return next;
}

const windowMean = (rows, latestDay, days) => {
  const inWindow = rows.filter(row => latestDay - parseDay(row.date) <= days * dayMs);
  return inWindow.length ? inWindow.reduce((sum, row) => sum + row.average, 0) / inWindow.length : null;
};

// Compact per-cohort summary shipped as public/data/peer-context.json entries.
export function summarizePeerHistory(history) {
  const entries = {};
  for (const [key, rows] of Object.entries(history ?? {})) {
    if (!Array.isArray(rows) || !rows.length) continue;
    const latest = rows.at(-1), latestDay = parseDay(latest.date);
    entries[key] = {
      current: latest.average,
      cardCount: latest.count,
      avg30: windowMean(rows, latestDay, 30),
      avg90: windowMean(rows, latestDay, 90),
      observations: rows.filter(row => latestDay - parseDay(row.date) <= 90 * dayMs).length,
    };
  }
  return entries;
}
