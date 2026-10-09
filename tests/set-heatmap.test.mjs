import assert from "node:assert/strict";
import test from "node:test";
import { HEATMAP_COVERAGE_POLICY, buildSetHeatmap, heatmapReturn, summarizeHeatmapCell } from "../core/domain/set-heatmap.ts";
import { DEFAULT_SETS_SCOPE, parseSetsScope, serializeSetsScope } from "../app/state/sets-query.ts";

const freshness = { maxLatestAgeDays: 2, maxCutoffGapDays: 3 };
const coverage = { minMembers: 3, minCoverage: 0.6 };
const point = (date, price) => ({ date, price });

test("heatmap uses source-date cutoff, ignores future points, and never chooses a later baseline", () => {
  const result = heatmapReturn([
    point("2026-10-10", 999), point("2026-10-08", 120),
    point("2026-10-03", 110), point("2026-10-02", 100),
  ], 7, "2026-10-09", freshness);
  assert.deepEqual(result, { change: 20, reason: null, latestDate: "2026-10-08", baselineDate: "2026-10-02" });
});

test("heatmap distinguishes no data, new products, stale endpoints and cutoff gaps", () => {
  assert.equal(heatmapReturn([], 30, "2026-10-09", freshness).reason, "no-history");
  assert.equal(heatmapReturn([point("2026-10-09", 10)], 30, "2026-10-09", freshness).reason, "insufficient-history");
  assert.equal(heatmapReturn([point("2026-09-01", 10)], 30, "2026-10-09", freshness).reason, "stale");
  assert.equal(heatmapReturn([point("2026-09-01", 10), point("2026-10-09", 10)], 30, "2026-10-09", freshness).reason, "cutoff-gap");
});

test("heatmap rejects invalid/nonpositive prices and invalid calendar dates", () => {
  assert.equal(heatmapReturn([point("2026-02-30", 10), point("2026-10-09", 0), point("2026-10-08", NaN)], 7, "2026-10-09", freshness).reason, "no-history");
  assert.throws(() => heatmapReturn([], 7, "2026-02-30", freshness));
  assert.throws(() => heatmapReturn([], 7, "2026-10-09", { ...freshness, maxCutoffGapDays: -1 }));
});

test("heatmap supports all three windows and preserves actual zero movement", () => {
  for (const [window, date] of [[7, "2026-10-02"], [30, "2026-09-09"], [90, "2026-07-11"]]) {
    assert.equal(heatmapReturn([point(date, 10), point("2026-10-09", 10)], window, "2026-10-09", freshness).change, 0);
  }
});

test("cell medians use eligible members while coverage retains unavailable members", () => {
  assert.deepEqual(summarizeHeatmapCell([-10, 0, 10, null, null], coverage), {
    change: 0, total: 5, eligible: 3, coverage: 0.6, smallSample: false, reason: null,
  });
  assert.equal(summarizeHeatmapCell([0, 10, 20, 30], coverage).change, 15);
  assert.equal(summarizeHeatmapCell([0, 10, 20, null, null, null], coverage).reason, "low-coverage");
  assert.equal(summarizeHeatmapCell([NaN, Infinity, null], coverage).reason, "no-history");
  assert.equal(summarizeHeatmapCell([], coverage).reason, "not-applicable");
});

test("small-sample policy is explicit and warning survives permissive policy", () => {
  assert.equal(summarizeHeatmapCell([10, 20], coverage).reason, "small-sample");
  const cell = summarizeHeatmapCell([10, 20], HEATMAP_COVERAGE_POLICY);
  assert.equal(cell.change, 15);
  assert.equal(cell.smallSample, true);
  assert.throws(() => summarizeHeatmapCell([], { ...coverage, minCoverage: 2 }));
});

test("All tracked uses underlying members, preserves missing denominators and same-name game separation", () => {
  const member = (productId, game, section, baseline, latest) => ({
    productId, game, set: "Shared Name", section,
    latest: latest == null ? null : point("2026-10-09", latest),
    baseline7: baseline == null ? null : point("2026-10-02", baseline),
    baseline30: baseline == null ? null : point("2026-09-09", baseline),
    baseline90: baseline == null ? null : point("2026-07-11", baseline),
  });
  const result = buildSetHeatmap([
    member(1, "pokemon", "vintage", 100, 110),
    member(2, "pokemon", "vintage", 100, 110),
    member(3, "pokemon", "vintage", 100, 110),
    member(4, "pokemon", "illustration-rares", 100, 0),
    member(5, "pokemon", "illustration-rares", 100, 200),
    member(6, "riftbound", "signatures", 100, 50),
  ], "2026-10-09");
  const pokemon = result.rows.find(row => row.game === "pokemon");
  const riftbound = result.rows.find(row => row.game === "riftbound");
  assert.equal(pokemon.cells.all[30].change, 10); // median of 10,10,10,100, not mean of tier medians
  assert.equal(pokemon.cells.all[30].eligible, 4);
  assert.equal(pokemon.cells.all[30].total, 5);
  assert.equal(pokemon.cells["illustration-rares"][30].reason, "low-coverage");
  assert.equal(riftbound.cells.all[30].change, -50);
  assert.equal(riftbound.cells.signatures[30].smallSample, true);
  assert.equal(pokemon.cells.promos[30].reason, "not-applicable");
});

test("sets heatmap scope round-trips while tiles and 30D remain defaults", () => {
  const scope = { ...DEFAULT_SETS_SCOPE, market: "riftbound", view: "heatmap", window: 90,
    query: "Origins", group: "riftbound|core", favoritesOnly: true, sort: "change",
    tier: "signatures", selected: "riftbound|origins|signatures" };
  const decoded = parseSetsScope(serializeSetsScope(scope));
  assert.deepEqual({ ...decoded, market: decoded.requestedMarket, requestedMarket: undefined }, { ...scope, requestedMarket: undefined });
  assert.equal(parseSetsScope(serializeSetsScope("pokemon")).view, "tiles");
  assert.equal(parseSetsScope(serializeSetsScope("pokemon")).window, 30);
});
