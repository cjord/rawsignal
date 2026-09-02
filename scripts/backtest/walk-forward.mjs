// Walk-forward signal harness (todo P1). Replays history from the local max-profile
// database: for each origin date, every strategy sees only observations known by that
// date; forward 7/30/90-day returns judge the picks. The production evaluator is
// imported directly so the harness and the live model can never drift apart.
//
//   node scripts/backtest/walk-forward.mjs [--db path] [--every 7] [--start 2024-05-06]
//     [--sample 0] [--run name] [--max-minutes 0] [--report-only] [--top 20]
//
// Resumable: model evaluations append one NDJSON line per product; a rerun skips
// finished products. --report-only rebuilds the report from existing NDJSON.
// Liquidity is NOT applied historically (no archived sales exist) — uniform across
// all strategies, so comparisons stay fair; noted in the report.

import { existsSync, mkdirSync, readFileSync, appendFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { evaluateMarketSignal } from "../../core/signal-utils.ts";
import { classifyRegime } from "../../core/domain/regime.ts";
import { dayNum, isoOf, asofIndex, priceAsOf, forwardReturn, excursion, extremeDistances, median, quantileSorted, cohortKeyOf, cohortFallbackKeyOf, mulberry32, hashStr } from "./lib.mjs";

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg.startsWith("--")) { const key = arg.slice(2); const next = process.argv[i + 1]; if (next && !next.startsWith("--")) { args[key] = next; i++; } else args[key] = "1"; }
}
const DB_PATH = args.db ?? ".wrangler/local-profiles/max.sqlite";
const EVERY = Number(args.every ?? 7);
const START = args.start ?? "2024-05-06";
const SAMPLE = Number(args.sample ?? 0);
const TOP = Number(args.top ?? 20);
const RUN = args.run ?? `wf-every${EVERY}${SAMPLE ? `-s${SAMPLE}` : ""}`;
const MAX_MINUTES = Number(args["max-minutes"] ?? 0);
const REPORT_ONLY = Boolean(args["report-only"]);
const MODEL = args.model ?? "v1"; // evaluator variant (SignalContext.model)
if (MODEL !== "v1" && MODEL !== "v2") { console.error(`unknown --model ${MODEL}`); process.exit(1); }
// --features: instead of evaluating preset models, dump one feature row per
// (product, origin, side) whose robust best-window distance is within FEATURE_CAP —
// the raw material for offline score calibration (docs/backtests.md). Feature rows are
// computed harness-side with lib helpers; the calibrated formula gets re-implemented in
// the evaluator and confirmed by a standard run, so helper drift cannot leak into
// production conclusions.
const FEATURES = Boolean(args.features);
const FEATURE_CAP = 25; // % distance beyond which neither side can ever qualify
const OUT_DIR = path.resolve("backups/backtests", RUN);
const NDJSON = path.join(OUT_DIR, "model-signals.ndjson");
const startedAt = Date.now();
mkdirSync(OUT_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH, { readOnly: true });
const log = message => console.log(`[walk-forward] ${message}`);

// --- catalog + series load -------------------------------------------------------
const catalogRows = db.prepare("select product_id id, kind, game, set_name setName, rarity, product_type productType from catalog_products").all();
const catalog = new Map(catalogRows.map(row => [row.id, row]));

log("loading observations…");
const seriesByProduct = new Map(); // productId -> {days:number[], prices:number[]} (largest series wins)
{
  const rows = db.prepare(`select product_id id, variant, condition, observed_date date, market_cents cents
    from price_observations order by product_id, variant, condition, observed_date`).iterate();
  let cur = null, curKey = "";
  const commit = () => {
    if (!cur) return;
    const prev = seriesByProduct.get(cur.id);
    if (!prev || cur.days.length > prev.days.length) seriesByProduct.set(cur.id, { days: cur.days, prices: cur.prices });
  };
  for (const row of rows) {
    const key = `${row.id}|${row.variant}|${row.condition}`;
    if (key !== curKey) { commit(); cur = { id: row.id, days: [], prices: [] }; curKey = key; }
    if (row.cents > 0) { cur.days.push(dayNum(row.date)); cur.prices.push(row.cents / 100); }
  }
  commit();
}
let products = [...seriesByProduct.keys()].filter(id => catalog.has(id)).sort((a, b) => a - b);
if (SAMPLE > 0 && SAMPLE < products.length) {
  const stride = products.length / SAMPLE;
  products = Array.from({ length: SAMPLE }, (_, i) => products[Math.floor(i * stride)]);
}
log(`${products.length} products with series`);

