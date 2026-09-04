import { publishedIngestion, readRefreshCursor } from "../db/repository.ts";
import { ingestionRunId } from "../db/run-id.ts";
import { planScheduledAction, type ScheduledAction, type ScheduledPlan } from "./scheduled-decision.ts";
import { probeTcgcsvUpdatedAt, runDetailsJob, runGradedJob, runHistoryJob, runLiveJob, runMetricsJob, type StagingJobEnv } from "./staging-jobs.ts";

// The assets binding routes by pathname; the host of this synthetic request is irrelevant.
const assetsBase = "https://raw-signal.internal/";

// Per-tick slice sizes: each guard-cron tick advances one bounded batch (docs/todo.md G1).
const LIVE_BATCH_SIZE = 80;
const DETAILS_BATCH_SIZE = 4;
const GRADED_CREDIT_BUDGET = 90;
const HISTORY_BATCH_SIZE = 60;

// Everything the tick touches outside D1, injectable so the dispatch can be tested
// without a network or a clock. Production uses the defaults.
export type ScheduledTickDeps = {
  now: () => Date;
  probe: () => Promise<string>;
  jobs: {
    live: typeof runLiveJob;
    details: typeof runDetailsJob;
    graded: typeof runGradedJob;
    metrics: typeof runMetricsJob;
    history: typeof runHistoryJob;
  };
};

const defaultDeps: ScheduledTickDeps = {
  now: () => new Date(),
  probe: () => probeTcgcsvUpdatedAt(),
  jobs: { live: runLiveJob, details: runDetailsJob, graded: runGradedJob, metrics: runMetricsJob, history: runHistoryJob },
};

export type ScheduledTickResult = { action: ScheduledAction; detail: string };

export async function runScheduledIngestionTick(env: StagingJobEnv, deps: ScheduledTickDeps = defaultDeps): Promise<ScheduledTickResult> {
  if (!env.DB) return { action: "idle", detail: "No database binding" };
  const now = deps.now();
  const deploySnapshotUpdatedAt = env.CF_VERSION_METADATA?.timestamp ?? now.toISOString();
  const today = now.toISOString().slice(0, 10);
  const [live, details, graded, metrics, historyCheckpoint, historyPublished] = await Promise.all([
    publishedIngestion(env.DB, "daily-market"),
    publishedIngestion(env.DB, "product-details"),
    publishedIngestion(env.DB, "graded-rotation"),
    publishedIngestion(env.DB, "metrics-rollup"),
    readRefreshCursor(env.DB, "history-backfill"),
    publishedIngestion(env.DB, "history-signals"),
  ]);
  const liveTodayRunId = ingestionRunId("live-daily", today);
  // Probe only while today's live run is incomplete; a failed probe retries next tick.
  let probeUpdatedAt: string | null = null;
  if (live?.runId !== liveTodayRunId) {
    try { probeUpdatedAt = await deps.probe(); }
    catch (error) { console.error(JSON.stringify({ event: "tcgcsv_probe_failed", message: error instanceof Error ? error.message : "Unknown failure" })); }
  }
  const plan = planScheduledAction({
    probeUpdatedAt,
    livePublishedUpdatedAt: live?.sourceUpdatedAt ?? null,
    livePublishedRunId: live?.runId ?? null,
    liveTodayRunId,
    deploySnapshotUpdatedAt,
    detailsPublishedUpdatedAt: details?.sourceUpdatedAt ?? null,
    detailsPublishedRunId: details?.runId ?? null,
    gradedKeyConfigured: Boolean(env.POKEMONPRICETRACKER_API_KEY),
    gradedPublishedRunId: graded?.runId ?? null,
    gradedTodayRunId: ingestionRunId("graded-rotation", today),
    metricsPublishedRunId: metrics?.runId ?? null,
    historyCheckpointRunId: historyCheckpoint?.ingestionRunId ?? null,
    historyPublishedRunId: historyPublished?.runId ?? null,
  });
  return dispatch(env, plan, deps.jobs);
}

async function dispatch(env: StagingJobEnv, plan: ScheduledPlan, jobs: ScheduledTickDeps["jobs"]): Promise<ScheduledTickResult> {
  const { action } = plan;
  const syntheticRequest = new Request(assetsBase);
  const progress = (result: { cursor: number; total: number; done: boolean }) => `${result.cursor}/${result.total}${result.done ? " done" : ""}`;
  switch (plan.action) {
    case "idle":
      return { action, detail: "No ingestion work due" };
    case "live": {
      const result = await jobs.live(env, syntheticRequest, LIVE_BATCH_SIZE, plan.sourceUpdatedAt);
      return { action, detail: `${result.cursor} of ${result.entries} entries${result.done ? " done" : ""}` };
    }
    case "details":
      return { action, detail: progress(await jobs.details(env, syntheticRequest, DETAILS_BATCH_SIZE, plan.sourceUpdatedAt)) };
    case "graded": {
      const result = await jobs.graded(env, GRADED_CREDIT_BUDGET);
      return { action, detail: `${result.updated}/${result.targets} updated, ~${result.spent} credits${result.stopped ? ` (${result.stopped})` : ""}` };
    }
    case "metrics": {
      const result = await jobs.metrics(env, "daily", plan.asOfDate);
      return { action, detail: `${result.series} series, ${result.seriesRows} rows${result.benchmark?.done ? `, S&P ${result.benchmark.rows}d` : ""}` };
    }
    case "history":
      return { action, detail: progress(await jobs.history(env, syntheticRequest, HISTORY_BATCH_SIZE, plan.sourceUpdatedAt, { all: plan.all })) };
  }
}
