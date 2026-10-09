import { normalizePricePoints } from "./history-metrics.ts";
import type { PricePoint } from "./types.ts";
import { setSlug } from "./formatters.ts";

export const HEATMAP_WINDOWS = [7, 30, 90] as const;
export type HeatmapWindow = typeof HEATMAP_WINDOWS[number];
// A sparse but nonzero eligible subset may describe a set if its limited coverage is disclosed.
export const HEATMAP_COVERAGE_POLICY = { minMembers: 1, minCoverage: 0.05 } as const;
export const HEATMAP_COVERAGE_WARNING = 0.6;
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

// Section keys deliberately match the Singles URL filter. Catalog membership has
// already applied the game's exclusion policy; a section is never inferred from rarity.
export const HEATMAP_TIERS = {
  pokemon: [
    ["vintage", "Vintage / base"], ["double-rares", "Double Rare"],
    ["ultra-rares", "Ultra Rare"], ["illustration-rares", "Illustration Rare"],
    ["special-illustration-rares", "Special Illustration Rare"],
    ["secret-hyper-rares", "Secret / Hyper"], ["shiny-radiant-rares", "Shiny / Radiant"],
    ["promos", "Promos"], ["japanese-promos", "Japanese promos"],
  ],
  riftbound: [
    ["riftbound-commons", "Common"], ["riftbound-uncommons", "Uncommon"],
    ["rares", "Rare"], ["epics", "Epic"], ["alt-arts", "Alt art"],
    ["riftbound-showcases", "Showcase"], ["overnumbered", "Overnumbered"],
    ["signatures", "Signature"], ["riftbound-promos", "Tournament / judge"],
    ["metal-promos", "Metal / Best Of"], ["riftbound-foreign-promos", "Foreign exclusive"],
  ],
} as const;

export type HeatmapGame = keyof typeof HEATMAP_TIERS;
export type HeatmapMember = {
  productId: number;
  game: HeatmapGame;
  set: string;
  section: string;
  latest: PricePoint | null;
  baseline7: PricePoint | null;
  baseline30: PricePoint | null;
  baseline90: PricePoint | null;
};
export type SetHeatmapRow = {
  game: HeatmapGame;
  set: string;
  slug: string;
  cells: Record<string, Record<HeatmapWindow, HeatmapCell>>;
};
export type SetHeatmapPayload = { asOfDate: string; rows: SetHeatmapRow[] };

export function buildSetHeatmap(members: readonly HeatmapMember[], asOfDate: string): SetHeatmapPayload {
  const rows = new Map<string, { game: HeatmapGame; set: string; members: HeatmapMember[] }>();
  for (const member of members) {
    const key = `${member.game}\u0000${member.set}`;
    const group = rows.get(key) ?? { game: member.game, set: member.set, members: [] };
    group.members.push(member);
    rows.set(key, group);
  }
  const policy = { maxLatestAgeDays: 2, maxCutoffGapDays: 3 };
  return { asOfDate, rows: [...rows.values()].map(row => {
    const cells: SetHeatmapRow["cells"] = {};
    for (const section of ["all", ...HEATMAP_TIERS[row.game].map(([key]) => key)]) {
      const subset = section === "all" ? row.members : row.members.filter(member => member.section === section);
      cells[section] = {} as Record<HeatmapWindow, HeatmapCell>;
      for (const window of HEATMAP_WINDOWS) {
        const changes = subset.map(member => {
          const baseline = member[`baseline${window}`];
          return heatmapReturn([baseline, member.latest].filter((point): point is PricePoint => point != null), window, asOfDate, policy).change;
        });
        cells[section][window] = summarizeHeatmapCell(changes, HEATMAP_COVERAGE_POLICY);
      }
    }
    return { game: row.game, set: row.set, slug: setSlug(row.set), cells };
  }) };
}
