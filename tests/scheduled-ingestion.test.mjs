import test from "node:test";
import assert from "node:assert/strict";
import { runScheduledIngestionTick } from "../worker/scheduled-ingestion.ts";
import { planScheduledAction } from "../worker/scheduled-decision.ts";
import { ingestionRunId, runIdDate } from "../db/run-id.ts";

// The tick reads six published-run rows; a fake D1 answers them by refresh key so the
// dispatch is exercised end to end without a database, a clock, or a network.
const NOW = new Date("2026-08-28T21:00:00Z");
const DEPLOY = "2026-08-28T04:00:00.000Z";
const PROBE = "2026-08-28T20:05:00Z";

// `leaseHeld` makes the tick-lease claim report no change (another tick holds it, R4).
function fakeDb({ published = {}, checkpoint = null, leaseHeld = false } = {}) {
  const db = { leaseClaims: 0, leaseReleases: 0 };
  db.prepare = (sql) => ({
    bind(key) {
      return {
        async run() {
          if (sql.includes("insert into refresh_state (key, cursor)")) { db.leaseClaims++; return { meta: { changes: leaseHeld ? 0 : 1 } }; }
          if (sql.includes("set cursor = null where key")) { db.leaseReleases++; return { meta: { changes: 1 } }; }
          throw new Error(`unexpected write: ${sql}`);
        },
        async first() {
          if (sql.includes("refresh_state r join ingestion_runs")) return published[key] ?? null;
          if (sql.includes("refresh_state r left join")) return checkpoint;
          throw new Error(`unexpected query: ${sql}`);
        },
      };
    },
  });
  return db;
}

function harness({ published, checkpoint, probe = async () => PROBE, gradedKey = "key", ebayKey = null, versionTimestamp = DEPLOY, leaseHeld = false } = {}) {
  const calls = [];
  // Recorded without the env and the synthetic asset Request: the values that matter are the
  // batch size, the snapshot identity, and the target-list mode.
  const record = (name, result) => (...args) => { calls.push([name, ...args.slice(1).filter(arg => !(arg instanceof Request))]); return Promise.resolve(result); };
  const deps = {
    now: () => NOW,
    probe,
    jobs: {
      live: record("live", { cursor: 80, entries: 1200, done: false }),
      details: record("details", { cursor: 4, total: 40, done: false }),
      graded: record("graded", { updated: 12, targets: 90, spent: 91, stopped: null }),
      metrics: record("metrics", { series: 3, seriesRows: 900, benchmark: { done: true, rows: 250 } }),
      history: record("history", { cursor: 60, total: 600, done: false }),
      ebay: record("ebay", { runId: "ebay-listings:2026-08-28", calls: 240, updated: 30, targets: 40, stopped: null, done: false }),
    },
  };
  const env = { DB: fakeDb({ published, checkpoint, leaseHeld }), ASSETS: {}, POKEMONPRICETRACKER_API_KEY: gradedKey, EBAY_CLIENT_ID: ebayKey ?? undefined, EBAY_CLIENT_SECRET: ebayKey ?? undefined, CF_VERSION_METADATA: { id: "v", tag: "t", timestamp: versionTimestamp } };
  return { env, deps, calls };
}

const published = (runId, sourceUpdatedAt = null) => ({ runId, sourceUpdatedAt });
const liveDone = { "daily-market": published("live-daily:2026-08-28", PROBE) };
const detailsDone = { "product-details": published("product-details:2026-08-28", DEPLOY) };
const gradedDone = { "graded-rotation": published("graded-rotation:2026-08-28") };
const metricsDone = { "metrics-rollup": published("metrics-rollup:2026-08-28") };

test("run ids round-trip through the shared helpers", () => {
  assert.equal(ingestionRunId("history-daily", "2026-08-28"), "history-daily:2026-08-28");
  assert.equal(ingestionRunId("history-backfill", "2026-08-27T20:05:00Z"), "history-backfill:2026-08-27");
  assert.equal(runIdDate("history-backfill:2026-08-27"), "2026-08-27");
  assert.equal(runIdDate("live-daily:2026-08-28"), "2026-08-28");
});

