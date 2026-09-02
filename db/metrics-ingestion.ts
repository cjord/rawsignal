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

export type SeriesDef = { key: string; select: "index" | "median"; topN?: number; topPct?: number; floor: number; where: string };

const singlesBase = "p.kind='single' and o.variant=p.printing and o.condition='Near Mint' and o.market_cents>0";
// Cases are excluded from every sealed index (the Pokémon-cases decision, applied uniformly):
// a case is the same product as its display at a multiplier, so it double-counts the top.
const sealedBase = "p.kind='sealed' and o.market_cents>0 and p.product_type!='Cases'";

// Small cohorts (Riftbound/One Piece sealed) index the top ~66% of each date's observations
// (user decision 2026-08-28) instead of a fixed top-N — the baseline scales as the catalog
// grows, and a fixed N near the cohort size would degrade into a plain mean.
export const METRIC_SERIES: SeriesDef[] = [
  { key: "index:cards", select: "index", topN: 100, floor: 500, where: singlesBase },
  { key: "index:sealed", select: "index", topN: 50, floor: 100, where: sealedBase },
  { key: "index:pokemon-cards", select: "index", topN: 100, floor: 400, where: `${singlesBase} and p.game='pokemon'` },
  { key: "index:riftbound-cards", select: "index", topN: 50, floor: 100, where: `${singlesBase} and p.game='riftbound'` },
  { key: "index:pokemon-sealed", select: "index", topN: 50, floor: 300, where: `${sealedBase} and p.game='pokemon'` },
  { key: "index:riftbound-sealed", select: "index", topPct: 0.66, floor: 20, where: `${sealedBase} and p.game='riftbound'` },
  { key: "index:onepiece-sealed", select: "index", topPct: 0.66, floor: 12, where: `${sealedBase} and p.game='onepiece'` },
  { key: "median:pokemon-singles", select: "median", floor: 400, where: `${singlesBase} and p.game='pokemon'` },
  { key: "median:riftbound-singles", select: "median", floor: 100, where: `${singlesBase} and p.game='riftbound'` },
];

// SQLite window functions compute each date's ranked prices in one pass; the median is the
// mean of the middle one or two ranked values. Dates must observe at least 75% of the
// best-covered date's count — a sparse date understates even a top-N index because part of
// the true top was simply not observed that day.
function seriesSql(def: SeriesDef, dateFilter: string, seriesValue = "?") {
  const ranked = `select o.observed_date d, o.market_cents v,
      row_number() over (partition by o.observed_date order by o.market_cents desc) rn,
      count(*) over (partition by o.observed_date) total
    from price_observations o join catalog_products p on p.product_id=o.product_id
    where ${def.where}${dateFilter}`;
  const covered = `select d, v, rn, total, max(total) over () as maxTotal from (${ranked})`;
  const membership = def.topPct != null ? `rn <= max(1, cast(total * ${def.topPct} + 0.5 as integer))` : `rn <= ${def.topN}`;
  const filter = def.select === "index"
    ? `${membership} and total >= ${def.floor} and total >= 0.75 * maxTotal`
    : `total >= ${def.floor} and total >= 0.75 * maxTotal and (rn = (total + 1) / 2 or rn = total / 2 + 1)`;
  return `insert into market_daily_metrics (series, observed_date, value_cents, members)
    select ${seriesValue}, d, cast(round(avg(v)) as integer), ${def.select === "index" ? "count(*)" : "max(total)"} from (${covered}) where ${filter} group by d
    on conflict(series, observed_date) do update set value_cents=excluded.value_cents, members=excluded.members`;
}

