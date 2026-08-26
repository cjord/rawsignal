import { deriveHistoryMetrics } from "../app/domain/history-metrics.ts";
import type { Card, PriceHistory, PricePoint, SealedProduct, SignalStrictness } from "../app/domain/types.ts";
import { marketSignal } from "../app/signal-utils.ts";
import {
  completeIngestion,
  checkpointIngestion,
  deleteMarketSignal,
  failIngestion,
  readRefreshCursor,
  startIngestion,
  upsertCard,
  upsertHistory,
  upsertMarketMetrics,
  upsertMarketSignal,
  upsertSealedProduct,
  type D1DatabaseLike,
} from "./repository.ts";

const strictnesses: SignalStrictness[] = ["conservative", "balanced", "aggressive"];
type ObservationRow = { observedDate: string; marketCents: number };

export type DailyCatalogSnapshot = {
  cards: Card[];
  sealed: SealedProduct[];
  source: string;
  sourceUpdatedAt: string;
  schemaVersion: number;
  rejected?: Record<string, number>;
  duplicateDecisions?: unknown[];
};

export type DailyIngestionResult = {
  runId: string;
  recordsSeen: number;
  recordsWritten: number;
  observationsWritten: number;
  signalsWritten: number;
  signalEligibleProducts: number;
};

export type DailyIngestionBatchResult = DailyIngestionResult & {
  cursor: number;
  total: number;
  done: boolean;
  processed: number;
};

function validateSnapshot(snapshot: DailyCatalogSnapshot) {
  const identities = new Set<number>();
  for (const record of [...snapshot.cards, ...snapshot.sealed]) {
    if (identities.has(record.productId)) throw new Error(`Duplicate catalog product ID ${record.productId}`);
    identities.add(record.productId);
  }
  if (!identities.size) throw new Error("Refusing to ingest an empty catalog snapshot");
}

async function storedHistory(db: D1DatabaseLike, productId: number, variant: string, condition: string): Promise<PricePoint[]> {
  const rows = (await db.prepare(`select observed_date as observedDate,market_cents as marketCents
    from price_observations where product_id=? and variant=? and condition=?
    order by observed_date`).bind(productId, variant, condition).all<ObservationRow>()).results ?? [];
  return rows.map(row => ({ date: row.observedDate, price: row.marketCents / 100 }));
}

export async function persistDerivedHistory(db: D1DatabaseLike, productId: number, variant: string, condition: string, currentPrice: number, points: PricePoint[], coverage: PriceHistory["coverage"], updatedAt: string) {
  const asOfDate = points.at(-1)?.date ?? updatedAt.slice(0, 10);
  const metrics = deriveHistoryMetrics(points);
  const history: PriceHistory = { points, variant, condition, coverage, ...metrics };
  await upsertMarketMetrics(db, productId, variant, condition, asOfDate, history, updatedAt);
  let signalsWritten = 0;
  for (const strictness of strictnesses) for (const side of ["buy", "sell"] as const) {
    const signal = marketSignal(points, side, strictness, currentPrice);
    if (signal) {
      await upsertMarketSignal(db, productId, strictness, signal, asOfDate, history.coverage, points.at(-1)?.date ?? asOfDate);
      signalsWritten++;
    } else await deleteMarketSignal(db, productId, side, strictness);
  }
  return { signalsWritten, eligible: points.length >= 2 };
}

async function persistDerived(db: D1DatabaseLike, productId: number, variant: string, condition: string, currentPrice: number, updatedAt: string) {
  const points = await storedHistory(db, productId, variant, condition);
  return persistDerivedHistory(db, productId, variant, condition, currentPrice, points, "exact", updatedAt);
}

async function persistRecord(db: D1DatabaseLike, record: Card | SealedProduct, observedAt: string, asOfDate: string, runId: string) {
  if ("printing" in record) {
    await upsertCard(db, record, observedAt, runId);
    await upsertHistory(db, record.productId, record.printing, "Near Mint", [{ date: asOfDate, price: record.marketPrice }], observedAt, "tcgcsv-daily");
    const derived = await persistDerived(db, record.productId, record.printing, "Near Mint", record.marketPrice, observedAt);
    return { observationsWritten: 1, ...derived };
  }
  await upsertSealedProduct(db, record, observedAt, runId);
  if (record.marketPrice == null) return { observationsWritten: 0, signalsWritten: 0, eligible: false };
  await upsertHistory(db, record.productId, "Sealed", "Unopened", [{ date: asOfDate, price: record.marketPrice }], observedAt, "tcgcsv-daily");
  const derived = await persistDerived(db, record.productId, "Sealed", "Unopened", record.marketPrice, observedAt);
  return { observationsWritten: 1, ...derived };
}