// --- origin grid -----------------------------------------------------------------
const hiDay = Math.max(...products.map(id => seriesByProduct.get(id).days.at(-1) ?? 0));
const origins = [];
for (let day = dayNum(START); day <= hiDay - 31; day += EVERY) origins.push(day);
log(`${origins.length} origins ${isoOf(origins[0])} → ${isoOf(origins.at(-1))} (every ${EVERY}d)`);

// --- pass A: per-(product, origin) matrices (cheap, always rebuilt) --------------
const nP = products.length, nO = origins.length;
const mat = {};
for (const name of ["p0", "ret30", "fwd7", "fwd30", "fwd90", "mae30", "mfe30", "dBuy30", "dBuy90", "dSell30", "dSell90", "cohortDev"]) mat[name] = new Float32Array(nP * nO).fill(NaN);
const at = (p, o) => p * nO + o;

for (let p = 0; p < nP; p++) {
  const { days, prices } = seriesByProduct.get(products[p]);
  for (let o = 0; o < nO; o++) {
    const day = origins[o];
    const p0 = priceAsOf(days, prices, day);
    if (!Number.isFinite(p0)) continue;
    const i = at(p, o);
    mat.p0[i] = p0;
    const p30 = priceAsOf(days, prices, day - 30);
    if (Number.isFinite(p30) && p30 > 0) mat.ret30[i] = p0 / p30 - 1;
    mat.fwd7[i] = forwardReturn(days, prices, day, 7, p0);
    mat.fwd30[i] = forwardReturn(days, prices, day, 30, p0);
    mat.fwd90[i] = forwardReturn(days, prices, day, 90, p0);
    mat.mae30[i] = excursion(days, prices, day, 30, p0, "min");
    mat.mfe30[i] = excursion(days, prices, day, 30, p0, "max");
    const d30 = extremeDistances(days, prices, day, 30, p0), d90 = extremeDistances(days, prices, day, 90, p0);
    mat.dBuy30[i] = d30.buy; mat.dBuy90[i] = d90.buy; mat.dSell30[i] = d30.sell; mat.dSell90[i] = d90.sell;
  }
  if (p % 2000 === 1999) log(`pass A ${p + 1}/${nP}`);
}

// cohort medians per origin (>=8 members), then per-product deviation from median.
// P4 adds the signal-side cohort stats per origin: median 30-day log return and
// rising-member breadth, with the game|rarity fallback rung when the set cohort is thin.
const COHORT_MIN = 8;
const cohortLog = new Map(), cohortBreadth = new Map(); // key -> Float32Array(nO), NaN = unknown
const statsFor = key => {
  let log_ = cohortLog.get(key);
  if (!log_) { log_ = new Float32Array(nO).fill(NaN); cohortLog.set(key, log_); const b = new Float32Array(nO).fill(NaN); cohortBreadth.set(key, b); }
  return { log: log_, breadth: cohortBreadth.get(key) };
};
for (let o = 0; o < nO; o++) {
  const groups = new Map(), returns = new Map();
  for (let p = 0; p < nP; p++) {
    const i = at(p, o), p0 = mat.p0[i];
    if (!Number.isFinite(p0)) continue;
    const row = catalog.get(products[p]);
    for (const key of [cohortKeyOf(row), cohortFallbackKeyOf(row)]) {
      (groups.get(key) ?? groups.set(key, []).get(key)).push(p0);
      if (Number.isFinite(mat.ret30[i])) (returns.get(key) ?? returns.set(key, []).get(key)).push(mat.ret30[i]);
    }
  }
  const medians = new Map();
  for (const [key, values] of groups) if (values.length >= COHORT_MIN) medians.set(key, median(values));
  for (const [key, values] of returns) if (values.length >= COHORT_MIN) {
    const stats = statsFor(key);
    // median of log returns = log of the median return (log is monotone).
    stats.log[o] = Math.log(1 + median(values));
    stats.breadth[o] = values.filter(value => value > 0).length / values.length * 100;
  }
  for (let p = 0; p < nP; p++) {
    const i = at(p, o), p0 = mat.p0[i];
    if (!Number.isFinite(p0)) continue;
    const center = medians.get(cohortKeyOf(catalog.get(products[p])));
    if (center) mat.cohortDev[i] = p0 / center - 1;
  }
}
// Per-product cohort lookup for the model pass: set rung when it has stats, else fallback.
const cohortAt = (p, o) => {
  const row = catalog.get(products[p]);
  for (const key of [cohortKeyOf(row), cohortFallbackKeyOf(row)]) {
    const log_ = cohortLog.get(key);
    if (log_ && Number.isFinite(log_[o])) return { logReturn30: log_[o], breadth: cohortBreadth.get(key)[o] };
  }
  return null;
};
log("pass A + cohorts done");

