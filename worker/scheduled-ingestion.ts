import { fetchTcgplayerHistory } from "../app/data/tcgplayer-history-client.ts";
import { runDailyMarketIngestionBatch } from "../db/daily-ingestion.ts";
import { runDetailIngestionBatch } from "../db/detail-ingestion.ts";
import { runHistoryBackfillBatch } from "../db/history-backfill.ts";
import { publishedIngestion, readRefreshCursor } from "../db/repository.ts";
import { decideScheduledAction, type ScheduledAction } from "./scheduled-decision.ts";
import { historyTargets, loadDetailChunkPaths, loadStagingSnapshot, type StagingJobEnv } from "./staging-jobs.ts";

// The assets binding routes by pathname; the host of this synthetic request is irrelevant.
const assetsBase = "https://raw-signal.internal/";

async function fetchAssetJson(assets: StagingJobEnv["ASSETS"], path: string): Promise<unknown> {
  const response = await assets.fetch(new Request(new URL(path, assetsBase), { headers: { Accept: "application/json" } }));
  if (!response.ok) throw new Error(`Scheduled source ${path} unavailable: ${response.status}`);
  return response.json();
}

export async function runScheduledIngestionTick(env: StagingJobEnv): Promise<{ action: ScheduledAction; detail: string }> {
  if (!env.DB) return { action: "idle", detail: "No database binding" };
  const sourceUpdatedAt = env.CF_VERSION_METADATA?.timestamp ?? new Date().toISOString();
  const today = new Date().toISOString().slice(0, 10);
  const [daily, details, historyCheckpoint, historyPublished] = await Promise.all([
    publishedIngestion(env.DB, "daily-market"),
    publishedIngestion(env.DB, "product-details"),
    readRefreshCursor(env.DB, "history-backfill"),
    publishedIngestion(env.DB, "history-signals"),
  ]);
  const action = decideScheduledAction({
    snapshotUpdatedAt: sourceUpdatedAt,
    dailyPublishedUpdatedAt: daily?.sourceUpdatedAt ?? null,
    dailyPublishedRunId: daily?.runId ?? null,
    dailyTodayRunId: `daily-market:${today}`,
    detailsPublishedUpdatedAt: details?.sourceUpdatedAt ?? null,
    detailsPublishedRunId: details?.runId ?? null,
    detailsTodayRunId: `product-details:${today}`,
    historyCheckpointRunId: historyCheckpoint?.ingestionRunId ?? null,
    historyPublishedRunId: historyPublished?.runId ?? null,
  });
  if (action === "idle") return { action, detail: "No ingestion work due" };
  if (action === "details") {
    const chunkPaths = await loadDetailChunkPaths(new Request(assetsBase), env.ASSETS);
    const result = await runDetailIngestionBatch(env.DB, chunkPaths, path => fetchAssetJson(env.ASSETS, path), { batchSize: 4, sourceUpdatedAt });
    return { action, detail: `${result.cursor}/${result.total}${result.done ? " done" : ""}` };
  }
  const snapshot = await loadStagingSnapshot(new Request(assetsBase), env.ASSETS, sourceUpdatedAt);
  if (action === "daily") {
    const result = await runDailyMarketIngestionBatch(env.DB, snapshot, { batchSize: 80 });
    return { action, detail: `${result.cursor}/${result.total}${result.done ? " done" : ""}` };
  }
  const targets = historyTargets(snapshot);
  const result = await runHistoryBackfillBatch(env.DB, targets, target => fetchTcgplayerHistory(target.productId, target.printing, Boolean(target.sealed)), {
    batchSize: 60,
    sourceUpdatedAt: snapshot.sourceUpdatedAt,
  });
  return { action, detail: `${result.cursor}/${result.total}${result.done ? " done" : ""}` };
}
