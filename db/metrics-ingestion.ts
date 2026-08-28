import { completeIngestion, failIngestion, startIngestion, type D1DatabaseLike } from "./repository.ts";

// Daily market-metrics rollup (docs/todo.md H3). Each series stores one value per observed
// date in market_daily_metrics:
// - Equal-weighted indexes: the mean of the top-N observed prices that date (rebalanced
//   daily by construction — membership is that date's top-N).
// - Medians: the per-date median across the whole cohort.
// A per-date observation floor keeps sparse backfill dates out (the composition rule from
// peer anchors): high-value products have the densest history, so a date observing fewer
// rows than the floor cannot be trusted to contain the true top of the market.
// The sealed index excludes Pokémon Cases, consistent with the related-sealed decision.

export type SeriesDef = { key: string; select: "index" | "median"; topN?: number; floor: number; where: string };

const singlesBase = "p.kind='single' and o.variant=p.printing and o.condition='Near Mint' and o.market_cents>0";
const sealedBase = "p.kind='sealed' and o.market_cents>0 and not (p.game='pokemon' and p.product_type='Cases')";

export const METRIC_SERIES: SeriesDef[] = [
  { key: "index:cards", select: "index", topN: 100, floor: 500, where: singlesBase },
  { key: "index:sealed", select: "index", topN: 50, floor: 100, where: sealedBase },
  { key: "index:pokemon-cards", select: "index", topN: 100, floor: 400, where: `${singlesBase} and p.game='pokemon'` },
  { key: "index:riftbound-cards", select: "index", topN: 50, floor: 100, where: `${singlesBase} and p.game='riftbound'` },
  { key: "median:pokemon-singles", select: "median", floor: 400, where: `${singlesBase} and p.game='pokemon'` },
  { key: "median:riftbound-singles", select: "median", floor: 100, where: `${singlesBase} and p.game='riftbound'` },
];

// SQLite window functions compute each date's ranked prices in one pass; the median is the
// mean of the middle one or two ranked values. Dates must observe at least 75% of the
// best-covered date's count — a sparse date understates even a top-N index because part of
// the true top was simply not observed that day.
function seriesSql(def: SeriesDef, dateFilter: string) {
  const ranked = `select o.observed_date d, o.market_cents v,
      row_number() over (partition by o.observed_date order by o.market_cents desc) rn,
      count(*) over (partition by o.observed_date) total
    from price_observations o join catalog_products p on p.product_id=o.product_id
    where ${def.where}${dateFilter}`;
  const covered = `select d, v, rn, total, max(total) over () as maxTotal from (${ranked})`;
  const filter = def.select === "index"
    ? `rn <= ${def.topN} and total >= ${def.floor} and total >= 0.75 * maxTotal`
    : `total >= ${def.floor} and total >= 0.75 * maxTotal and (rn = (total + 1) / 2 or rn = total / 2 + 1)`;
  return `insert into market_daily_metrics (series, observed_date, value_cents, members)
    select ?, d, cast(round(avg(v)) as integer), ${def.select === "index" ? "count(*)" : "max(total)"} from (${covered}) where ${filter} group by d
    on conflict(series, observed_date) do update set value_cents=excluded.value_cents, members=excluded.members`;
}

export async function runMetricsRollup(db: D1DatabaseLike, options: { mode: "daily" | "backfill"; now?: Date; series?: SeriesDef[] }) {
  const now = options.now ?? new Date(), startedAt = now.toISOString(), today = startedAt.slice(0, 10);
  const runId = `metrics-rollup:${today}`, series = options.series ?? METRIC_SERIES;
  // Daily mode re-rolls a trailing window (idempotent upserts): a rollup that ran before the
  // day's live ingestion finished, or a publish that crossed midnight, heals on the next tick.
  const dateFilter = options.mode === "daily" ? " and o.observed_date>=date('now','-3 days')" : " and o.observed_date>=date('now','-190 days')";
  await startIngestion(db, runId, "market-daily-metrics", startedAt, { stats: { mode: options.mode } });
  try {
    let rowsWritten = 0;
    for (const def of series) {
      // A backfill recomputes qualification from scratch: rows from previously qualifying
      // dates must not survive a stricter pass.
      if (options.mode === "backfill") await db.prepare("delete from market_daily_metrics where series=?").bind(def.key).run();
      await db.prepare(seriesSql(def, dateFilter)).bind(def.key).run();
      const count = await db.prepare("select count(*) as n from market_daily_metrics where series=?").bind(def.key).first<{ n: number }>();
      rowsWritten += count?.n ?? 0;
    }
    await completeIngestion(db, runId, "metrics-rollup", new Date().toISOString(), series.length, rowsWritten, 0, 0, { mode: options.mode, seriesRows: rowsWritten });
    return { runId, mode: options.mode, series: series.length, seriesRows: rowsWritten, done: true };
  } catch (error) {
    await failIngestion(db, runId, new Date().toISOString(), error instanceof Error ? error.message : "Unknown metrics rollup failure");
    throw error;
  }
}

export type MetricPoint = { date: string; value: number; members: number };

export async function readMetricSeries(db: D1DatabaseLike): Promise<Record<string, MetricPoint[]>> {
  const rows = (await db.prepare("select series, observed_date as date, value_cents as valueCents, members from market_daily_metrics order by series, observed_date").bind().all<{ series: string; date: string; valueCents: number; members: number }>()).results ?? [];
  const bySeries: Record<string, MetricPoint[]> = {};
  for (const row of rows) (bySeries[row.series] ??= []).push({ date: row.date, value: row.valueCents / 100, members: row.members });
  return bySeries;
}
