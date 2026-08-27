import assert from "node:assert/strict";
import test from "node:test";
import { drawdownFromPeak, momentum, priceStreak, salesWindow, trendSlope, volatilityRange } from "../app/domain/detail-metrics.ts";

const day = index => `2026-08-${String(index).padStart(2, "0")}`;
const series = prices => prices.map((price, index) => ({ date: day(index + 1), price }));

test("volatility range reports the robust spread relative to the median", () => {
  assert.equal(volatilityRange(series([100, 100, 100, 100, 100]), 90), 0);
  const spread = volatilityRange(series([90, 95, 100, 105, 110]), 90);
  assert.ok(spread > 10 && spread < 20, `robust spread ${spread}`);
  assert.equal(volatilityRange(series([100, 101]), 90), null);
});

test("momentum compares the current price against the window average", () => {
  assert.equal(momentum(110, series([100, 100, 100, 100]), 90), 10.000000000000009);
  assert.equal(momentum(null, series([100, 100]), 90), null);
  assert.equal(momentum(100, series([100]), 90), null);
});

test("drawdown is zero at the peak and negative below it", () => {
  assert.equal(drawdownFromPeak(120, series([100, 110, 120]), 90), 0);
  assert.equal(drawdownFromPeak(60, series([100, 120, 80]), 90), -50);
});

test("price streak counts consecutive same-direction observations from the end", () => {
  assert.deepEqual(priceStreak(series([100, 90, 95, 100, 105])), { direction: 1, length: 3 });
  assert.deepEqual(priceStreak(series([100, 105, 95, 90])), { direction: -1, length: 2 });
  assert.equal(priceStreak(series([100, 100])), null);
});

test("trend slope reports dollars per week from a linear fit", () => {
  const slope = trendSlope(series([100, 101, 102, 103, 104, 105, 106, 107]), 90);
  assert.ok(Math.abs(slope - 7) < 1e-9, `daily +$1 should fit +$7/week, got ${slope}`);
  assert.equal(trendSlope(series([100, 101]), 90), null);
});

test("sales window aggregates trailing buckets and keeps missing prices out", () => {
  const buckets = [
    { date: "2026-05-01", quantity: 9, low: 10, high: 20, lowWithShipping: 12, highWithShipping: 22 },
    { date: "2026-08-10", quantity: 3, low: 50, high: 70, lowWithShipping: 55, highWithShipping: 75 },
    { date: "2026-08-20", quantity: 2, low: null, high: null, lowWithShipping: null, highWithShipping: null },
    { date: "2026-08-24", quantity: 4, low: 45, high: 90, lowWithShipping: 48, highWithShipping: 95 },
  ];
  const window = salesWindow(buckets, 30);
  assert.equal(window.quantity, 9);
  assert.equal(window.low, 45);
  assert.equal(window.high, 90);
  assert.equal(window.lowWithShipping, 48);
  assert.equal(window.highWithShipping, 95);
  assert.deepEqual(salesWindow([], 30), { quantity: 0, low: null, high: null, lowWithShipping: null, highWithShipping: null });
});
