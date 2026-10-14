import { deriveHistoryMetrics, normalizePricePoints } from "./history-metrics.ts";
import type { Card, PriceHistory, PricePoint, RowMetrics, SealedProduct } from "./types.ts";
import { historyBatchKey } from "../history-batch.ts";

const rounded = (value: number | null) => value == null ? null : Math.round(value * 100) / 100;

// Non-security content identity: a repeated ingestion of identical data keeps its version.
function fingerprint(value: string): string {
  let hash = 2166136261, second = 5381;
  for (let index = 0; index < value.length; index++) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
    second = Math.imul(second, 33) ^ value.charCodeAt(index);
  }
  return [hash, second].map(part => (part >>> 0).toString(16).padStart(8, "0")).join("");
}

export function createHistorySnapshot(points: PricePoint[], variant: string, condition: string, coverage: PriceHistory["coverage"]): PriceHistory {
  points = normalizePricePoints(points).map(point => ({ ...point, price: rounded(point.price)! }));
  const metrics = deriveHistoryMetrics(points);
  const history: PriceHistory = { points, variant, condition, coverage, ...Object.fromEntries(Object.entries(metrics).map(([key, value]) => [key, rounded(value)])) } as PriceHistory;
  const asOfDate = points.at(-1)?.date;
  const cutoff = asOfDate ? Date.parse(`${asOfDate}T00:00:00Z`) - 365 * 86400000 : 0;
  // Every chart supports at most 1Y. Retain its real at-or-before baseline, not all
  // older points; all-time extrema above still use the complete durable series.
  const baseline = [...points].reverse().find(point => Date.parse(`${point.date}T00:00:00Z`) < cutoff);
  const chartPoints = points.filter(point => Date.parse(`${point.date}T00:00:00Z`) >= cutoff);
  return { ...history, points: baseline ? [baseline, ...chartPoints] : chartPoints, asOfDate,
    snapshotId: `v1-${asOfDate ?? "empty"}-${fingerprint(JSON.stringify(history))}` };
}

// Compact storage only; the public contract still uses named point fields.
export const serializeHistorySnapshot = (history: PriceHistory) => JSON.stringify({ ...history, points: undefined, pointRows: history.points.map(point => [point.date, point.price]) });

export const emptyHistory: PriceHistory = { points: [], coverage: "none", change7: null, change30: null, change90: null, low30: null, high30: null, historyLow: null, historyHigh: null };

// A chart may enrich the row only with the exact version its metrics describe. Legacy
// metric blocks without a version retain their values but cannot claim matching points.
export function matchingRowHistory(metrics: RowMetrics | undefined, loaded: PriceHistory | undefined): PriceHistory | undefined {
  if (!metrics) return loaded;
  const matches = metrics.snapshotId && loaded?.snapshotId === metrics.snapshotId;
  return { ...(matches ? loaded : emptyHistory), change7: metrics.change7, change30: metrics.change30, low30: metrics.low30, high30: metrics.high30,
    snapshotId: metrics.snapshotId, asOfDate: metrics.asOfDate };
}

export function rowHistoryTarget(item: Pick<Card | SealedProduct, "productId" | "metrics"> & { printing?: string }) {
  return { productId: item.productId, printing: item.printing ?? "Sealed", ...(!item.printing ? { sealed: true } : {}),
    snapshotId: item.metrics?.snapshotId ?? "unavailable" };
}

export const loadedRowHistory = (history: Record<string, PriceHistory>, item: Parameters<typeof rowHistoryTarget>[0]) => history[historyBatchKey(rowHistoryTarget(item))];