// --- model pass (expensive, resumable) -------------------------------------------
const strictnesses = ["conservative", "balanced", "aggressive"];
const done = new Set();
if (existsSync(NDJSON)) for (const line of readFileSync(NDJSON, "utf8").split("\n")) {
  if (!line) continue;
  try { done.add(JSON.parse(line).p); } catch { /* truncated tail from a killed run */ }
}
const exclusions = {};

// One feature row per near-extreme (product, origin, side): the raw distances, moves,
// and context the calibration analysis fits against forward returns.
function featureRow(days, prices, lo, hi, day, p0, side, cohort, i) {
  const w = cut => { const from = firstIdxAtOrAfter(days, day - cut, lo, hi); return prices.slice(from, hi + 1).filter(v => v > 0); };
  const w30 = w(30), w90 = w(90), all = prices.slice(lo, hi + 1).filter(v => v > 0);
  if (all.length < 2) return null;
  const robust = prices_ => { const s = [...prices_].sort((a, b) => a - b); return { lo: quantileSorted(s, .1), hi: quantileSorted(s, .9), med: quantileSorted(s, .5), loA: quantileSorted(s, .05), hiA: quantileSorted(s, .95), loB: quantileSorted(s, .15), hiB: quantileSorted(s, .85) }; };
  const dist = ex => side === 0 ? (p0 / ex - 1) * 100 : (1 - p0 / ex) * 100;
  const cands = [w30, w90, all].filter(x => x.length >= 2).map(robust).map(r => ({ r, d: Math.max(0, dist(side === 0 ? r.lo : r.hi)) }));
  if (!cands.length) return null;
  const best = cands.sort((a, b) => a.d - b.d)[0];
  if (best.d > FEATURE_CAP) return null;
  // Winsor-sweep distances: the same best window measured at 5th/95th (dA) and
  // 15th/85th (dB) percentile extremes.
  const dA = Math.max(0, dist(side === 0 ? best.r.loA : best.r.hiA)), dB = Math.max(0, dist(side === 0 ? best.r.loB : best.r.hiB));
  const swing = side === 0 ? (best.r.hi - p0) / best.r.hi * 100 : (p0 - best.r.lo) / best.r.lo * 100;
  const range = r => r.med ? (r.hi - r.lo) / r.med * 100 : 0;
  const vol = .6 * (w30.length >= 2 ? range(robust(w30)) : 0) + .4 * (w90.length >= 2 ? range(robust(w90)) : 0);
  const conf = w90.length >= 12 && all.length >= 30 ? 2 : w30.length >= 5 ? 1 : 0;
  const pAt = back => priceAsOf(days.slice(lo, hi + 1), prices.slice(lo, hi + 1), day - back);
  const p7 = pAt(7), p30 = pAt(30), p90c = pAt(90);
  const mean30 = w30.length >= 2 ? w30.reduce((a, b) => a + b, 0) / w30.length : NaN;
  const peak90 = w90.length ? Math.max(...w90) : NaN;
  return {
    d: round2(best.d), dA: round2(dA), dB: round2(dB), sw: round2(swing), vol: round2(vol), conf,
    c7: Number.isFinite(p7) && p7 > 0 ? round2((p0 / p7 - 1) * 100) : null,
    c30: Number.isFinite(p30) && p30 > 0 ? round2((p0 / p30 - 1) * 100) : null,
    c90: Number.isFinite(p90c) && p90c > 0 ? round2((p0 / p90c - 1) * 100) : null,
    mom: Number.isFinite(mean30) && mean30 > 0 ? round2((p0 / mean30 - 1) * 100) : null,
    dd: Number.isFinite(peak90) && peak90 > 0 ? round2((p0 / peak90 - 1) * 100) : null,
    rel: cohort && Number.isFinite(p30) && p30 > 0 ? round2((Math.log(p0 / p30) - cohort.logReturn30) * 100) : null,
    br: cohort ? Math.round(cohort.breadth) : null,
    p0: round2(p0),
    f7: mat.fwd7[i], f30: mat.fwd30[i], f90: mat.fwd90[i],
  };
}
const round2 = value => Math.round(value * 100) / 100;
const firstIdxAtOrAfter = (days, day, lo, hi) => { let a = lo, b = hi + 1; while (a < b) { const m = (a + b) >> 1; if (days[m] >= day) b = m; else a = m + 1; } return a; };

