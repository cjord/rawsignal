import type { PriceHistory } from "../app/domain/types.ts";
import { persistDerivedHistory } from "./daily-ingestion.ts";
import { checkpointIngestion, completeIngestion, failIngestion, readRefreshCursor, startIngestion, upsertHistory, type D1DatabaseLike } from "./repository.ts";

export type HistoryBackfillTarget = {
  productId: number;
  printing: string;
  sealed?: boolean;
  currentPrice: number;
};

export type HistoryBackfillFetcher = (target: HistoryBackfillTarget) => Promise<PriceHistory>;
const parseStats = (value: string | null | undefined) => { try { return value ? JSON.parse(value) as { historiesWithData?: number; exactCoverage?: number } : {}; } catch { return {}; } };

export async function runHistoryBackfillBatch(db: D1DatabaseLike, targets: HistoryBackfillTarget[], fetchHistory: HistoryBackfillFetcher, options: { batchSize?: number; sourceUpdatedAt: string; now?: Date } ) {
  const batchSize = Math.max(1, Math.min(100, options.batchSize ?? 25));
  const now = options.now ?? new Date(), startedAt = now.toISOString(), runId = `history-backfill:${options.sourceUpdatedAt.slice(0, 10)}`;
  const checkpoint = await readRefreshCursor(db, "history-backfill");
  const cursor = checkpoint?.ingestionRunId === runId ? Math.max(0, Number(checkpoint.cursor) || 0) : 0;
  const priorStats = checkpoint?.ingestionRunId === runId ? parseStats(checkpoint.statsJson) : {};
  if (cursor === 0) await startIngestion(db, runId, "tcgplayer-history", startedAt, { sourceUpdatedAt: options.sourceUpdatedAt, stats: { totalTargets: targets.length } });
  const batch = targets.slice(cursor, cursor + batchSize);
  let written = cursor, historiesWithData = priorStats.historiesWithData ?? 0, exactCoverage = priorStats.exactCoverage ?? 0;
  try {
    for (const target of batch) {
      const history = await fetchHistory(target);
      const variant = history.variant ?? (target.sealed ? "Sealed" : target.printing), condition = history.condition ?? (target.sealed ? "Unopened" : "Near Mint");
      if (history.points.length) {
        await upsertHistory(db, target.productId, variant, condition, history.points, startedAt);
        await persistDerivedHistory(db, target.productId, variant, condition, target.currentPrice, history.points, history.coverage, startedAt);
        historiesWithData++; if (history.coverage === "exact") exactCoverage++;
      }
      written++;
    }
    const done = written >= targets.length, stats = { totalTargets: targets.length, processed: written, historiesWithData, exactCoverage };
    if (done) await completeIngestion(db, runId, "history-signals", new Date().toISOString(), targets.length, written, 0, 0, stats);
    else await checkpointIngestion(db, runId, "history-backfill", targets.length, written, String(written), stats);
    return { runId, cursor: written, total: targets.length, done, processed: batch.length, historiesWithData, exactCoverage };
  } catch (error) {
    await failIngestion(db, runId, new Date().toISOString(), error instanceof Error ? error.message : "Unknown history backfill failure");
    throw error;
  }
}
