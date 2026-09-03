// P7 follow-up (user 2026-09-03): the Early Value Estimate must ADJUST as launch
// prices are discovered, instead of serving one static cohort anchor for the whole
// young window. This study measures, at card ages 7/14/21/30/45 days post-release,
// which predictor of the settled price (day-60; day-30 for sets too young) wins:
//   eve      — static era-sibling cohort median, computed at release (current behavior)
//   now      — the card's own price at that age, unadjusted
//   proj     — the card's own price projected down the REMAINING decay path measured
//              from mature era siblings (median sibling ratio at 60 / ratio at age a)
//   blend(w) — exp((1-w)·ln(eve) + w·ln(proj)) over a weight grid, to locate the
//              empirical crossover that the serving ramp should follow
// Anchors, curves, and ratios for a set come only from sibling sets released >=60
// days earlier — the same no-leakage rule as study.mjs, mirroring production where
// the curve is regenerated from mature sets.
//   node scripts/release-curves/dynamic.mjs [--db .wrangler/local-profiles/max.sqlite]

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
// Cohort rung: rarity for singles, product type for sealed (user 2026-09-03: sealed
// gets the same treatment) — never mixed across kinds.
const rungOf = meta => `${meta.kind}|${meta.kind === "single" ? meta.rarity ?? "?" : meta.productType ?? "?"}`;

const series = new Map();
{
  const rows = db.prepare("select product_id id, variant, condition, observed_date date, market_cents cents from price_observations order by product_id, variant, condition, observed_date").iterate();
  let cur = null, curKey = "";
  const commit = () => { if (!cur) return; const prev = series.get(cur.id); if (!prev || cur.days.length > prev.days.length) series.set(cur.id, cur); };
  for (const row of rows) {
    if (!catalog.has(row.id)) continue;
    const key = `${row.id}|${row.variant}|${row.condition}`;
    if (key !== curKey) { commit(); cur = { id: row.id, days: [], prices: [] }; curKey = key; }
    if (row.cents > 0) { cur.days.push(dayNum(row.date)); cur.prices.push(row.cents / 100); }
  }
  commit();
}
const maxDay = Math.max(...[...series.values()].map(s => s.days.at(-1)));

// Launch days from singles-only first-observation medians (same rule as study.mjs).
const firstBySet = new Map();
for (const [id, s] of series) {
  const meta = catalog.get(id);
  if (meta.kind !== "single") continue;
  const key = `${meta.game}|${meta.setName}`;
  (firstBySet.get(key) ?? firstBySet.set(key, []).get(key)).push(s.days[0]);
}
const ARCHIVE_START = dayNum("2024-02-08");
const launches = new Map();
for (const [key, firsts] of firstBySet) {
  if (firsts.length < 8) continue;
  firsts.sort((a, b) => a - b);
  const release = firsts[Math.floor(firsts.length * 0.5)];
  if (release >= ARCHIVE_START + 14 && release <= maxDay - 30) launches.set(key, release);
}

const refPriceOf = (s, release) => {
  const first = s.days.find(day => day >= release - 75);
  if (first == null || first > release + 21) return null;
  const window = [];
  for (let i = 0; i < s.days.length; i++) if (s.days[i] >= first && s.days[i] <= first + 7) window.push(s.prices[i]);
  return window.length ? median(window) : null;
};

const AGES = [7, 14, 21, 30, 45];
const WEIGHTS = [0, 0.25, 0.5, 0.75, 1];
const HOLDOUTS = new Set(["ME04: Chaos Rising", "ME05: Pitch Black"]);
const medAbs = errors => Number(median(errors.map(Math.abs)).toFixed(3));

// rows[age] -> per-card {eveErr, nowErr, projErr, blendErr per weight, holdout}
const byAge = new Map(AGES.map(age => [age, []]));