if (!REPORT_ONLY) {
  let evaluated = 0, skippedFar = 0;
  for (let p = 0; p < nP; p++) {
    const id = products[p];
    if (done.has(id)) continue;
    const { days, prices } = seriesByProduct.get(id);
    const points = days.map((day, i) => ({ date: isoOf(day), price: prices[i] }));
    const signals = [];
    const featureRows = [];
    for (let o = 0; o < nO; o++) {
      const i = at(p, o), p0 = mat.p0[i];
      if (!Number.isFinite(p0)) continue;
      const prefixEnd = asofIndex(days, origins[o]) + 1;
      if (prefixEnd < 2) continue;
      if (FEATURES) {
        const cohort = cohortAt(p, o);
        for (const side of [0, 1]) {
          const row = featureRow(days, prices, 0, prefixEnd - 1, origins[o], p0, side, cohort, i);
          if (row) {
            const prefix = points.slice(0, prefixEnd);
            const reading = classifyRegime(prefix, p0, null, cohort?.breadth);
            featureRows.push({ o, s: side, rg: reading?.regime ?? null, ...row });
            evaluated++;
          }
        }
        continue;
      }
      let prefix = null; // built lazily — most (product, origin, side) triples are far from extremes
      for (const side of ["buy", "sell"]) {
        // Safe pre-filter (v1 only): the evaluator's best window distance is bounded below
        // by the smaller of the 30/90-day distances (30d ⊆ 90d ⊆ all-time extremes), and no
        // preset cutoff exceeds 18% — beyond 25% nothing can qualify. v2's winsorized
        // distances are NOT bounded by raw distances (a glitch minimum inflates the raw
        // distance while the robust floor sits at the price), so v2 evaluates everything.
        if (MODEL === "v1") {
          const near = side === "buy" ? Math.min(mat.dBuy30[i], mat.dBuy90[i]) : Math.min(mat.dSell30[i], mat.dSell90[i]);
          if (Number.isFinite(near) && near > 25) { skippedFar++; continue; }
        }
        prefix ??= points.slice(0, prefixEnd);
        // v2 consumes the regime and cohort stats; classify once per (product, origin)
        // and hand the reading in, instead of letting the evaluator redo it per strictness.
        const cohort = MODEL === "v1" ? null : cohortAt(p, o);
        const context = MODEL === "v1" ? null
          : side === "sell" ? { model: MODEL, cohort, regime: classifyRegime(prefix, p0, null, cohort?.breadth) }
          : { model: MODEL, cohort };
        for (let s = 0; s < 3; s++) {
          const result = evaluateMarketSignal(prefix, side, strictnesses[s], p0, context);
          evaluated++;
          if (result.eligible) signals.push([o, side === "buy" ? 0 : 1, s, result.signal.score, Math.round(result.signal.distance * 100), result.signal.confidence === "high" ? 2 : result.signal.confidence === "medium" ? 1 : 0]);
          else exclusions[result.code] = (exclusions[result.code] ?? 0) + 1;
        }
      }
    }
    appendFileSync(NDJSON, JSON.stringify(FEATURES ? { p: id, f: featureRows } : { p: id, s: signals }) + "\n");
    done.add(id);
    if (p % 500 === 499) log(`model ${done.size}/${nP} (evals ${evaluated}, prefiltered ${skippedFar})`);
    if (MAX_MINUTES > 0 && Date.now() - startedAt > MAX_MINUTES * 60_000) {
      log(`time slice up after ${done.size}/${nP} products — rerun the same command to resume`);
      process.exit(0);
    }
  }
  log(`model pass complete (evals ${evaluated}, prefiltered ${skippedFar})`);
}
if (FEATURES) { log(`feature dump complete → ${NDJSON}`); process.exit(0); }