// A production backfill has no ops adapter (ENVIRONMENT=production disables it), so new
// series seed through `wrangler d1 execute --remote --file` with fully-literal statements.
export function metricsBackfillStatements(series: SeriesDef[] = METRIC_SERIES): string[] {
  const dateFilter = " and o.observed_date>=date('now','-190 days')";
  return series.flatMap(def => [
    `delete from market_daily_metrics where series='${def.key}'`,
    seriesSql(def, dateFilter, `'${def.key}'`),
  ]);
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
    // Snapshot today's top signal boards (audit C3): the public track record can only start
    // accruing from the day the rows exist, so the daily rollup — which already runs once
    // after live ingestion completes — writes the top 100 per side at balanced strictness.
    await db.prepare(`insert into signal_history (observed_date, side, strictness, product_id, score, price_cents, rank)
      select ?, side, strictness, product_id, score, cents, rank from (
        select s.side, s.strictness, s.product_id, s.score, cp.market_cents cents,
          row_number() over (partition by s.side order by s.score desc, s.product_id) rank
        from market_signals s join current_prices cp on cp.product_id=s.product_id
        where s.strictness='balanced' and cp.market_cents is not null
      ) where rank <= 100
      on conflict(observed_date, side, product_id) do update set score=excluded.score, price_cents=excluded.price_cents, rank=excluded.rank`).bind(today).run();
    // Cohort statistics (todo P4): median 30-day change + rising-member breadth per
    // ladder cohort (set rung, then the game|rarity fallback rung), rebuilt whole each
    // rollup from market_metrics. Tomorrow's signal walk consumes them via
    // SignalContext.cohort — a day of trailing lag by design.
    await db.prepare("delete from cohort_stats").run();
    const rungKey = withSet => `p.kind||'|'||p.game||'|'||${withSet ? "p.set_name||'|'||" : ""}(case when p.kind='single' then coalesce(p.rarity,'?') else coalesce(p.product_type,'?') end)`;
    for (const withSet of [true, false]) {
      await db.prepare(`insert into cohort_stats (cohort_key, as_of_date, members, median_change30_bps, breadth_pct)
        select key, ?, max(n),
          cast(round(avg(bps) filter (where rn=(n+1)/2 or rn=(n+2)/2)) as integer),
          cast(round(100.0*sum(bps>0)/max(n)) as integer)
        from (
          select ${rungKey(withSet)} key, mm.change_30_bps bps,
            row_number() over (partition by ${rungKey(withSet)} order by mm.change_30_bps) rn,
            count(*) over (partition by ${rungKey(withSet)}) n
          from market_metrics mm join catalog_products p on p.product_id=mm.product_id
          where mm.change_30_bps is not null
        ) group by key having max(n)>=8
        on conflict(cohort_key) do update set as_of_date=excluded.as_of_date, members=excluded.members,
          median_change30_bps=excluded.median_change30_bps, breadth_pct=excluded.breadth_pct`).bind(today).run();
    }
    const cohorts = await db.prepare("select count(*) as n from cohort_stats").first<{ n: number }>();
    // Champion/challenger shadow (todo P1b): snapshot the v2 challenger's top-100 boards
    // the same way, into the parallel table — same day, same ranking rule, so forward
    // return differences are attributable to the model alone.
    await db.prepare(`insert into shadow_signal_history (observed_date, side, strictness, product_id, score, price_cents, rank)
      select ?, side, 'balanced', product_id, score, cents, rank from (
        select s.side, s.product_id, s.score, cp.market_cents cents,
          row_number() over (partition by s.side order by s.score desc, s.product_id) rank
        from shadow_signals s join current_prices cp on cp.product_id=s.product_id
        where cp.market_cents is not null
      ) where rank <= 100
      on conflict(observed_date, side, product_id) do update set score=excluded.score, price_cents=excluded.price_cents, rank=excluded.rank`).bind(today).run();
    const snapshots = await db.prepare("select count(*) as n from signal_history where observed_date=?").bind(today).first<{ n: number }>();
    const shadowSnapshots = await db.prepare("select count(*) as n from shadow_signal_history where observed_date=?").bind(today).first<{ n: number }>();
    await completeIngestion(db, runId, "metrics-rollup", new Date().toISOString(), series.length, rowsWritten, 0, 0, { mode: options.mode, seriesRows: rowsWritten, signalSnapshots: snapshots?.n ?? 0, shadowSnapshots: shadowSnapshots?.n ?? 0, cohorts: cohorts?.n ?? 0 });
    return { runId, mode: options.mode, series: series.length, seriesRows: rowsWritten, signalSnapshots: snapshots?.n ?? 0, shadowSnapshots: shadowSnapshots?.n ?? 0, cohorts: cohorts?.n ?? 0, done: true };
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
