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

function fakeDb({ published = {}, checkpoint = null } = {}) {
  return {
    prepare(sql) {
      return {
        bind(key) {
          return {
            async first() {
              if (sql.includes("refresh_state r join ingestion_runs")) return published[key] ?? null;
              if (sql.includes("refresh_state r left join")) return checkpoint;
              throw new Error(`unexpected query: ${sql}`);
            },
          };
        },
      };
    },
  };
}

function harness({ published, checkpoint, probe = async () => PROBE, gradedKey = "key", versionTimestamp = DEPLOY } = {}) {
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
    },
  };
  const env = { DB: fakeDb({ published, checkpoint }), ASSETS: {}, POKEMONPRICETRACKER_API_KEY: gradedKey, CF_VERSION_METADATA: { id: "v", tag: "t", timestamp: versionTimestamp } };
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
  assert.deepEqual(metrics.calls, [["metrics", "daily"]]);
});

test("without a graded key the rotation is skipped, not attempted", async () => {
  const { env, deps, calls } = harness({ published: { ...liveDone, ...detailsDone }, gradedKey: null });
  const result = await runScheduledIngestionTick(env, deps);
  assert.equal(result.action, "metrics");
  assert.equal(calls.some(([name]) => name === "graded"), false);
});

test("the daily history refresh starts tiered under today's date once live and metrics landed", async () => {
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
    deploySnapshotUpdatedAt: DEPLOY, detailsPublishedUpdatedAt: DEPLOY, detailsPublishedRunId: "product-details:2026-08-28", detailsTodayRunId: "product-details:2026-08-28",
    gradedKeyConfigured: false, gradedPublishedRunId: null, gradedTodayRunId: "graded-rotation:2026-08-28",
    metricsPublishedRunId: null, metricsTodayRunId: "metrics-rollup:2026-08-28",
    historyCheckpointRunId: null, historyPublishedRunId: null, historyTodayRunId: "history-daily:2026-08-28",
  };
  assert.deepEqual(planScheduledAction(input), { action: "live", sourceUpdatedAt: PROBE });
  // With the probe missing, policy itself never chooses live — the plan is the idle fallthrough.
  assert.deepEqual(planScheduledAction({ ...input, probeUpdatedAt: null }), { action: "idle" });
});
