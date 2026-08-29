import type { GradedCardData } from "./domain/types.ts";

// One grade-compaction implementation for the graded feed sync (scripts/graded) and the
// Worker's D1 rotation (db/graded-ingestion) — previously duplicated verbatim.
export const money = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : null;
export const count = (value: unknown) => Number.isInteger(value) && (value as number) >= 0 ? value as number : null;

export function compactGrades(salesByGrade: unknown): GradedCardData["grades"] {
  const grades: GradedCardData["grades"] = {};
  if (typeof salesByGrade !== "object" || salesByGrade === null) return grades;
  for (const [key, stat] of Object.entries(salesByGrade as Record<string, unknown>)) {
    if (typeof stat !== "object" || stat === null) continue;
    const record = stat as Record<string, unknown>;
    const sales = count(record.count);
    if (!sales) continue;
    const smart = (record.smartMarketPrice ?? {}) as Record<string, unknown>;
    grades[key] = {
      count: sales,
      average: money(record.averagePrice),
      median: money(record.medianPrice),
      smartPrice: money(smart.price),
      confidence: typeof smart.confidence === "string" ? smart.confidence : null,
      trend: record.marketTrend === "up" || record.marketTrend === "down" ? record.marketTrend : null,
      lastSaleDate: typeof record.lastSaleDate === "string" ? record.lastSaleDate.slice(0, 10) : null,
    };
  }
  return grades;
}
