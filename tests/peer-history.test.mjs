import assert from "node:assert/strict";
import test from "node:test";
import { appendPeerHistory, COHORT_HISTORY_CAP, cohortKey, dailyPeerAverages, summarizePeerHistory } from "../core/peer-history.ts";
import { parsePeerAnchorFeed } from "../core/domain/contracts.ts";

const card = (productId, overrides = {}) => ({
  productId, game: "pokemon", set: "Test Set", rarity: "Illustration Rare", marketPrice: 10, ...overrides,
});

test("dailyPeerAverages groups by game|set|rarity and skips unusable prices", () => {
  const averages = dailyPeerAverages([
    card(1, { marketPrice: 10 }),
    card(2, { marketPrice: 30 }),
    card(3, { marketPrice: Number.NaN }),
    card(4, { marketPrice: 0 }),
    card(5, { rarity: "Ultra Rare", marketPrice: 7 }),
  ]);
  assert.deepEqual(averages, {
    "pokemon|Test Set|Illustration Rare": { average: 20, count: 2 },
    "pokemon|Test Set|Ultra Rare": { average: 7, count: 1 },
  });
  assert.equal(cohortKey(card(1)), "pokemon|Test Set|Illustration Rare");
});

test("appendPeerHistory is idempotent per date, capped, and prunes stale cohorts", () => {
  const key = "pokemon|Test Set|Illustration Rare";
  let history = appendPeerHistory({}, "2026-08-27", { [key]: { average: 20, count: 2 } });
  history = appendPeerHistory(history, "2026-08-27", { [key]: { average: 21, count: 2 } });
  assert.deepEqual(history[key], [{ date: "2026-08-27", average: 21, count: 2 }]);
  history = appendPeerHistory(history, "2026-08-28", { [key]: { average: 22, count: 2 } });
  assert.equal(history[key].length, 2);

  const long = { [key]: Array.from({ length: COHORT_HISTORY_CAP + 10 }, (_, i) => ({
    date: `2026-0${1 + Math.floor(i / 28)}-${String(1 + (i % 28)).padStart(2, "0")}`, average: 5, count: 1,
  })) };
  const capped = appendPeerHistory(long, "2026-06-01", { [key]: { average: 6, count: 1 } });
  assert.equal(capped[key].length, COHORT_HISTORY_CAP);
  assert.equal(capped[key].at(-1).date, "2026-06-01");

  const stale = { "pokemon|Old Set|Rare": [{ date: "2025-01-01", average: 3, count: 4 }] };
  assert.deepEqual(appendPeerHistory(stale, "2026-08-27", {}), {});
});

test("summarizePeerHistory reports windowed means and 90-day observation depth", () => {
  const key = "pokemon|Test Set|Illustration Rare";
  const rows = [
    { date: "2026-04-01", average: 100, count: 5 },
    { date: "2026-08-01", average: 10, count: 5 },
    { date: "2026-08-20", average: 20, count: 5 },
    { date: "2026-08-27", average: 30, count: 6 },
  ];
  const entries = summarizePeerHistory({ [key]: rows });
  assert.deepEqual(entries[key], { current: 30, cardCount: 6, avg30: 20, avg90: 20, observations: 3 });
});

test("parsePeerAnchorFeed accepts summaries and skips malformed cohorts", () => {
  const entries = parsePeerAnchorFeed({
    schema: 1,
    entries: {
      good: { current: 30, cardCount: 6, avg30: 20, avg90: 20, observations: 3 },
      windowless: { current: 5, cardCount: 2, avg30: null, avg90: -1, observations: 1 },
      bad: { current: 0, cardCount: 6, avg30: 20, avg90: 20, observations: 3 },
      unobserved: { current: 9, cardCount: 1, avg30: 9, avg90: 9, observations: 0 },
    },
  });
  assert.deepEqual(Object.keys(entries), ["good", "windowless"]);
  assert.deepEqual(entries.windowless, { current: 5, cardCount: 2, avg30: null, avg90: null, observations: 1 });
});
