// P7 release study (docs/model-gaps.md): mines the local max-profile database for
// every set that LAUNCHED inside the archive window and produces
//   (1) era-conditioned release curves — median price path (relative to the launch-week
//       reference) at days 14/30/60/90, per game × rarity class, grouped by release
//       half-year; sealed additionally relative to MSRP;
//   (2) marquee-chase premiums — each set's #1 chase vs its in-set rarity cohort at
//       day 60 (the display band for cards like Mega Rayquaza ex);
//   (3) the EVE validation gate — does the era-sibling cohort-median anchor, computed
//       at release day, predict the day-60 price better than the launch price itself?
//       Reported overall and for the named holdouts (ME04 Chaos Rising, ME05 Pitch
//       Black) that must pass before EVE serves (user decision 2026-09-02).
//   node scripts/release-curves/study.mjs [--db .wrangler/local-profiles/max.sqlite]

import { DatabaseSync } from "node:sqlite";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { dayNum, isoOf, priceAsOf, median } from "../backtest/lib.mjs";
import { setGroupKey } from "../../core/domain/eras.ts";

const arg = (name, fallback) => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : fallback; };
const DB_PATH = arg("db", ".wrangler/local-profiles/max.sqlite");
const OUT_DIR = path.resolve("backups/backtests/release-curves");
mkdirSync(OUT_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH, { readOnly: true });
const catalog = new Map(db.prepare("select product_id id, kind, game, set_name setName, rarity, product_type productType, release_year releaseYear from catalog_products").all().map(row => [row.id, row]));
const msrp = new Map(db.prepare("select product_id id, msrp_cents cents from sealed_details where msrp_cents is not null").all().map(row => [row.id, row.cents / 100]));

// Largest series per product.
const series = new Map();
{
  const rows = db.prepare("select product_id id, variant, condition, observed_date date, market_cents cents from price_observations order by product_id, variant, condition, observed_date").iterate();
  let cur = null, curKey = "";
  const commit = () => { if (!cur) return; const prev = series.get(cur.id); if (!prev || cur.days.length > prev.days.length) series.set(cur.id, cur); };
  for (const row of rows) {
    const key = `${row.id}|${row.variant}|${row.condition}`;
    if (key !== curKey) { commit(); cur = { id: row.id, days: [], prices: [] }; curKey = key; }
    if (row.cents > 0) { cur.days.push(dayNum(row.date)); cur.prices.push(row.cents / 100); }
  }
  commit();
}
const maxDay = Math.max(...[...series.values()].map(s => s.days.at(-1)));

// Set launch day from SINGLES ONLY — sealed products carry presale prices up to ~2
// months before street date and drag any pooled estimate months early (ME04 traced to
// March for a May release). Singles cluster tightly at street date; the median of
// their first-observation days is the robust launch estimate.
const firstBySet = new Map();
for (const [id, s] of series) {
  const meta = catalog.get(id);
  if (!meta || meta.kind !== "single") continue;
  const key = `${meta.game}|${meta.setName}`;
  (firstBySet.get(key) ?? firstBySet.set(key, []).get(key)).push(s.days[0]);
}
const ARCHIVE_START = dayNum("2024-02-08");
const launches = new Map(); // game|set -> release day
for (const [key, firsts] of firstBySet) {
  if (firsts.length < 8) continue;
  firsts.sort((a, b) => a - b);
  const release = firsts[Math.floor(firsts.length * 0.5)];
  // Day-60 sets get the full study; younger launches (>=30d old) still join the
  // day-30 EVE validation (ME05 Pitch Black is in this class until mid-September).
  if (release >= ARCHIVE_START + 14 && release <= maxDay - 30) launches.set(key, release);
}
console.log(`launched-in-window sets: ${launches.size}`);

