import { normalizePricePoints } from "./history-metrics.ts";
import type { PricePoint } from "./types.ts";

export const HEATMAP_WINDOWS = [7, 30, 90] as const;
export type HeatmapWindow = typeof HEATMAP_WINDOWS[number];
// User decision 2026-10-09: show 1–2 eligible members with a warning, at 60% coverage.
export const HEATMAP_COVERAGE_POLICY = { minMembers: 1, minCoverage: 0.6 } as const;
export type HeatmapUnavailable = "no-history" | "stale" | "insufficient-history" | "cutoff-gap";
export type HeatmapReturn = {
  change: number | null;
  reason: HeatmapUnavailable | null;
  latestDate: string | null;
  baselineDate: string | null;
};

const DAY_MS = 86_400_000;
function dateMs(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : NaN;
}

/** Explicit policy: callers must choose freshness tolerances; never use response time. */
export function heatmapReturn(
  input: PricePoint[], window: HeatmapWindow, asOfDate: string,
  policy: { maxLatestAgeDays: number; maxCutoffGapDays: number },
): HeatmapReturn {
  const asOf = dateMs(asOfDate);
  if (!Number.isFinite(asOf)) throw new Error("Heatmap requires a valid source date");
  for (const limit of [policy.maxLatestAgeDays, policy.maxCutoffGapDays]) {
    if (!Number.isFinite(limit) || limit < 0) throw new Error("Invalid heatmap freshness policy");
  }
  const points = normalizePricePoints(input.filter(point =>
    Number.isFinite(dateMs(point.date)) && dateMs(point.date) <= asOf && point.price > 0));
  const latest = points.at(-1);
  const cutoff = asOf - window * DAY_MS;
  const baseline = [...points].reverse().find(point => dateMs(point.date) <= cutoff);
  const result = { latestDate: latest?.date ?? null, baselineDate: baseline?.date ?? null };
  const unavailable = (reason: HeatmapUnavailable): HeatmapReturn => ({ ...result, change: null, reason });
  if (!latest) return unavailable("no-history");
  if (asOf - dateMs(latest.date) > policy.maxLatestAgeDays * DAY_MS) return unavailable("stale");
  if (!baseline) return unavailable("insufficient-history");
  if (cutoff - dateMs(baseline.date) > policy.maxCutoffGapDays * DAY_MS) return unavailable("cutoff-gap");
  const change = (latest.price - baseline.price) / baseline.price * 100;
  return Number.isFinite(change) ? { ...result, change, reason: null } : unavailable("no-history");
}

export type HeatmapCell = {
  change: number | null;
  total: number;
  eligible: number;
  coverage: number;
  smallSample: boolean;
  reason: "not-applicable" | "no-history" | "low-coverage" | "small-sample" | null;
};

/** Input has one entry per distinct tracked printing, including null/unavailable members.
 * All-tracked cells must receive member returns, never already-aggregated tier medians.
 */
export function summarizeHeatmapCell(
  changes: readonly (number | null)[],
  policy: { minMembers: number; minCoverage: number },
): HeatmapCell {
  if (!Number.isInteger(policy.minMembers) || policy.minMembers < 1 ||
      !Number.isFinite(policy.minCoverage) || policy.minCoverage < 0 || policy.minCoverage > 1) {
    throw new Error("Invalid heatmap coverage policy");
  }
  const usable = changes.filter((value): value is number => value != null && Number.isFinite(value)).sort((a, b) => a - b);
  const total = changes.length, eligible = usable.length, coverage = total ? eligible / total : 0;
  const reason = !total ? "not-applicable" : !eligible ? "no-history" :
    coverage < policy.minCoverage ? "low-coverage" : eligible < policy.minMembers ? "small-sample" : null;
  const middle = Math.floor(eligible / 2);
  const change = reason ? null : eligible % 2 ? usable[middle] : usable[middle - 1] / 2 + usable[middle] / 2;
  return { change, total, eligible, coverage, smallSample: eligible > 0 && eligible < 3, reason };
}
