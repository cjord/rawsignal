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
