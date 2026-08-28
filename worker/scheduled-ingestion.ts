import { fetchTcgplayerHistory } from "../app/data/tcgplayer-history-client.ts";
import { runDailyMarketIngestionBatch } from "../db/daily-ingestion.ts";
import { runHistoryBackfillBatch } from "../db/history-backfill.ts";
import { publishedIngestion, readRefreshCursor } from "../db/repository.ts";
import { decideScheduledAction, type ScheduledAction } from "./scheduled-decision.ts";
import { historyTargets, loadStagingSnapshot, type StagingJobEnv } from "./staging-jobs.ts";

// The assets binding routes by pathname; the host of this synthetic request is irrelevant.
const assetsBase = "https://raw-signal.internal/";

export async function runScheduledIngestionTick(env: StagingJobEnv): Promise<{ action: ScheduledAction; detail: string }> {
  if (!env.DB) return { action: "idle", detail: "No database binding" };
  const sourceUpdatedAt = env.CF_VERSION_METADATA?.timestamp ?? new Date().toISOString();
  const [daily, historyCheckpoint, historyPublished] = await Promise.all([
    publishedIngestion(env.DB, "daily-market"),
    readRefreshCursor(env.DB, "history-backfill"),
    publishedIngestion(env.DB, "history-signals"),
  ]);
  const action = decideScheduledAction({
    snapshotUpdatedAt: sourceUpdatedAt,
    dailyPublishedUpdatedAt: daily?.sourceUpdatedAt ?? null,
    dailyPublishedRunId: daily?.runId ?? null,
    dailyTodayRunId: `daily-market:${new Date().toISOString().slice(0, 10)}`,
    historyCheckpointRunId: historyCheckpoint?.ingestionRunId ?? null,
    historyPublishedRunId: historyPublished?.runId ?? null,
  });
  if (action === "idle") return { action, detail: "No ingestion work due" };
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
