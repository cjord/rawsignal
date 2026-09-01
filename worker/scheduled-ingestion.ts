import { publishedIngestion, readRefreshCursor } from "../db/repository.ts";
import { decideScheduledAction, type ScheduledAction } from "./scheduled-decision.ts";
import { probeTcgcsvUpdatedAt, runDetailsJob, runGradedJob, runHistoryJob, runLiveJob, runMetricsJob, type StagingJobEnv } from "./staging-jobs.ts";

// The assets binding routes by pathname; the host of this synthetic request is irrelevant.
const assetsBase = "https://raw-signal.internal/";

export async function runScheduledIngestionTick(env: StagingJobEnv): Promise<{ action: ScheduledAction; detail: string }> {
  if (!env.DB) return { action: "idle", detail: "No database binding" };
  const deploySnapshotUpdatedAt = env.CF_VERSION_METADATA?.timestamp ?? new Date().toISOString();
  const today = new Date().toISOString().slice(0, 10);
  const [live, details, graded, metrics, historyCheckpoint, historyPublished] = await Promise.all([
    publishedIngestion(env.DB, "daily-market"),
    publishedIngestion(env.DB, "product-details"),
    publishedIngestion(env.DB, "graded-rotation"),
    publishedIngestion(env.DB, "metrics-rollup"),
    readRefreshCursor(env.DB, "history-backfill"),
    publishedIngestion(env.DB, "history-signals"),
  ]);
  const liveTodayRunId = `live-daily:${today}`;
  // Probe only while today's live run is incomplete; a failed probe retries next tick.
  let probeUpdatedAt: string | null = null;
  if (live?.runId !== liveTodayRunId) {
    try { probeUpdatedAt = await probeTcgcsvUpdatedAt(); }
    catch (error) { console.error(JSON.stringify({ event: "tcgcsv_probe_failed", message: error instanceof Error ? error.message : "Unknown failure" })); }
  }
  const action = decideScheduledAction({
    probeUpdatedAt,
    livePublishedUpdatedAt: live?.sourceUpdatedAt ?? null,
    livePublishedRunId: live?.runId ?? null,
    liveTodayRunId,
    deploySnapshotUpdatedAt,
    detailsPublishedUpdatedAt: details?.sourceUpdatedAt ?? null,
    detailsPublishedRunId: details?.runId ?? null,
    detailsTodayRunId: `product-details:${today}`,
    gradedKeyConfigured: Boolean(env.POKEMONPRICETRACKER_API_KEY),
    gradedPublishedRunId: graded?.runId ?? null,
    gradedTodayRunId: `graded-rotation:${today}`,
    metricsPublishedRunId: metrics?.runId ?? null,
    metricsTodayRunId: `metrics-rollup:${today}`,
    historyCheckpointRunId: historyCheckpoint?.ingestionRunId ?? null,
    historyPublishedRunId: historyPublished?.runId ?? null,
    historyTodayRunId: `history-daily:${today}`,
  });
  if (action === "idle") return { action, detail: "No ingestion work due" };
  const syntheticRequest = new Request(assetsBase);
  if (action === "live") {
    const result = await runLiveJob(env, syntheticRequest, 80, probeUpdatedAt!);
    return { action, detail: `${result.cursor} of ${result.entries} entries${result.done ? " done" : ""}` };
  }
  if (action === "details") {
    const result = await runDetailsJob(env, syntheticRequest, 4, deploySnapshotUpdatedAt);
    return { action, detail: `${result.cursor}/${result.total}${result.done ? " done" : ""}` };
  }
  if (action === "graded") {
    const result = await runGradedJob(env, 90);
    return { action, detail: `${result.updated}/${result.targets} updated, ~${result.spent} credits${result.stopped ? ` (${result.stopped})` : ""}` };
  }
  if (action === "metrics") {
    const result = await runMetricsJob(env, "daily");
    return { action, detail: `${result.series} series, ${result.seriesRows} rows${result.benchmark?.done ? `, S&P ${result.benchmark.rows}d` : ""}` };
  }
  // Continue any checkpointed run under ITS OWN key and target-list mode — an operator
  // backfill (`history-backfill:` prefix) rebuilds the full list, the cron's own daily
  // run (`history-daily:`) the tier-due list — otherwise start today's tiered refresh.
  const checkpointRunId = historyCheckpoint?.ingestionRunId ?? null;
  const continuing = checkpointRunId != null && checkpointRunId !== historyPublished?.runId;
  const tiered = !continuing || checkpointRunId!.startsWith("history-daily:");
  const historyDate = continuing ? checkpointRunId!.slice(checkpointRunId!.indexOf(":") + 1) : today;
  const result = await runHistoryJob(env, syntheticRequest, 60, historyDate, { all: !tiered });
  return { action, detail: `${result.cursor}/${result.total}${result.done ? " done" : ""}` };
}
