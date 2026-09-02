// Offline score calibration over a feature dump (walk-forward --features). Reads the
// dump, prints per-feature decile curves (median fwd30 + hit rate) per side, regime
// splits for sells, and evaluates candidate score formulas by rank calibration —
// deciles of the candidate score should order hit rates monotonically, which the
// production v1/v2 score does not (docs/backtests.md).
//
//   node scripts/backtest/calibrate.mjs --file backups/backtests/features-s3000/model-signals.ndjson
//     [--min-price 5] [--qualify-only]

import { createInterface } from "node:readline";
import { createReadStream } from "node:fs";
import { median } from "./lib.mjs";

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg.startsWith("--")) { const next = process.argv[i + 1]; if (next && !next.startsWith("--")) { args[arg.slice(2)] = next; i++; } else args[arg.slice(2)] = "1"; }
}
const FILE = args.file ?? "backups/backtests/features-s3000/model-signals.ndjson";
const MIN_PRICE = Number(args["min-price"] ?? 5);

const rows = { buy: [], sell: [] };
const reader = createInterface({ input: createReadStream(FILE), crlfDelay: Infinity });
for await (const line of reader) {
  if (!line) continue;
  let parsed; try { parsed = JSON.parse(line); } catch { continue; }
  for (const row of parsed.f ?? []) {
    if (row.p0 < MIN_PRICE || row.f30 == null || !Number.isFinite(row.f30)) continue;
    rows[row.s === 0 ? "buy" : "sell"].push(row);
  }
}
console.log(`rows: buy ${rows.buy.length.toLocaleString()} · sell ${rows.sell.length.toLocaleString()} (price floor $${MIN_PRICE})`);

const pct = value => `${(value * 100).toFixed(2)}%`;
const hitOf = (list, side) => list.filter(row => side === "buy" ? row.f30 > 0 : row.f30 < 0).length / Math.max(1, list.length);

function deciles(list, side, valueOf, label) {
  const usable = list.filter(row => valueOf(row) != null && Number.isFinite(valueOf(row)));
  if (usable.length < 100) { console.log(`  ${label}: insufficient (${usable.length})`); return; }
  usable.sort((a, b) => valueOf(a) - valueOf(b));
  const size = Math.floor(usable.length / 10);
  const cells = [];
  for (let d = 0; d < 10; d++) {
    const slice = usable.slice(d * size, d === 9 ? usable.length : (d + 1) * size);
    cells.push(`${valueOf(slice[0]).toFixed(1)}→${(hitOf(slice, side) * 100).toFixed(0)}%/${(median(slice.map(row => row.f30)) * 100).toFixed(1)}`);
  }
  console.log(`  ${label}: ${cells.join(" | ")}`);
}

for (const side of ["buy", "sell"]) {
  console.log(`\n== ${side.toUpperCase()} feature deciles (lower-bound → hit%/median-fwd30%) ==`);
  const list = rows[side];
  console.log(`  base rate: hit ${pct(hitOf(list, side))} · median fwd30 ${pct(median(list.map(row => row.f30)))}`);
  deciles(list, side, row => row.d, "distance");
  deciles(list, side, row => row.sw, "swing");
  deciles(list, side, row => row.c7, "change7");
  deciles(list, side, row => row.c30, "change30");
  deciles(list, side, row => row.mom, "momentum30");
  deciles(list, side, row => row.dd, "drawdown90");
  deciles(list, side, row => row.rel, "cohortRel");
  deciles(list, side, row => row.br, "breadth");
  deciles(list, side, row => row.vol, "volatility");
  console.log("  by confidence:", [0, 1, 2].map(conf => { const slice = list.filter(row => row.conf === conf); return `${conf}:${slice.length ? (hitOf(slice, side) * 100).toFixed(0) + "%" : "-"}`; }).join(" "));
  console.log("  by regime:", ["falling", "improving", "breakout", "overextended", "spike", "steady", null].map(regime => { const slice = list.filter(row => row.rg === regime); return `${regime ?? "none"}:${slice.length ? (hitOf(slice, side) * 100).toFixed(0) + "%/" + slice.length : "-"}`; }).join(" "));
}