const half = day => { const iso = isoOf(day); return `${iso.slice(0, 4)}H${Number(iso.slice(5, 7)) <= 6 ? 1 : 2}`; };
// Reference = the product's OWN first observed week (presale listings start early and
// street-date cards start late; a fixed set-level window drops most of a set).
const refPriceOf = (s, release) => {
  // Sealed presales list up to ~75 days early; singles cluster at street date.
  const first = s.days.find(day => day >= release - 75);
  if (first == null || first > release + 21) return null;
  const window = [];
  for (let i = 0; i < s.days.length; i++) if (s.days[i] >= first && s.days[i] <= first + 7) window.push(s.prices[i]);
  return window.length ? median(window) : null;
};

// ---- (1) release curves ---------------------------------------------------------
const OFFSETS = [14, 30, 60, 90];
const cells = new Map(); // game|kindClass|half -> {offset -> ratios[]} (+ msrpRatios for sealed)
const perProduct = new Map(); // id -> {release, ref, p60}
for (const [id, s] of series) {
  const meta = catalog.get(id);
  if (!meta) continue;
  const release = launches.get(`${meta.game}|${meta.setName}`);
  if (!release) continue;
  const ref = refPriceOf(s, release);
  if (!ref || ref <= 0) continue;
  const p60 = priceAsOf(s.days, s.prices, release + 60), p30 = priceAsOf(s.days, s.prices, release + 30);
  perProduct.set(id, { release, ref, p60: Number.isFinite(p60) && release + 60 <= maxDay ? p60 : null, p30: Number.isFinite(p30) && release + 30 <= maxDay ? p30 : null });
  const kindClass = meta.kind === "single" ? (meta.rarity ?? "?") : (meta.productType ?? "Sealed");
  const cellKey = `${meta.game}|${meta.kind}|${kindClass}|${half(release)}`;
  const cell = cells.get(cellKey) ?? cells.set(cellKey, { n: 0, offsets: new Map(), vsMsrp: new Map() }).get(cellKey);
  cell.n++;
  for (const offset of OFFSETS) {
    const price = priceAsOf(s.days, s.prices, release + offset);
    if (!Number.isFinite(price)) continue;
    (cell.offsets.get(offset) ?? cell.offsets.set(offset, []).get(offset)).push(price / ref);
    const productMsrp = msrp.get(id);
    if (productMsrp) (cell.vsMsrp.get(offset) ?? cell.vsMsrp.set(offset, []).get(offset)).push(price / productMsrp);
  }
}
const curves = [];
for (const [key, cell] of cells) {
  if (cell.n < 5) continue;
  const [game, kind, kindClass, halfKey] = key.split("|");
  const row = { game, kind, class: kindClass, half: halfKey, n: cell.n };
  for (const offset of OFFSETS) {
    const ratios = cell.offsets.get(offset) ?? [];
    row[`d${offset}`] = ratios.length >= 5 ? Number((median(ratios)).toFixed(3)) : null;
    if (kind === "sealed") { const m = cell.vsMsrp.get(offset) ?? []; if (m.length >= 5) row[`d${offset}vsMsrp`] = Number((median(m)).toFixed(3)); }
  }
  curves.push(row);
}
curves.sort((a, b) => a.game.localeCompare(b.game) || a.kind.localeCompare(b.kind) || a.class.localeCompare(b.class) || a.half.localeCompare(b.half));

// ---- (2) marquee-chase premium --------------------------------------------------
const marquee = [];
for (const [setKey, release] of launches) {
  const [game, setName] = setKey.split("|");
  const singles = [...perProduct.entries()].filter(([id]) => { const m = catalog.get(id); return m.kind === "single" && m.game === game && m.setName === setName; });
  if (singles.length < 10) continue;
  const chase = singles.sort((a, b) => b[1].ref - a[1].ref)[0];
  const chaseMeta = catalog.get(chase[0]);
  if (!chase[1].p60) continue;
  const cohort60 = singles.filter(([id, r]) => catalog.get(id).rarity === chaseMeta.rarity && r.p60 && id !== chase[0]).map(([, r]) => r.p60);
  const anchor = cohort60.length >= 4 ? median(cohort60) : median(singles.filter(([, r]) => r.p60).map(([, r]) => r.p60));
  marquee.push({ game, set: setName, half: half(release), chase: chaseMeta.rarity, refPrice: Number(chase[1].ref.toFixed(2)), premium60: Number((chase[1].p60 / anchor).toFixed(2)) });
}
marquee.sort((a, b) => a.half.localeCompare(b.half));

