import type { PriceHistory } from "../app/domain/types.ts";
import { mapWithConcurrency } from "../app/market-utils.ts";
import { persistDerivedHistory } from "./daily-ingestion.ts";
import { clampBatchSize, markIngestionFailed, parseStatsJson, resumeCheckpoint } from "./ingestion-batch.ts";
import { checkpointIngestion, completeIngestion, startIngestion, upsertHistory, type D1DatabaseLike } from "./repository.ts";

// Workers allow six simultaneous outbound connections; history fetches are independent, so
// run them concurrently and keep the D1 writes sequential in target order.
const FETCH_CONCURRENCY = 6;

export type HistoryBackfillTarget = {
  productId: number;
  printing: string;
  sealed?: boolean;
  currentPrice: number;
};

export type HistoryBackfillFetcher = (target: HistoryBackfillTarget) => Promise<PriceHistory>;
type BackfillStats = { historiesWithData?: number; exactCoverage?: number; skippedMissingCatalog?: number };

export async function runHistoryBackfillBatch(db: D1DatabaseLike, targets: HistoryBackfillTarget[], fetchHistory: HistoryBackfillFetcher, options: { batchSize?: number; sourceUpdatedAt: string; now?: Date } ) {
  const batchSize = clampBatchSize(options.batchSize, 25, 100);
  const now = options.now ?? new Date(), startedAt = now.toISOString(), runId = `history-backfill:${options.sourceUpdatedAt.slice(0, 10)}`;
  const resume = await resumeCheckpoint(db, "history-backfill", runId);
  const cursor = Math.max(0, Number(resume.cursor) || 0);
  const priorStats = parseStatsJson<BackfillStats>(resume.statsJson);
  if (cursor === 0) await startIngestion(db, runId, "tcgplayer-history", startedAt, { sourceUpdatedAt: options.sourceUpdatedAt, stats: { totalTargets: targets.length } });
  const batch = targets.slice(cursor, cursor + batchSize);
  let written = cursor, historiesWithData = priorStats.historiesWithData ?? 0, exactCoverage = priorStats.exactCoverage ?? 0, skippedMissingCatalog = priorStats.skippedMissingCatalog ?? 0;
  try {
    // Targets come from a deploy-time snapshot while the catalog may have been ingested from a
    // newer feed; a product that has since left the feed has no catalog row, and every history
    // table references catalog_products. Skip those targets instead of failing the batch.
    const ids = batch.map(target => target.productId);
    const knownRows = ids.length ? (await db.prepare(`select product_id as productId from catalog_products where product_id in (${ids.map(() => "?").join(",")})`).bind(...ids).all<{ productId: number }>()).results ?? [] : [];
    const known = new Set(knownRows.map(row => row.productId));
    const present = batch.filter(target => known.has(target.productId));
    skippedMissingCatalog += batch.length - present.length;
    const fetched = await mapWithConcurrency(present, FETCH_CONCURRENCY, async target => ({ target, history: await fetchHistory(target) }));
    for (const { target, history } of fetched) {
      const variant = history.variant ?? (target.sealed ? "Sealed" : target.printing), condition = history.condition ?? (target.sealed ? "Unopened" : "Near Mint");
      if (history.points.length) {
        await upsertHistory(db, target.productId, variant, condition, history.points, startedAt);
        await persistDerivedHistory(db, target.productId, variant, condition, target.currentPrice, history.points, history.coverage, startedAt, history.sales);
        historiesWithData++; if (history.coverage === "exact") exactCoverage++;
      }
      written++;
    }
    written += batch.length - present.length;
    const done = written >= targets.length, stats = { totalTargets: targets.length, processed: written, historiesWithData, exactCoverage, skippedMissingCatalog };
    if (done) await completeIngestion(db, runId, "history-signals", new Date().toISOString(), targets.length, written, 0, 0, stats);
    else await checkpointIngestion(db, runId, "history-backfill", targets.length, written, String(written), stats);
    return { runId, cursor: written, total: targets.length, done, processed: batch.length, historiesWithData, exactCoverage, skippedMissingCatalog };
  } catch (error) {
    await markIngestionFailed(db, runId, error, "Unknown history backfill failure");
    throw error;
  }
}