// Candidate scores: rank calibration — deciles of each score should order hit rates.
const candidates = {
  buy: {
    "v2-like (62·prox + .8·swing + conf)": row => 62 * Math.max(0, 1 - row.d / 10) + Math.min(24, Math.max(0, row.sw) * .8) + [3, 8, 14][row.conf],
    "bounce-led (swing + c7 bounce - prox)": row => Math.min(30, Math.max(0, row.sw)) + 3 * Math.min(5, Math.max(0, row.c7 ?? 0)) + [3, 8, 14][row.conf] + 20 * Math.max(0, 1 - row.d / 25),
    "reversion (dd + bounce)": row => -(row.dd ?? 0) * .8 + 4 * Math.min(5, Math.max(0, row.c7 ?? 0)) + [3, 8, 14][row.conf],
    "laggard (cohortRel low + bounce)": row => -(row.rel ?? 0) * 1.2 + 3 * Math.min(5, Math.max(0, row.c7 ?? 0)) + [3, 8, 14][row.conf],
  },
  sell: {
    "v2-like": row => 62 * Math.max(0, 1 - row.d / 10) + Math.min(24, Math.max(0, row.sw) * .8) + [3, 8, 14][row.conf],
    "fade-led (swing + fading momentum)": row => Math.min(30, Math.max(0, row.sw)) - 3 * Math.min(5, Math.max(0, row.c7 ?? 0)) + [3, 8, 14][row.conf] + 20 * Math.max(0, 1 - row.d / 25),
    "overextension (mom + rel high)": row => (row.mom ?? 0) * 1.5 + (row.rel ?? 0) * 1 + Math.min(30, Math.max(0, row.sw)) - 4 * Math.max(0, row.c7 ?? 0),
  },
};
for (const side of ["buy", "sell"]) {
  console.log(`\n== ${side.toUpperCase()} candidate score rank calibration (decile hit% low→high score) ==`);
  for (const [name, scorer] of Object.entries(candidates[side])) deciles(rows[side], side, scorer, name);
}

// Proposed v2.1: symmetric turn-confirmation gates + evidence-weighted scores built
// from the monotone features above. Gates subset the rows; the score should then order
// hit rates monotonically WITHIN the gated pool.
const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value ?? 0));
const proposed = {
  buy: {
    gate: row => row.d >= 1 && row.d <= 15 && (row.c7 ?? -1) >= 0,
    score: row => clamp(row.c7, 0, 5) * 5 + clamp(row.c30, 0, 10) * 1.5 + (row.br ?? 50) * .25 + [0, 5, 20][row.conf] + clamp(row.sw, 0, 15),
  },
  sell: {
    gate: row => row.d >= 0.4 && row.d <= 15 && (row.c7 ?? 1) <= 0,
    score: row => clamp(-(row.c7 ?? 0), 0, 5) * 5 + clamp(-(row.c30 ?? 0), 0, 10) * 1.5 + (100 - (row.br ?? 50)) * .25 + [0, 5, 10][row.conf] + clamp(row.sw, 0, 15) + clamp(row.d, 0, 8) * 1.25,
  },
};
for (const side of ["buy", "sell"]) {
  const { gate, score } = proposed[side];
  const pool = rows[side].filter(gate);
  console.log(`\n== ${side.toUpperCase()} PROPOSED v2.1 — gate keeps ${pool.length.toLocaleString()}/${rows[side].length.toLocaleString()} (${(pool.length / rows[side].length * 100).toFixed(1)}%) ==`);
  console.log(`  gated base rate: hit ${pct(hitOf(pool, side))} · median fwd30 ${pct(median(pool.map(row => row.f30)))}`);
  deciles(pool, side, score, "v2.1 score");
  // Top-slice quality (what the boards would actually show).
  const ranked = [...pool].sort((a, b) => score(b) - score(a));
  for (const share of [.1, .25]) {
    const top = ranked.slice(0, Math.floor(ranked.length * share));
    console.log(`  top ${share * 100}%: hit ${pct(hitOf(top, side))} · median fwd30 ${pct(median(top.map(row => row.f30)))} (n=${top.length})`);
  }
}

