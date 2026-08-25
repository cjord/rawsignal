import { deriveHistoryMetrics } from "../app/domain/history-metrics.ts";
import type { Card, PriceHistory, PricePoint, SealedProduct, SignalStrictness } from "../app/domain/types.ts";
import { marketSignal } from "../app/signal-utils.ts";
import {
  completeIngestion,
  deleteMarketSignal,
  failIngestion,
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
      await upsertCard(db, card, observedAt, runId); recordsWritten++;
      await upsertHistory(db, card.productId, card.printing, "Near Mint", [{ date: asOfDate, price: card.marketPrice }], observedAt, "tcgcsv-daily"); observationsWritten++;
      const derived = await persistDerived(db, card.productId, card.printing, "Near Mint", card.marketPrice, observedAt);
      signalsWritten += derived.signalsWritten; if (derived.eligible) signalEligibleProducts++;
    }
    for (const product of snapshot.sealed) {
      await upsertSealedProduct(db, product, observedAt, runId); recordsWritten++;
      if (product.marketPrice != null) {
        await upsertHistory(db, product.productId, "Sealed", "Unopened", [{ date: asOfDate, price: product.marketPrice }], observedAt, "tcgcsv-daily"); observationsWritten++;
        const derived = await persistDerived(db, product.productId, "Sealed", "Unopened", product.marketPrice, observedAt);
        signalsWritten += derived.signalsWritten; if (derived.eligible) signalEligibleProducts++;
      }
    }
    const stats = { observationsWritten, signalsWritten, signalEligibleProducts };
    await completeIngestion(db, runId, "daily-market", observedAt, recordsSeen, recordsWritten, recordsRejected, snapshot.duplicateDecisions?.length ?? 0, stats);
    return { runId, recordsSeen, recordsWritten, ...stats };
  } catch (error) {
    await failIngestion(db, runId, new Date().toISOString(), error instanceof Error ? error.message : "Unknown ingestion failure");
    throw error;
  }
}
