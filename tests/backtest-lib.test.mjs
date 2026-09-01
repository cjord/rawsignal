import test from "node:test";
import assert from "node:assert/strict";
import { dayNum, isoOf, asofIndex, firstAtOrAfter, priceAsOf, forwardReturn, excursion, extremeDistances, median, quantileSorted, cohortKeyOf, mulberry32, hashStr } from "../scripts/backtest/lib.mjs";

const day = dayNum("2026-01-10");
const days = [day - 20, day - 10, day - 3, day, day + 6, day + 29, day + 33];
const prices = [10, 8, 9, 10, 11, 12, 9];

test("walk-forward lib: day math and as-of lookups honor staleness", () => {
  assert.equal(isoOf(dayNum("2026-01-10")), "2026-01-10");
  assert.equal(asofIndex(days, day), 3);
  assert.equal(asofIndex(days, day - 21), -1);
  assert.equal(firstAtOrAfter(days, day + 1), 4);
  assert.equal(priceAsOf(days, prices, day), 10);
  assert.equal(priceAsOf(days, prices, day - 4), 8); // 6 days stale — allowed
  assert.ok(Number.isNaN(priceAsOf(days, prices, day - 25))); // nothing observed yet
  assert.ok(Number.isNaN(priceAsOf([day - 20], [10], day, 7))); // >7 days stale
});

const closeTo = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≉ ${expected}`);

test("walk-forward lib: forward return tolerance rejects late fills", () => {
  // first obs ≥ day+7 is day+29 (22 days late) → NaN under the 7-day tolerance
  assert.ok(Number.isNaN(forwardReturn(days, prices, day, 7, 10)));
  closeTo(forwardReturn(days, prices, day, 30, 10), -0.1); // day+33 fills the 30d horizon (3 late)
  closeTo(forwardReturn(days, prices, day, 6, 10), 0.1);   // exact hit at day+6
});

test("walk-forward lib: excursions capture worst dip and best rise within the window", () => {
  closeTo(excursion(days, prices, day, 30, 10, "min"), 0.1);  // no dip below entry in (d, d+30]
  closeTo(excursion(days, prices, day, 30, 10, "max"), 0.2);  // 12 top
  closeTo(excursion(days, prices, day, 35, 10, "min"), -0.1); // 9 at day+33
});

test("walk-forward lib: extreme distances mirror the evaluator's definition", () => {
  const d = extremeDistances(days, prices, day, 30, 10);
  assert.ok(Math.abs(d.buy - 25) < 1e-9);  // window min 8 → 10/8−1 = 25%
  assert.ok(Math.abs(d.sell - 0) < 1e-9);  // current IS the window max → 0
  const sparse = extremeDistances([day], [10], day, 30, 10);
  assert.ok(Number.isNaN(sparse.buy)); // <2 points in window
});

test("walk-forward lib: median and quantiles are outlier-honest", () => {
  assert.equal(median([1, 100, 3]), 3);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.ok(Number.isNaN(median([NaN])));
  assert.equal(quantileSorted([0, 10], 0.5), 5);
});

test("walk-forward lib: cohort keys split singles by rarity and sealed by product type", () => {
  assert.equal(cohortKeyOf({ kind: "single", game: "riftbound", setName: "Origins", rarity: "Overnumbered", productType: null }), "single|riftbound|Origins|Overnumbered");
  assert.equal(cohortKeyOf({ kind: "sealed", game: "pokemon", setName: "151", rarity: null, productType: "Booster Box" }), "sealed|pokemon|151|Booster Box");
});

test("walk-forward lib: seeded RNG is deterministic", () => {
  const a = mulberry32(hashStr("seed"))(), b = mulberry32(hashStr("seed"))();
  assert.equal(a, b);
  assert.ok(a >= 0 && a < 1);
});