// ---- Calibration sweeps (items 1–3) — run only when the extended columns exist ----
const hasExtended = rows.buy.some(row => row.c90 !== undefined && row.dA !== undefined);
if (hasExtended) {
  const topSlice = (pool, scorer, share) => [...pool].sort((a, b) => scorer(b) - scorer(a)).slice(0, Math.max(1, Math.floor(pool.length * share)));
  const q = (pool, side, label) => `${label}: n=${pool.length} hit ${pct(hitOf(pool, side))} med ${pct(median(pool.map(row => row.f30)))}`;

  // (1) Buy turn-term saturation: swap only the 7-day term; the rest of v2.1 stays.
  console.log("\n== (1) BUY turn-term shapes — top 10% / top 25% / 'conservative' top 13% of gated pool ==");
  const buyPool = rows.buy.filter(proposed.buy.gate);
  const rest = row => clamp(row.c30, 0, 10) * 1.5 + (row.br ?? 50) * .25 + [0, 5, 20][row.conf] + clamp(row.sw, 0, 15);
  const shapes = {
    "current 5·cap5": row => clamp(row.c7, 0, 5) * 5,
    "linear cap8": row => clamp(row.c7, 0, 8) * 25 / 8,
    "sqrt cap10": row => Math.sqrt(clamp(row.c7, 0, 10) / 10) * 25,
    "log cap15": row => Math.log(1 + clamp(row.c7, 0, 15)) / Math.log(16) * 25,
    "hump peak3": row => Math.max(0, (clamp(row.c7, 0, 15) / 3) * Math.exp(1 - clamp(row.c7, 0, 15) / 3)) * 25 / Math.E * Math.E,
  };
  for (const [name, term] of Object.entries(shapes)) {
    const scorer = row => term(row) + rest(row);
    console.log(`  ${name}: ${[.1, .13, .25].map(share => { const top = topSlice(buyPool, scorer, share); return `${(share * 100).toFixed(0)}%→${(hitOf(top, "buy") * 100).toFixed(1)}%/${(median(top.map(row => row.f30)) * 100).toFixed(1)}`; }).join("  ")}`);
  }

  // (2) change90 — deciles overall and within the gated buy pool.
  console.log("\n== (2) change90 deciles ==");
  deciles(rows.buy, "buy", row => row.c90, "buy all");
  deciles(buyPool, "buy", row => row.c90, "buy gated");
  deciles(rows.sell.filter(proposed.sell.gate), "sell", row => row.c90, "sell gated");

  // (3a) Gate sweeps — pool share and base quality per (distance, week) threshold.
  console.log("\n== (3a) BUY gate sweep (dMin × weekMin) ==");
  for (const dMin of [.5, 1, 1.5, 2]) for (const wMin of [-1, 0, .5, 1]) {
    const pool = rows.buy.filter(row => row.d >= dMin && row.d <= 15 && (row.c7 ?? -99) >= wMin);
    console.log(`  d≥${dMin} c7≥${wMin}: share ${(pool.length / rows.buy.length * 100).toFixed(1)}% hit ${pct(hitOf(pool, "buy"))} med ${pct(median(pool.map(row => row.f30)))}`);
  }
  console.log("== (3a) SELL gate sweep (dMin × weekMax) ==");
  for (const dMin of [.2, .4, .8, 1.5]) for (const wMax of [.5, 0, -.5, -1]) {
    const pool = rows.sell.filter(row => row.d >= dMin && row.d <= 15 && (row.c7 ?? 99) <= wMax);
    console.log(`  d≥${dMin} c7≤${wMax}: share ${(pool.length / rows.sell.length * 100).toFixed(1)}% hit ${pct(hitOf(pool, "sell"))} med ${pct(median(pool.map(row => row.f30)))}`);
  }

  // (3b) Winsor percentile for the reference extreme: gate on dA (5/95), d (10/90), dB (15/85).
  console.log("\n== (3b) Winsor sweep — same gates, distance measured at 5/10/15th pct ==");
  for (const side of ["buy", "sell"]) {
    const dMin = side === "buy" ? 1 : .4, wOk = row => side === "buy" ? (row.c7 ?? -99) >= 0 : (row.c7 ?? 99) <= 0;
    for (const key of ["dA", "d", "dB"]) {
      const pool = rows[side].filter(row => row[key] >= dMin && row[key] <= 15 && wOk(row));
      console.log(`  ${side} ${key === "d" ? "q10/90" : key === "dA" ? "q05/95" : "q15/85"}: ${q(pool, side, "")}`);
    }
  }

  // (3c) Cohort dampener band: hit rate of the would-be-dampened slice vs its complement.
  console.log("\n== (3c) Dampener band sweep (buy pool; dampened-slice hit vs rest) ==");
  for (const own of [3, 5, 8]) for (const band of [2, 3, 5]) {
    const damped = buyPool.filter(row => row.rel != null && row.c30 != null && Math.abs(row.c30) >= own && Math.abs(row.rel) <= band);
    const restPool = buyPool.filter(row => !(row.rel != null && row.c30 != null && Math.abs(row.c30) >= own && Math.abs(row.rel) <= band));
    if (damped.length > 200) console.log(`  |c30|≥${own} |rel|≤${band}: damped ${pct(hitOf(damped, "buy"))} (n=${damped.length}) vs rest ${pct(hitOf(restPool, "buy"))}`);
  }

  // Final v2.2 candidate: hump turn term, hardened gates, breadth ×.35, c90 terms,
  // dampener removed. Print rank calibration + score quantiles for minScore selection.
  console.log("\n== FINAL v2.2 candidate ==");
  const hump = value => Math.max(0, (clamp(value, 0, 15) / 3) * Math.exp(1 - clamp(value, 0, 15) / 3)) * 25;
  const v22 = {
    buy: {
      gate: row => row.d >= 1 && row.d <= 15 && (row.c7 ?? -99) >= 0.5,
      score: row => Math.min(100, hump(row.c7) + clamp(row.c30, 0, 10) * 1.5 + (row.br ?? 50) * .35 + [0, 5, 20][row.conf] + clamp(row.sw, 0, 15) + clamp(row.c90, 0, 25) * .4),
    },
    sell: {
      gate: row => row.d >= 0.8 && row.d <= 15 && (row.c7 ?? 99) <= -0.5,
      score: row => Math.min(100, clamp(-(row.c7 ?? 0), 0, 5) * 5 + clamp(-(row.c30 ?? 0), 0, 10) * 1.5 + (100 - (row.br ?? 50)) * .35 + [0, 5, 10][row.conf] + clamp(row.sw, 0, 15) + clamp(row.d, 0, 8) * 1.25 + clamp(-(row.c90 ?? 0), 0, 20) * .35),
    },
  };
  for (const side of ["buy", "sell"]) {
    const { gate, score } = v22[side];
    const pool = rows[side].filter(gate);
    console.log(`  ${side}: pool ${(pool.length / rows[side].length * 100).toFixed(1)}% base hit ${pct(hitOf(pool, side))} med ${pct(median(pool.map(row => row.f30)))}`);
    deciles(pool, side, score, `  v2.2 ${side} score`);
    const scores = pool.map(score).sort((a, b) => a - b);
    const at = share => scores[Math.floor(scores.length * share)].toFixed(0);
    console.log(`    score quantiles: 15th ${at(.15)} · 45th ${at(.45)} · 75th ${at(.75)}`);
    for (const share of [.1, .25, .55]) {
      const top = topSlice(pool, score, share);
      console.log(`    top ${(share * 100).toFixed(0)}%: hit ${pct(hitOf(top, side))} med ${pct(median(top.map(row => row.f30)))} (n=${top.length})`);
    }
  }

  // (3d) Breadth weight in the buy score.
  console.log("\n== (3d) Breadth weight sweep (buy top 10%) ==");
  for (const weight of [.15, .25, .35]) {
    const scorer = row => clamp(row.c7, 0, 5) * 5 + clamp(row.c30, 0, 10) * 1.5 + (row.br ?? 50) * weight + [0, 5, 20][row.conf] + clamp(row.sw, 0, 15);
    const top = topSlice(buyPool, scorer, .1);
    console.log(`  ×${weight}: hit ${pct(hitOf(top, "buy"))} med ${pct(median(top.map(row => row.f30)))}`);
  }
}