export async function runDailyMarketIngestion(db: D1DatabaseLike, snapshot: DailyCatalogSnapshot, now = new Date()): Promise<DailyIngestionResult> {
  validateSnapshot(snapshot);
  const observedAt = now.toISOString(), asOfDate = observedAt.slice(0, 10), runId = `daily-market:${asOfDate}`;
  const recordsSeen = snapshot.cards.length + snapshot.sealed.length;
  const recordsRejected = Object.values(snapshot.rejected ?? {}).reduce((sum, count) => sum + count, 0);
  await startIngestion(db, runId, snapshot.source, observedAt, {
    schemaVersion: snapshot.schemaVersion,
    sourceUpdatedAt: snapshot.sourceUpdatedAt,
    stats: { rejected: snapshot.rejected ?? {}, duplicateDecisions: snapshot.duplicateDecisions?.length ?? 0 },
  });
  let recordsWritten = 0, observationsWritten = 0, signalsWritten = 0, signalEligibleProducts = 0;
  try {
    for (const card of snapshot.cards) {
      const derived = await persistRecord(db, card, observedAt, asOfDate, runId); recordsWritten++; observationsWritten += derived.observationsWritten;
      signalsWritten += derived.signalsWritten; if (derived.eligible) signalEligibleProducts++;
    }
    for (const product of snapshot.sealed) {
      const derived = await persistRecord(db, product, observedAt, asOfDate, runId); recordsWritten++; observationsWritten += derived.observationsWritten;
      signalsWritten += derived.signalsWritten; if (derived.eligible) signalEligibleProducts++;
    }
    const stats = { observationsWritten, signalsWritten, signalEligibleProducts };
    await completeIngestion(db, runId, "daily-market", observedAt, recordsSeen, recordsWritten, recordsRejected, snapshot.duplicateDecisions?.length ?? 0, stats);
    return { runId, recordsSeen, recordsWritten, ...stats };
  } catch (error) {
    await failIngestion(db, runId, new Date().toISOString(), error instanceof Error ? error.message : "Unknown ingestion failure");
    throw error;
  }
}

type BatchStats = { observationsWritten?: number; signalsWritten?: number; signalEligibleProducts?: number };
const parseBatchStats = (value: string | null | undefined): BatchStats => { try { return value ? JSON.parse(value) as BatchStats : {}; } catch { return {}; } };

export async function runDailyMarketIngestionBatch(db: D1DatabaseLike, snapshot: DailyCatalogSnapshot, options: { batchSize?: number; now?: Date } = {}): Promise<DailyIngestionBatchResult> {
  validateSnapshot(snapshot);
  const now = options.now ?? new Date(), observedAt = now.toISOString(), asOfDate = observedAt.slice(0, 10), runId = `daily-market:${asOfDate}`;
  const records = [...snapshot.cards, ...snapshot.sealed], total = records.length;
  const checkpoint = await readRefreshCursor(db, "daily-market-progress");
  const cursor = checkpoint?.ingestionRunId === runId ? Math.max(0, Math.min(total, Number(checkpoint.cursor) || 0)) : 0;
  const prior = checkpoint?.ingestionRunId === runId ? parseBatchStats(checkpoint.statsJson) : {};
  const batchSize = Math.max(1, Math.min(100, Math.floor(options.batchSize ?? 50)));
  if (cursor === 0) await startIngestion(db, runId, snapshot.source, observedAt, {
    schemaVersion: snapshot.schemaVersion,
    sourceUpdatedAt: snapshot.sourceUpdatedAt,
    stats: { rejected: snapshot.rejected ?? {}, duplicateDecisions: snapshot.duplicateDecisions?.length ?? 0 },
  });
  const batch = records.slice(cursor, cursor + batchSize);
  let recordsWritten = cursor, observationsWritten = prior.observationsWritten ?? 0, signalsWritten = prior.signalsWritten ?? 0, signalEligibleProducts = prior.signalEligibleProducts ?? 0;
  try {
    for (const record of batch) {
      const result = await persistRecord(db, record, observedAt, asOfDate, runId);
      recordsWritten++; observationsWritten += result.observationsWritten; signalsWritten += result.signalsWritten;
      if (result.eligible) signalEligibleProducts++;
    }
    const done = recordsWritten >= total, stats = { observationsWritten, signalsWritten, signalEligibleProducts };
    if (done) {
      const rejected = Object.values(snapshot.rejected ?? {}).reduce((sum, count) => sum + count, 0);
      await checkpointIngestion(db, runId, "daily-market-progress", total, recordsWritten, String(recordsWritten), stats);
      await completeIngestion(db, runId, "daily-market", new Date().toISOString(), total, recordsWritten, rejected, snapshot.duplicateDecisions?.length ?? 0, stats);
    } else await checkpointIngestion(db, runId, "daily-market-progress", total, recordsWritten, String(recordsWritten), stats);
    return { runId, recordsSeen: total, recordsWritten, ...stats, cursor: recordsWritten, total, done, processed: batch.length };
  } catch (error) {
    await failIngestion(db, runId, new Date().toISOString(), error instanceof Error ? error.message : "Unknown ingestion failure");
    throw error;
  }
}
