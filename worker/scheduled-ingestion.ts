import { fetchTcgplayerHistory } from "../app/data/tcgplayer-history-client.ts";
import { runDetailIngestionBatch } from "../db/detail-ingestion.ts";
import { runGradedRotationBatch } from "../db/graded-ingestion.ts";
import { runHistoryBackfillBatch } from "../db/history-backfill.ts";
import { runLiveDailyIngestionBatch } from "../db/live-ingestion.ts";
import { runMetricsRollup } from "../db/metrics-ingestion.ts";
import { publishedIngestion, readRefreshCursor } from "../db/repository.ts";
import { decideScheduledAction, type ScheduledAction } from "./scheduled-decision.ts";
import { gradedRotationDeps, historyTargets, liveSyncDeps, loadDetailChunkPaths, loadStagingSnapshot, probeTcgcsvUpdatedAt, type StagingJobEnv } from "./staging-jobs.ts";

// The assets binding routes by pathname; the host of this synthetic request is irrelevant.
const assetsBase = "https://raw-signal.internal/";

async function fetchAssetJson(assets: StagingJobEnv["ASSETS"], path: string): Promise<unknown> {
  const response = await assets.fetch(new Request(new URL(path, assetsBase), { headers: { Accept: "application/json" } }));
  if (!response.ok) throw new Error(`Scheduled source ${path} unavailable: ${response.status}`);
  return response.json();
}

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
  });
  if (action === "idle") return { action, detail: "No ingestion work due" };
  const syntheticRequest = new Request(assetsBase);
  if (action === "live") {
    const result = await runLiveDailyIngestionBatch(env.DB, liveSyncDeps(syntheticRequest, env.ASSETS), { sourceUpdatedAt: probeUpdatedAt!, batchSize: 80 });
    return { action, detail: `${result.cursor} of ${result.entries} entries${result.done ? " done" : ""}` };
  }
  if (action === "details") {
    const chunkPaths = await loadDetailChunkPaths(syntheticRequest, env.ASSETS);
    const result = await runDetailIngestionBatch(env.DB, chunkPaths, path => fetchAssetJson(env.ASSETS, path), { batchSize: 4, sourceUpdatedAt: deploySnapshotUpdatedAt });
    return { action, detail: `${result.cursor}/${result.total}${result.done ? " done" : ""}` };
  }
  if (action === "graded") {
    const result = await runGradedRotationBatch(env.DB, gradedRotationDeps(env.POKEMONPRICETRACKER_API_KEY!), { budget: 90 });
    return { action, detail: `${result.updated}/${result.targets} updated, ~${result.spent} credits${result.stopped ? ` (${result.stopped})` : ""}` };
  }
  if (action === "metrics") {
    const result = await runMetricsRollup(env.DB, { mode: "daily" });
    return { action, detail: `${result.series} series, ${result.seriesRows} rows` };
  }
  const snapshot = await loadStagingSnapshot(syntheticRequest, env.ASSETS, deploySnapshotUpdatedAt);
  const targets = historyTargets(snapshot);
  const result = await runHistoryBackfillBatch(env.DB, targets, target => fetchTcgplayerHistory(target.productId, target.printing, Boolean(target.sealed)), {
    batchSize: 60,
    sourceUpdatedAt: snapshot.sourceUpdatedAt,
  });
  return { action, detail: `${result.cursor}/${result.total}${result.done ? " done" : ""}` };
}
