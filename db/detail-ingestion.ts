import { parseCatalogDetailEnrichments } from "../app/domain/contracts.ts";
import { clampBatchSize, markIngestionFailed, parseStatsJson, resumeCheckpoint } from "./ingestion-batch.ts";
import { checkpointIngestion, completeIngestion, startIngestion, upsertProductDetails, type D1DatabaseLike } from "./repository.ts";

export type DetailChunkFetcher = (path: string) => Promise<unknown>;
type DetailStats = { detailsWritten?: number; detailsSkipped?: number };

// product_details rows carry a foreign key to catalog_products; enrichment chunks can
// reference products the catalog snapshot rejected (or scalping-only items), so each chunk
// is filtered to ids that exist before writing. Queries stay under D1's bound-parameter cap.
async function existingProductIds(db: D1DatabaseLike, ids: number[]) {
  const present = new Set<number>(), unique = [...new Set(ids)];
  for (let offset = 0; offset < unique.length; offset += 80) {
    const slice = unique.slice(offset, offset + 80);
    const rows = (await db.prepare(`select product_id as productId from catalog_products where product_id in (${slice.map(() => "?").join(",")})`).bind(...slice).all<{ productId: number }>()).results ?? [];
    for (const row of rows) present.add(row.productId);
  }
  return present;
}

// Cursor unit is the enrichment chunk file (~76 details each): one asset fetch plus a few
// db.batch calls per chunk keeps every invocation far inside the Workers binding budget.
export async function runDetailIngestionBatch(db: D1DatabaseLike, chunkPaths: string[], fetchChunk: DetailChunkFetcher, options: { batchSize?: number; sourceUpdatedAt: string; now?: Date }) {
  const batchSize = clampBatchSize(options.batchSize, 4, 10);
  const now = options.now ?? new Date(), startedAt = now.toISOString(), runId = `product-details:${options.sourceUpdatedAt.slice(0, 10)}`;
  const resume = await resumeCheckpoint(db, "product-details-progress", runId);
  const cursor = Math.max(0, Math.min(chunkPaths.length, Number(resume.cursor) || 0));
  const prior = parseStatsJson<DetailStats>(resume.statsJson);
  if (cursor === 0) await startIngestion(db, runId, "detail-feed", startedAt, { sourceUpdatedAt: options.sourceUpdatedAt, stats: { totalChunks: chunkPaths.length } });
  const batch = chunkPaths.slice(cursor, cursor + batchSize);
  let processed = cursor, detailsWritten = prior.detailsWritten ?? 0, detailsSkipped = prior.detailsSkipped ?? 0;
  try {
    for (const path of batch) {
      const enrichments = parseCatalogDetailEnrichments(await fetchChunk(path));
      const present = await existingProductIds(db, enrichments.map(detail => detail.productId));
      const writable = enrichments.filter(detail => present.has(detail.productId));
      await upsertProductDetails(db, writable);
      detailsWritten += writable.length;
      detailsSkipped += enrichments.length - writable.length;
      processed++;
    }
    const done = processed >= chunkPaths.length, stats = { totalChunks: chunkPaths.length, processedChunks: processed, detailsWritten, detailsSkipped };
    // Checkpoint to the end even when done so a re-invocation no-ops instead of replaying the tail chunk.
    await checkpointIngestion(db, runId, "product-details-progress", chunkPaths.length, detailsWritten, String(processed), stats);
    if (done) await completeIngestion(db, runId, "product-details", new Date().toISOString(), chunkPaths.length, detailsWritten, detailsSkipped, 0, stats);
    return { runId, cursor: processed, total: chunkPaths.length, done, processed: batch.length, detailsWritten, detailsSkipped };
  } catch (error) {
    await markIngestionFailed(db, runId, error, "Unknown detail ingestion failure");
    throw error;
  }
}
