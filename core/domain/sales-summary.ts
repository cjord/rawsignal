import type { SalesActivity } from "./types.ts";

export type SalesSummary = {
  sales7: number | null;
  sales30: number | null;
  sales30Prior: number | null;
  throughDate: string | null;
  fetchedAt: string | null;
  bucketDays: number;
};

/** Whole source buckets, not interpolated daily counts. Prior 30D excludes recent 30D. */
export function summarizeSales(sales: SalesActivity, fetchedAt: string): SalesSummary | null {
  const buckets = [...sales.buckets].sort((a, b) => a.date.localeCompare(b.date));
  if (!buckets.length) return null;
  if (buckets.some(b => !Number.isInteger(b.quantity) || b.quantity < 0 || !Number.isFinite(Date.parse(b.date)))) return null;
  // Missing intervals are unknown, not zero-sales days. Decline a summary rather
  // than publish a partial count or double count duplicate bucket dates.
  if (buckets.some((b, i) => i > 0 && (Date.parse(b.date) - Date.parse(buckets[i - 1].date) !== 3 * 86_400_000))) return null;
  const throughDate = buckets.at(-1)!.date;
  const end = Date.parse(throughDate), day = 86_400_000;
  const sum = (from: number, to: number) => buckets.filter(b => {
    const age = (end - Date.parse(b.date)) / day;
    return age >= from && age < to;
  }).reduce((total, b) => total + b.quantity, 0);
  // A truncated response cannot establish a full window. Accept the last scheduled
  // 3-day bucket (rather than demanding a bucket exactly on each window boundary).
  const depth = (end - Date.parse(buckets[0].date)) / day + 3;
  return { sales7: depth >= 7 ? sum(0, 7) : null, sales30: depth >= 30 ? sum(0, 30) : null,
    sales30Prior: depth >= 60 ? sum(30, 60) : null, throughDate, fetchedAt, bucketDays: 3 };
}

export function salesFreshness(summary: SalesSummary, now = Date.now()) {
  if (!summary.throughDate || !summary.fetchedAt) return "unknown";
  const date = Date.parse(summary.throughDate), fetched = Date.parse(summary.fetchedAt);
  if (!Number.isFinite(date) || !Number.isFinite(fetched)) return "unknown";
  return now - Math.min(date, fetched) > 7 * 86_400_000 ? "stale" : "recent";
}

export function salesPeriodChange(summary: SalesSummary): number | null {
  return summary.sales30 != null && summary.sales30Prior != null && summary.sales30Prior > 0
    ? (summary.sales30 - summary.sales30Prior) / summary.sales30Prior * 100 : null;
}