// --- aggregate + report ----------------------------------------------------------
// Optional price floor, applied identically to every strategy at aggregation time.
// Production's liquidity gate cannot be replayed (no archived sales); cheap cards are
// its best proxy — without a floor, percentage metrics are dominated by sub-$1 noise.
const MIN_PRICE = Number(args["min-price"] ?? 0);
const SUFFIX = MIN_PRICE ? `-min${MIN_PRICE}` : "";
const productIndex = new Map(products.map((id, index) => [id, index]));
const modelRows = []; // {p,o,side,strict,score,fwd7,fwd30,fwd90,exc}
for (const line of readFileSync(NDJSON, "utf8").split("\n")) {
  if (!line) continue;
  let parsed; try { parsed = JSON.parse(line); } catch { continue; }
  const p = productIndex.get(parsed.p);
  if (p == null) continue;
  for (const [o, side, strict, score] of parsed.s) {
    const i = at(p, o);
    if (mat.p0[i] < MIN_PRICE) continue;
    modelRows.push({ p, o, side, strict, score, fwd7: mat.fwd7[i], fwd30: mat.fwd30[i], fwd90: mat.fwd90[i], exc: side === 0 ? mat.mae30[i] : mat.mfe30[i] });
  }
}

const pct = value => Number.isFinite(value) ? `${(value * 100).toFixed(2)}%` : "n/a";
function describe(rows, side) {
  const scored = rows.filter(row => Number.isFinite(row.fwd30));
  const hits = scored.filter(row => (side === 0 ? row.fwd30 > 0 : row.fwd30 < 0)).length;
  const strong = scored.filter(row => (side === 0 ? row.fwd30 > 0.05 : row.fwd30 < -0.05)).length;
  return {
    n: rows.length,
    medFwd7: median(rows.map(row => row.fwd7)),
    medFwd30: median(rows.map(row => row.fwd30)),
    medFwd90: median(rows.map(row => row.fwd90)),
    hitRate: scored.length ? hits / scored.length : NaN,
    strongRate: scored.length ? strong / scored.length : NaN,
    medExcursion: median(rows.map(row => row.exc)),
  };
}
function topKPrecision(rows, side, k) {
  const byOrigin = new Map();
  for (const row of rows) (byOrigin.get(row.o) ?? byOrigin.set(row.o, []).get(row.o)).push(row);
  let hits = 0, total = 0;
  for (const group of byOrigin.values()) {
    const top = group.sort((a, b) => b.rank - a.rank).slice(0, k).filter(row => Number.isFinite(row.fwd30));
    total += top.length;
    hits += top.filter(row => (side === 0 ? row.fwd30 > 0 : row.fwd30 < 0)).length;
  }
  return total ? hits / total : NaN;
}

const summary = { run: RUN, model: MODEL, db: DB_PATH, every: EVERY, origins: nO, products: nP, top: TOP, minPrice: MIN_PRICE, liquidityGate: "not applied (no archived sales)", exclusions, strategies: {} };
const lines = [`# Walk-forward report — ${RUN}${SUFFIX}`, "", `Model: ${MODEL} · Origins: ${nO} (${isoOf(origins[0])} → ${isoOf(origins.at(-1))}, every ${EVERY}d) · products: ${nP} · price floor: ${MIN_PRICE ? `$${MIN_PRICE}` : "none"} · DB: \`${DB_PATH}\``, "", `Liquidity gate NOT applied historically (no archived sales) — uniform across strategies.`, `Buy success = forward 30d return > 0 (strong > +5%); sell success = forward 30d < 0. Excursion = worst-case dip after buys / further rise after sells (30d).`, "", "| strategy | side | n | med fwd7 | med fwd30 | med fwd90 | hit | strong | med excursion | top-20 precision |", "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|"];

