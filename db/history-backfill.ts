import type { PriceHistory } from "../core/domain/types.ts";
import { mapWithConcurrency } from "../core/market-utils.ts";
import { persistDerivedHistory } from "./daily-ingestion.ts";
import { clampBatchSize, markIngestionFailed, parseStatsJson, resumeCheckpoint } from "./ingestion-batch.ts";
import { checkpointIngestion, completeIngestion, startIngestion, upsertHistory, type D1DatabaseLike } from "./repository.ts";

// Workers allow six simultaneous outbound connections; history fetches are independent, so
// run them concurrently and keep the D1 writes sequential in target order.
const FETCH_CONCURRENCY = 6;

// Delta-only writes (todo M1): D1 bills every upserted row even when the value is
// unchanged, and each daily fetch re-covers a series we already hold — re-upserting
// ~90–150 points per product per day was ~98% of the account's D1 writes. Persist only
// points beyond the stored frontier: newer than the newest stored date, older than the
// oldest (a brand-new product's first daily observation must not block its deep
// backfill), or inside the trailing revision window — TCGplayer revises recent days as
// sales settle. Derived metrics still compute from the full fetched series.
export const HISTORY_REVISION_WINDOW_DAYS = 7;

export type HistoryBackfillTarget = {
  productId: number;
  printing: string;
  sealed?: boolean;
  currentPrice: number;
};

export type HistoryBackfillFetcher = (target: HistoryBackfillTarget) => Promise<PriceHistory>;
type BackfillStats = { historiesWithData?: number; exactCoverage?: number; skippedMissingCatalog?: number; pointsWritten?: number };

export async function runHistoryBackfillBatch(db: D1DatabaseLike, targets: HistoryBackfillTarget[], fetchHistory: HistoryBackfillFetcher, options: { batchSize?: number; sourceUpdatedAt: string; now?: Date; runIdPrefix?: string } ) {
  const batchSize = clampBatchSize(options.batchSize, 25, 100);
  // Full operator backfills keep the historical "history-backfill" key; the cron's
  // tier-scheduled daily runs use "history-daily" so a resumed checkpoint can be
  // rebuilt with the same target-list mode it started with (todo M4).
  const now = options.now ?? new Date(), startedAt = now.toISOString(), runId = `${options.runIdPrefix ?? "history-backfill"}:${options.sourceUpdatedAt.slice(0, 10)}`;
  const resume = await resumeCheckpoint(db, "history-backfill", runId);
  const cursor = Math.max(0, Number(resume.cursor) || 0);
  const priorStats = parseStatsJson<BackfillStats>(resume.statsJson);
  if (cursor === 0) await startIngestion(db, runId, "tcgplayer-history", startedAt, { sourceUpdatedAt: options.sourceUpdatedAt, stats: { totalTargets: targets.length } });
  const batch = targets.slice(cursor, cursor + batchSize);
  let written = cursor, historiesWithData = priorStats.historiesWithData ?? 0, exactCoverage = priorStats.exactCoverage ?? 0, skippedMissingCatalog = priorStats.skippedMissingCatalog ?? 0, pointsWritten = priorStats.pointsWritten ?? 0;
  try {
    // Targets come from a deploy-time snapshot while the catalog may have been ingested from a
    // newer feed; a product that has since left the feed has no catalog row, and every history
    // table references catalog_products. Skip those targets instead of failing the batch.
    const ids = batch.map(target => target.productId);
    const knownRows = ids.length ? (await db.prepare(`select product_id as productId from catalog_products where product_id in (${ids.map(() => "?").join(",")})`).bind(...ids).all<{ productId: number }>()).results ?? [] : [];
    const known = new Set(knownRows.map(row => row.productId));
    const present = batch.filter(target => known.has(target.productId));
    skippedMissingCatalog += batch.length - present.length;
    // Stored min/max per variant/condition = the frontier the delta filter writes around.
    const frontierIds = [...new Set(present.map(target => target.productId))];
    const frontierRows = frontierIds.length ? (await db.prepare(`select product_id as productId, variant, condition,
      min(observed_date) as minDate, max(observed_date) as maxDate
      from price_observations where product_id in (${frontierIds.map(() => "?").join(",")})
      group by product_id, variant, condition`).bind(...frontierIds).all<{ productId: number; variant: string; condition: string; minDate: string; maxDate: string }>()).results ?? [] : [];
    const frontier = new Map(frontierRows.map(row => [`${row.productId}|${row.variant}|${row.condition}`, row]));
    const revisionFloor = new Date(now.getTime() - HISTORY_REVISION_WINDOW_DAYS * 86400000).toISOString().slice(0, 10);
    const fetched = await mapWithConcurrency(present, FETCH_CONCURRENCY, async target => ({ target, history: await fetchHistory(target) }));
    for (const { target, history } of fetched) {
      const variant = history.variant ?? (target.sealed ? "Sealed" : target.printing), condition = history.condition ?? (target.sealed ? "Unopened" : "Near Mint");
      if (history.points.length) {
        const bounds = frontier.get(`${target.productId}|${variant}|${condition}`);
        const newPoints = bounds ? history.points.filter(point => point.date > bounds.maxDate || point.date < bounds.minDate || point.date >= revisionFloor) : history.points;
        if (newPoints.length) await upsertHistory(db, target.productId, variant, condition, newPoints, startedAt);
        pointsWritten += newPoints.length;
        await persistDerivedHistory(db, target.productId, variant, condition, target.currentPrice, history.points, history.coverage, startedAt, history.sales);
        historiesWithData++; if (history.coverage === "exact") exactCoverage++;
      }
      written++;
    }
    written += batch.length - present.length;
    const done = written >= targets.length, stats = { totalTargets: targets.length, processed: written, historiesWithData, exactCoverage, skippedMissingCatalog, pointsWritten };
    if (done) await completeIngestion(db, runId, "history-signals", new Date().toISOString(), targets.length, written, 0, 0, stats);
    else await checkpointIngestion(db, runId, "history-backfill", targets.length, written, String(written), stats);
    return { runId, cursor: written, total: targets.length, done, processed: batch.length, historiesWithData, exactCoverage, skippedMissingCatalog, pointsWritten };
  } catch (error) {
    await markIngestionFailed(db, runId, error, "Unknown history backfill failure");
    throw error;
  }
}
