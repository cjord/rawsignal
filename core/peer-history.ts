// Pure set/rarity peer-average accumulation for the fair-value anchor.
// One observation per cohort per TCGCSV publish date; IO stays in build-peer-context.mjs.

export type PeerRow = { date: string; average: number; count: number };
export type PeerHistory = Record<string, PeerRow[]>;
export type PeerDailies = Record<string, { average: number; count: number }>;
export type PeerSummaryEntry = { current: number; cardCount: number; avg30: number | null; avg90: number | null; observations: number };

export const COHORT_HISTORY_CAP = 120;
export const COHORT_RETENTION_DAYS = 180;

export const cohortKey = (card: { game: string; set: string; rarity: string }) => `${card.game}|${card.set}|${card.rarity}`;

const dayMs = 86_400_000;
const parseDay = (date: string) => Date.parse(`${date}T00:00:00Z`);

// Mean market price and contributing-card count per game|set|rarity cohort.
export function dailyPeerAverages(cards: { game: string; set: string; rarity: string; marketPrice: number | null }[]): PeerDailies {
  const sums = new Map<string, { total: number; count: number }>();
  for (const card of cards) {
    if (!Number.isFinite(card.marketPrice) || (card.marketPrice as number) <= 0) continue;
    const key = cohortKey(card);
    const entry = sums.get(key) ?? { total: 0, count: 0 };
    entry.total += card.marketPrice as number;
    entry.count += 1;
    sums.set(key, entry);
  }
  const averages: PeerDailies = {};
  for (const [key, { total, count }] of sums) averages[key] = { average: total / count, count };
  return averages;
}

// Appends one dated observation per cohort, replacing a same-date row so reruns stay
// idempotent, capping rows per cohort, and dropping cohorts stale past the retention window.
export function appendPeerHistory(history: PeerHistory | null | undefined, date: string, dailies: PeerDailies): PeerHistory {
  const next: PeerHistory = {};
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

const windowMean = (rows: PeerRow[], latestDay: number, days: number) => {
  const inWindow = rows.filter(row => latestDay - parseDay(row.date) <= days * dayMs);
  return inWindow.length ? inWindow.reduce((sum, row) => sum + row.average, 0) / inWindow.length : null;
};

// Compact per-cohort summary shipped as public/data/peer-context.json entries.
export function summarizePeerHistory(history: PeerHistory | null | undefined): Record<string, PeerSummaryEntry> {
  const entries: Record<string, PeerSummaryEntry> = {};
  for (const [key, rows] of Object.entries(history ?? {})) {
    if (!Array.isArray(rows) || !rows.length) continue;
    const latest = rows.at(-1)!, latestDay = parseDay(latest.date);
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
