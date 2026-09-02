// Champion/challenger shadow scoreboard (todo P1b). Reads a Raw Signal SQLite file
// (local dev D1, or a production backup/export) and compares the champion's daily
// top-100 board snapshots (signal_history) against the challenger's
// (shadow_signal_history) on forward returns — same days, same ranking rule, so any
// difference is attributable to the model. Promotion needs ~30+ days of overlap plus
// the walk-forward harness verdict (docs/backtests.md).
//
//   node scripts/backtest/shadow-scoreboard.mjs --db <path> [--horizon 30]

import { DatabaseSync } from "node:sqlite";
import { dayNum, forwardReturn, median } from "./lib.mjs";

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg.startsWith("--")) { const next = process.argv[i + 1]; if (next && !next.startsWith("--")) { args[arg.slice(2)] = next; i++; } else args[arg.slice(2)] = "1"; }
}
const DB_PATH = args.db ?? ".wrangler/state/v3/d1/miniflare-D1DatabaseObject/faaf2b0445ab934c3aac48ddf0cdfade8f9bac050be98993748742cdd2cb05fb.sqlite";
const HORIZON = Number(args.horizon ?? 30);

const db = new DatabaseSync(DB_PATH, { readOnly: true });
const tables = new Set(db.prepare("select name from sqlite_master where type='table'").all().map(row => row.name));
if (!tables.has("shadow_signal_history")) { console.error("shadow_signal_history missing — migration 0010 not applied to this database."); process.exit(1); }

// Largest series per product (mirrors the walk-forward loader).
const series = new Map();
{
  const rows = db.prepare(`select product_id id, variant, condition, observed_date date, market_cents cents
    from price_observations order by product_id, variant, condition, observed_date`).iterate();
  let cur = null, curKey = "";
  const commit = () => { if (!cur) return; const prev = series.get(cur.id); if (!prev || cur.days.length > prev.days.length) series.set(cur.id, cur); };
  for (const row of rows) {
    const key = `${row.id}|${row.variant}|${row.condition}`;
    if (key !== curKey) { commit(); cur = { id: row.id, days: [], prices: [] }; curKey = key; }
    if (row.cents > 0) { cur.days.push(dayNum(row.date)); cur.prices.push(row.cents / 100); }
  }
  commit();
}

const readBoard = table => db.prepare(`select observed_date date, side, product_id id, score, price_cents cents, rank from ${table}`).all();
const describe = rows => {
  const bySide = { buy: [], sell: [] };
  for (const row of rows) {
    const s = series.get(row.id);
    if (!s) continue;
    // The snapshot stores that day's price — judge forward returns from it directly.
    const fwd = forwardReturn(s.days, s.prices, dayNum(row.date), HORIZON, row.cents / 100);
    if (Number.isFinite(fwd)) bySide[row.side].push(fwd);
  }
  const stat = list => list.length ? { n: list.length, medianFwd: `${(median(list) * 100).toFixed(2)}%`, hit: null } : { n: 0, medianFwd: "n/a", hit: "n/a" };
  const buy = stat(bySide.buy), sell = stat(bySide.sell);
  if (bySide.buy.length) buy.hit = `${(bySide.buy.filter(x => x > 0).length / bySide.buy.length * 100).toFixed(1)}%`;
  if (bySide.sell.length) sell.hit = `${(bySide.sell.filter(x => x < 0).length / bySide.sell.length * 100).toFixed(1)}%`;
  return { buy, sell };
};

const champion = readBoard("signal_history");
const challenger = readBoard("shadow_signal_history");
const days = [...new Set(champion.map(row => row.date))].sort();
const shadowDays = [...new Set(challenger.map(row => row.date))].sort();
const overlapDays = shadowDays.filter(day => days.includes(day));

// Exclusive picks: same-day board membership differences per side.
const key = row => `${row.date}|${row.side}|${row.id}`;
const championKeys = new Set(champion.map(key)), challengerKeys = new Set(challenger.map(key));
const championOnly = champion.filter(row => overlapDays.includes(row.date) && !challengerKeys.has(key(row)));
const challengerOnly = challenger.filter(row => overlapDays.includes(row.date) && !championKeys.has(key(row)));

const report = {
  db: DB_PATH,
  horizonDays: HORIZON,
  championDays: days.length ? `${days.length} (${days[0]} → ${days.at(-1)})` : "none",
  challengerDays: shadowDays.length ? `${shadowDays.length} (${shadowDays[0]} → ${shadowDays.at(-1)})` : "none",
  overlapDays: overlapDays.length,
  readiness: overlapDays.length >= 30 ? "30+ overlapping days — comparison meaningful" : `accruing (${overlapDays.length}/30 overlapping days)`,
  champion: describe(champion),
  challenger: describe(challenger),
  championExclusive: describe(championOnly),
  challengerExclusive: describe(challengerOnly),
};
console.log(JSON.stringify(report, null, 1));
db.close();