test("a missing database binding is an idle tick", async () => {
  const { deps, calls } = harness();
  const result = await runScheduledIngestionTick({ ASSETS: {} }, deps);
  assert.deepEqual(result, { action: "idle", detail: "No database binding" });
  assert.deepEqual(calls, []);
});

test("a fresh publish runs the live job with the probe timestamp as the snapshot identity", async () => {
  const { env, deps, calls } = harness({ published: { ...detailsDone } });
  const result = await runScheduledIngestionTick(env, deps);
  assert.equal(result.action, "live");
  assert.equal(result.detail, "80 of 1200 entries");
  assert.deepEqual(calls, [["live", 80, PROBE]]);
});

test("a failed probe is logged, skipped, and the tick falls through to the next due job", async () => {
  const errors = [];
  const original = console.error;
  console.error = message => errors.push(JSON.parse(message));
  try {
    const { env, deps, calls } = harness({ probe: async () => { throw new Error("tcgcsv 503"); } });
    const result = await runScheduledIngestionTick(env, deps);
    assert.equal(result.action, "details");
    assert.deepEqual(calls, [["details", 4, DEPLOY]]);
    assert.deepEqual(errors, [{ event: "tcgcsv_probe_failed", message: "tcgcsv 503" }]);
  } finally {
    console.error = original;
  }
});

test("the probe is skipped entirely once today's live run is complete", async () => {
  let probed = 0;
  const { env, deps } = harness({ published: { ...liveDone }, probe: async () => { probed += 1; return PROBE; } });
  const result = await runScheduledIngestionTick(env, deps);
  assert.equal(result.action, "details");
  assert.equal(probed, 0);
});

test("details, graded, and metrics dispatch with their named batch sizes and report progress", async () => {
  const details = harness({ published: { ...liveDone } });
  assert.deepEqual(await runScheduledIngestionTick(details.env, details.deps), { action: "details", detail: "4/40" });
  assert.deepEqual(details.calls, [["details", 4, DEPLOY]]);

  const graded = harness({ published: { ...liveDone, ...detailsDone } });
  assert.deepEqual(await runScheduledIngestionTick(graded.env, graded.deps), { action: "graded", detail: "12/90 updated, ~91 credits" });
  assert.deepEqual(graded.calls, [["graded", 90]]);

  const metrics = harness({ published: { ...liveDone, ...detailsDone, ...gradedDone } });
  assert.deepEqual(await runScheduledIngestionTick(metrics.env, metrics.deps), { action: "metrics", detail: "3 series, 900 rows, S&P 250d" });
  assert.deepEqual(metrics.calls, [["metrics", "daily", "2026-08-28"]]);
});

test("a later deploy on the same day finds the day's details run complete and moves on (R2)", async () => {
  // Details runs are keyed by the deploy snapshot's DATE: a second deploy that day changes the
  // snapshot timestamp but not the run id, so the completed run satisfies the gate. Until
  // 2026-09-04 the gate compared against the wall-clock day and re-dispatched the finished
  // run every tick, blocking graded, metrics, and history behind an empty "223/223 done".
  const redeploy = harness({ published: { ...liveDone, ...detailsDone }, versionTimestamp: "2026-08-28T22:00:00.000Z" });
  assert.deepEqual(await runScheduledIngestionTick(redeploy.env, redeploy.deps), { action: "graded", detail: "12/90 updated, ~91 credits" });
  assert.equal(redeploy.calls.some(([name]) => name === "details"), false);
  // A deploy dated a new day is a new run id: details run again, once, for that snapshot.
  const nextDay = harness({ published: { ...liveDone, ...detailsDone }, versionTimestamp: "2026-08-29T01:00:00.000Z" });
  assert.deepEqual(await runScheduledIngestionTick(nextDay.env, nextDay.deps), { action: "details", detail: "4/40" });
  assert.deepEqual(nextDay.calls, [["details", 4, "2026-08-29T01:00:00.000Z"]]);
});