for (const [setKey, release] of launches) {
  const [game, setName] = setKey.split("|");
  const era = setGroupKey(game, setName, Number(isoOf(release).slice(0, 4)));
  const horizon = release + 60 <= maxDay ? 60 : 30;

  // Mature era siblings: anchor pool (price at this set's release) and decay ratios
  // (their own release-relative path) per rung (rarity / sealed product type).
  const anchorPool = new Map(); // rung -> prices at release
  const ratioPool = new Map();  // rung -> {age -> ratios[]} including horizon
  for (const [id, s] of series) {
    const meta = catalog.get(id);
    if (meta.game !== game || meta.setName === setName) continue;
    if (setGroupKey(game, meta.setName, meta.releaseYear) !== era) continue;
    const sibRelease = launches.get(`${game}|${meta.setName}`);
    if (s.days[0] > release - 60) continue;
    const rung = rungOf(meta);
    const atRelease = priceAsOf(s.days, s.prices, release);
    if (Number.isFinite(atRelease) && atRelease > 0) (anchorPool.get(rung) ?? anchorPool.set(rung, []).get(rung)).push(atRelease);
    if (!sibRelease || sibRelease + horizon > release) continue; // path must be fully observable before this launch
    const ref = refPriceOf(s, sibRelease);
    if (!ref || ref <= 0) continue;
    const bucket = ratioPool.get(rung) ?? ratioPool.set(rung, new Map()).get(rung);
    for (const age of [...AGES, horizon]) {
      const price = priceAsOf(s.days, s.prices, sibRelease + age);
      if (Number.isFinite(price) && price > 0) (bucket.get(age) ?? bucket.set(age, []).get(age)).push(price / ref);
    }
  }

  for (const [id, s] of series) {
    const meta = catalog.get(id);
    if (meta.game !== game || meta.setName !== setName) continue;
    const settle = priceAsOf(s.days, s.prices, release + horizon);
    if (!Number.isFinite(settle) || settle <= 0 || release + horizon > maxDay) continue;
    const rung = rungOf(meta);
    const anchors = anchorPool.get(rung);
    const ratios = ratioPool.get(rung);
    if (!anchors || anchors.length < (meta.kind === "single" ? 8 : 4) || !ratios) continue;
    const rHorizon = ratios.get(horizon);
    if (!rHorizon || rHorizon.length < 5) continue;
    const eve = median(anchors);
    for (const age of AGES) {
      if (age >= horizon || release + age > maxDay) continue;
      const now = priceAsOf(s.days, s.prices, release + age);
      if (!Number.isFinite(now) || now <= 0) continue;
      const rAge = ratios.get(age);
      if (!rAge || rAge.length < 5) continue;
      const proj = now * (median(rHorizon) / median(rAge));
      const row = { kind: meta.kind, holdout: HOLDOUTS.has(setName), eveErr: Math.log(eve / settle), nowErr: Math.log(now / settle), projErr: Math.log(proj / settle), blend: {} };
      for (const w of WEIGHTS) row.blend[w] = (1 - w) * Math.log(eve / settle) + w * Math.log(proj / settle);
      byAge.get(age).push(row);
    }
  }
}

const report = { generated: new Date().toISOString().slice(0, 10), db: DB_PATH, ages: [] };
console.log("== dynamic EVE: median |log err| vs settle, by card age (all launched sets / holdouts) ==");
for (const age of AGES) {
  const rows = byAge.get(age);
  if (!rows.length) continue;
  const slice = subset => ({
    n: subset.length,
    eve: medAbs(subset.map(r => r.eveErr)),
    now: medAbs(subset.map(r => r.nowErr)),
    proj: medAbs(subset.map(r => r.projErr)),
    blend: Object.fromEntries(WEIGHTS.map(w => [w, medAbs(subset.map(r => r.blend[w]))])),
  });
  const all = slice(rows), holdout = slice(rows.filter(r => r.holdout)), sealed = slice(rows.filter(r => r.kind === "sealed"));
  report.ages.push({ age, all, holdout, sealed });
  const fmt = s => `n=${s.n} eve ${s.eve} · now ${s.now} · proj ${s.proj} · blend ${WEIGHTS.map(w => `w${w}:${s.blend[w]}`).join(" ")}`;
  console.log(` age ${String(age).padStart(2)}  ALL      ${fmt(all)}`);
  if (sealed.n) console.log(`         SEALED   ${fmt(sealed)}`);
  if (holdout.n) console.log(`         HOLDOUT  ${fmt(holdout)}`);
}
writeFileSync(path.join(OUT_DIR, "dynamic.json"), JSON.stringify(report, null, 1));
console.log(`\n→ ${path.join(OUT_DIR, "dynamic.json")}`);
db.close();