function addStrategy(name, side, rows) {
  const stats = describe(rows, side);
  const precision = topKPrecision(rows, side, TOP);
  summary.strategies[`${name}|${side === 0 ? "buy" : "sell"}`] = { ...stats, precision };
  lines.push(`| ${name} | ${side === 0 ? "buy" : "sell"} | ${stats.n} | ${pct(stats.medFwd7)} | ${pct(stats.medFwd30)} | ${pct(stats.medFwd90)} | ${pct(stats.hitRate)} | ${pct(stats.strongRate)} | ${pct(stats.medExcursion)} | ${pct(precision)} |`);
}

// model, per strictness (rank = score)
for (let s = 0; s < 3; s++) for (const side of [0, 1]) {
  const rows = modelRows.filter(row => row.strict === s && row.side === side).map(row => ({ ...row, rank: row.score }));
  addStrategy(`model:${strictnesses[s]}`, side, rows);
}

// baselines: rank universe per origin, keep top-K rows (universe = valid p0 + fwd30)
function baselineRows(side, rankOf) {
  const rows = [];
  for (let o = 0; o < nO; o++) {
    const candidates = [];
    for (let p = 0; p < nP; p++) {
      const i = at(p, o);
      if (!Number.isFinite(mat.p0[i]) || mat.p0[i] < MIN_PRICE || !Number.isFinite(mat.fwd30[i])) continue;
      const rank = rankOf(i, p, o);
      if (Number.isFinite(rank)) candidates.push({ p, o, side, rank, fwd7: mat.fwd7[i], fwd30: mat.fwd30[i], fwd90: mat.fwd90[i], exc: side === 0 ? mat.mae30[i] : mat.mfe30[i] });
    }
    rows.push(...candidates.sort((a, b) => b.rank - a.rank).slice(0, TOP));
  }
  return rows;
}
for (const side of [0, 1]) {
  addStrategy("near-90d-extreme", side, baselineRows(side, i => {
    const distance = side === 0 ? mat.dBuy90[i] : mat.dSell90[i];
    return Number.isFinite(distance) && distance <= 2.25 ? -distance : NaN;
  }));
  addStrategy("momentum-30d", side, baselineRows(side, i => Number.isFinite(mat.ret30[i]) ? (side === 0 ? -mat.ret30[i] : mat.ret30[i]) : NaN));
  addStrategy("cohort-median", side, baselineRows(side, i => Number.isFinite(mat.cohortDev[i]) ? (side === 0 ? -mat.cohortDev[i] : mat.cohortDev[i]) : NaN));
  addStrategy("random", side, baselineRows(side, (i, p, o) => mulberry32(hashStr(`${RUN}|${side}|${p}|${o}`))()));
}

// calibration: balanced model buys by score quintile
const balancedBuys = modelRows.filter(row => row.strict === 1 && row.side === 0 && Number.isFinite(row.fwd30)).sort((a, b) => a.score - b.score);
if (balancedBuys.length >= 25) {
  lines.push("", "## Calibration — balanced Hot Buy score quintiles (median fwd30 · hit rate)", "");
  const buckets = 5, size = Math.floor(balancedBuys.length / buckets);
  for (let b = 0; b < buckets; b++) {
    const slice = balancedBuys.slice(b * size, b === buckets - 1 ? balancedBuys.length : (b + 1) * size);
    const scores = slice.map(row => row.score);
    lines.push(`- scores ${Math.min(...scores)}–${Math.max(...scores)}: ${pct(median(slice.map(row => row.fwd30)))} · hit ${pct(slice.filter(row => row.fwd30 > 0).length / slice.length)} (n=${slice.length})`);
  }
}
lines.push("", `Exclusion tallies (evaluator): ${JSON.stringify(exclusions)}`, "");

writeFileSync(path.join(OUT_DIR, `report${SUFFIX}.md`), lines.join("\n"));
writeFileSync(path.join(OUT_DIR, `summary${SUFFIX}.json`), JSON.stringify(summary, null, 1));
log(`report → ${path.join(OUT_DIR, `report${SUFFIX}.md`)}`);