test("without a graded key the rotation is skipped, not attempted", async () => {
  const { env, deps, calls } = harness({ published: { ...liveDone, ...detailsDone }, gradedKey: null });
  const result = await runScheduledIngestionTick(env, deps);
  assert.equal(result.action, "metrics");
  assert.equal(calls.some(([name]) => name === "graded"), false);
});

test("a live run published for yesterday's TCGCSV date gets yesterday's rollup, then yesterday's tiered history (R1)", async () => {
  const yesterday = { "daily-market": published("live-daily:2026-08-27", "2026-08-27T20:05:00Z") };
  // The probe sees today's publish is not ingested yet, but the live job is not due until the
  // probe differs — here it equals the published snapshot, so the tick moves to the rollup.
  const metrics = harness({ published: { ...yesterday, ...detailsDone, ...gradedDone }, probe: async () => "2026-08-27T20:05:00Z" });
  assert.deepEqual(await runScheduledIngestionTick(metrics.env, metrics.deps), { action: "metrics", detail: "3 series, 900 rows, S&P 250d" });
  assert.deepEqual(metrics.calls, [["metrics", "daily", "2026-08-27"]]);
  const history = harness({ published: { ...yesterday, ...detailsDone, ...gradedDone, "metrics-rollup": published("metrics-rollup:2026-08-27") }, probe: async () => "2026-08-27T20:05:00Z" });
  assert.equal((await runScheduledIngestionTick(history.env, history.deps)).action, "history");
  assert.deepEqual(history.calls, [["history", 60, "2026-08-27", { all: false }]]);
});

test("the daily history refresh starts tiered under the live run's date once live and metrics landed", async () => {
  const { env, deps, calls } = harness({ published: { ...liveDone, ...detailsDone, ...gradedDone, ...metricsDone } });
  const result = await runScheduledIngestionTick(env, deps);
  assert.deepEqual(result, { action: "history", detail: "60/600" });
  assert.deepEqual(calls, [["history", 60, "2026-08-28", { all: false }]]);
});

test("an uncompleted operator backfill resumes under its own date with the full target list", async () => {
  const { env, deps, calls } = harness({
    published: { ...liveDone, ...detailsDone, ...gradedDone, ...metricsDone },
    checkpoint: { cursor: "1200", ingestionRunId: "history-backfill:2026-08-27", statsJson: null },
  });
  const result = await runScheduledIngestionTick(env, deps);
  assert.equal(result.action, "history");
  assert.deepEqual(calls, [["history", 60, "2026-08-27", { all: true }]]);
});

test("an uncompleted daily run resumes tiered under its own date, even across midnight", async () => {
  const { env, deps, calls } = harness({
    published: { ...liveDone, ...detailsDone, ...gradedDone, ...metricsDone },
    checkpoint: { cursor: "300", ingestionRunId: "history-daily:2026-08-27", statsJson: null },
  });
  await runScheduledIngestionTick(env, deps);
  assert.deepEqual(calls, [["history", 60, "2026-08-27", { all: false }]]);
});

test("a checkpoint whose run already published is not a resume; the day's tiered refresh starts instead", async () => {
  const { env, deps, calls } = harness({
    published: { ...liveDone, ...detailsDone, ...gradedDone, ...metricsDone, "history-signals": published("history-backfill:2026-08-27") },
    checkpoint: { cursor: "600", ingestionRunId: "history-backfill:2026-08-27", statsJson: null },
  });
  await runScheduledIngestionTick(env, deps);
  assert.deepEqual(calls, [["history", 60, "2026-08-28", { all: false }]]);
});

test("a completed history run dated today leaves the tick idle", async () => {
  const { env, deps, calls } = harness({
    published: { ...liveDone, ...detailsDone, ...gradedDone, ...metricsDone, "history-signals": published("history-daily:2026-08-28") },
  });
  assert.deepEqual(await runScheduledIngestionTick(env, deps), { action: "idle", detail: "No ingestion work due" });
  assert.deepEqual(calls, []);
});