// ---- (3) EVE validation ---------------------------------------------------------
// Anchor = median release-day price of same-game, same-era-group, same-rarity singles
// from sets launched (or pre-archive) at least 60 days earlier.
const HOLDOUTS = new Set(["ME04: Chaos Rising", "ME05: Pitch Black"]);
const eveRows = [];
for (const [setKey, release] of launches) {
  const [game, setName] = setKey.split("|");
  const era = setGroupKey(game, setName, Number(isoOf(release).slice(0, 4)));
  // Sibling pool: singles whose set is a different set, same game+era, with data 60d+ old.
  const pool = new Map(); // rarity -> prices at release day
  for (const [id, s] of series) {
    const meta = catalog.get(id);
    if (!meta || meta.kind !== "single" || meta.game !== game || meta.setName === setName) continue;
    if (setGroupKey(game, meta.setName, meta.releaseYear) !== era) continue;
    if (s.days[0] > release - 60) continue;
    const price = priceAsOf(s.days, s.prices, release);
    if (Number.isFinite(price) && price > 0) (pool.get(meta.rarity ?? "?") ?? pool.set(meta.rarity ?? "?", []).get(meta.rarity ?? "?")).push(price);
  }
  for (const horizon of ["p60", "p30"]) {
    const eveErrors = [], naiveErrors = [];
    for (const [id, record] of perProduct) {
      const meta = catalog.get(id);
      if (meta.kind !== "single" || meta.game !== game || meta.setName !== setName || !record[horizon]) continue;
      const anchorPool = pool.get(meta.rarity ?? "?");
      if (!anchorPool || anchorPool.length < 8) continue;
      eveErrors.push(Math.abs(Math.log(median(anchorPool) / record[horizon])));
      naiveErrors.push(Math.abs(Math.log(record.ref / record[horizon])));
    }
    if (eveErrors.length < 8) continue;
    const wins = eveErrors.filter((error, i) => error < naiveErrors[i]).length;
    eveRows.push({ game, set: setName, horizon: horizon === "p60" ? 60 : 30, holdout: HOLDOUTS.has(setName), n: eveErrors.length, eveMedAbsLogErr: Number(median(eveErrors).toFixed(3)), naiveMedAbsLogErr: Number(median(naiveErrors).toFixed(3)), eveWinRate: Number((wins / eveErrors.length).toFixed(2)) });
  }
}
eveRows.sort((a, b) => Number(b.holdout) - Number(a.holdout) || a.set.localeCompare(b.set));

const report = { generated: new Date().toISOString().slice(0, 10), db: DB_PATH, launchedSets: launches.size, curves, marquee, eve: eveRows };
writeFileSync(path.join(OUT_DIR, "study.json"), JSON.stringify(report, null, 1));
console.log("\n== marquee-chase premium (day-60 chase vs in-set cohort) ==");
for (const row of marquee) console.log(`  ${row.half} ${row.game} ${row.set} — ${row.chase} ref $${row.refPrice} → ${row.premium60}× cohort`);
console.log("\n== EVE validation (era-sibling anchor vs naive launch price) ==");
for (const row of eveRows) console.log(`  ${row.holdout ? "HOLDOUT " : ""}${row.game} ${row.set} d${row.horizon}: n=${row.n} eveErr ${row.eveMedAbsLogErr} vs naive ${row.naiveMedAbsLogErr} · EVE wins ${(row.eveWinRate * 100).toFixed(0)}%`);
console.log(`\ncurves: ${curves.length} cells → ${path.join(OUT_DIR, "study.json")}`);
db.close();