test("the plan refuses a live action without a probe value instead of passing an undefined snapshot", () => {
  const input = {
    probeUpdatedAt: PROBE, livePublishedUpdatedAt: null, livePublishedRunId: null, liveTodayRunId: "live-daily:2026-08-28",
    deploySnapshotUpdatedAt: DEPLOY, detailsPublishedUpdatedAt: DEPLOY, detailsPublishedRunId: "product-details:2026-08-28",
    gradedKeyConfigured: false, gradedPublishedRunId: null, gradedTodayRunId: "graded-rotation:2026-08-28",
    metricsPublishedRunId: null, metricsTodayRunId: "metrics-rollup:2026-08-28",
    historyCheckpointRunId: null, historyPublishedRunId: null, historyTodayRunId: "history-daily:2026-08-28",
  };
  assert.deepEqual(planScheduledAction(input), { action: "live", sourceUpdatedAt: PROBE });
  // With the probe missing, policy itself never chooses live — the plan is the idle fallthrough.
  assert.deepEqual(planScheduledAction({ ...input, probeUpdatedAt: null }), { action: "idle" });
});

test("the eBay listings rotation takes only idle ticks, once a day, and only with Browse credentials", async () => {
  const chainDone = { ...liveDone, ...detailsDone, ...gradedDone, ...metricsDone, "history-signals": published("history-daily:2026-08-28") };
  // Without credentials the tick is idle; with them the day's run is dispatched with its tick budget.
  assert.deepEqual(await runScheduledIngestionTick(harness({ published: chainDone }).env, harness({ published: chainDone }).deps), { action: "idle", detail: "No ingestion work due" });
  const due = harness({ published: chainDone, ebayKey: "keyset" });
  assert.deepEqual(await runScheduledIngestionTick(due.env, due.deps), { action: "ebay", detail: "30/40 updated, 240 calls today" });
  assert.deepEqual(due.calls, [["ebay", 40]]);
  // A completed run dated today satisfies the gate; yesterday's does not.
  const done = harness({ published: { ...chainDone, "ebay-listings": published("ebay-listings:2026-08-28") }, ebayKey: "keyset" });
  assert.equal((await runScheduledIngestionTick(done.env, done.deps)).action, "idle");
  const stale = harness({ published: { ...chainDone, "ebay-listings": published("ebay-listings:2026-08-27") }, ebayKey: "keyset" });
  assert.equal((await runScheduledIngestionTick(stale.env, stale.deps)).action, "ebay");
  // The chain always comes first: with history still due, eBay waits.
  const historyDue = harness({ published: { ...liveDone, ...detailsDone, ...gradedDone, ...metricsDone }, ebayKey: "keyset" });
  assert.equal((await runScheduledIngestionTick(historyDue.env, historyDue.deps)).action, "history");
});

test("a tick claims the lease before doing anything and releases it after; a held lease makes the tick idle (R4)", async () => {
  const { env, deps, calls } = harness({ published: { ...detailsDone } });
  assert.equal((await runScheduledIngestionTick(env, deps)).action, "live");
  assert.deepEqual({ claims: env.DB.leaseClaims, releases: env.DB.leaseReleases }, { claims: 1, releases: 1 });
  assert.equal(calls.length, 1);
  // The previous minute's tick is still running: nothing is planned, nothing is probed or dispatched.
  let probed = 0;
  const held = harness({ published: { ...detailsDone }, leaseHeld: true, probe: async () => { probed++; return PROBE; } });
  assert.deepEqual(await runScheduledIngestionTick(held.env, held.deps), { action: "idle", detail: "Previous tick still running" });
  assert.deepEqual({ claims: held.env.DB.leaseClaims, releases: held.env.DB.leaseReleases, probed, calls: held.calls.length }, { claims: 1, releases: 0, probed: 0, calls: 0 });
});
