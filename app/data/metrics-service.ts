import { deriveHistoryMetrics } from "../domain/history-metrics.ts";
import type { PricePoint } from "../domain/types.ts";
import { readMetricSeries, type MetricPoint } from "../../db/metrics-ingestion.ts";
import { publishedIngestion, type D1DatabaseLike } from "../../db/repository.ts";

// The /metrics payload (docs/todo.md H3): materialized daily series plus same-day figures
// computed from current rows. Everything is null-honest — a market without a backing series
// reports null changes rather than an estimate.

export type MetricsOverviewRow = {
  key: string;
  label: string;
  trackedValue: number;
  products: number;
  change7: number | null;
  change30: number | null;
  change90: number | null;
  breakdown: string | null;
};
export type MetricsSetRow = { set: string; game: string; trackedValue: number; medianPrice: number; cards: number; change30: number | null };
export type MetricsMomentum = { tracked: number; advancers7: number; decliners7: number; advancers30: number; decliners30: number; atHistoricHigh: number; atHistoricLow: number };
export type MetricsPayload = {
  generatedAt: string;
  rolledUpAt: string;
  series: Record<string, PricePoint[]>;
  overview: MetricsOverviewRow[];
  sets: MetricsSetRow[];
  momentum: MetricsMomentum;
};

const toPoints = (points: MetricPoint[] | undefined): PricePoint[] => (points ?? []).map(point => ({ date: point.date, price: point.value }));
const changes = (points: PricePoint[]) => {
  if (points.length < 2) return { change7: null, change30: null, change90: null };
  const metrics = deriveHistoryMetrics(points);
  return { change7: metrics.change7, change30: metrics.change30, change90: metrics.change90 };
};

type TotalsRow = { game: string; kind: string; totalCents: number; products: number };
type SetRow = { setName: string; game: string; totalCents: number; cards: number; medianCents: number; change30Bps: number | null };
type MomentumRow = { tracked: number; advancers7: number; decliners7: number; advancers30: number; decliners30: number; atHigh: number; atLow: number };

export async function loadMetricsPayload(db: D1DatabaseLike | undefined): Promise<MetricsPayload | null> {
  if (!db) return null;
  const published = await publishedIngestion(db, "metrics-rollup").catch(() => null);
  if (!published) return null;
  const bySeries = await readMetricSeries(db);
  const series = Object.fromEntries(Object.entries(bySeries).map(([key, points]) => [key, toPoints(points)]));

  const totals = (await db.prepare(`select p.game, p.kind, sum(cp.market_cents) as totalCents, count(*) as products
    from catalog_products p join current_prices cp on cp.product_id=p.product_id
    where cp.market_cents is not null group by p.game, p.kind`).bind().all<TotalsRow>()).results ?? [];
  const total = (game: string, kind: string) => totals.find(row => row.game === game && row.kind === kind);
  const sealedRows = totals.filter(row => row.kind === "sealed");
  const gameLabel: Record<string, string> = { pokemon: "Pokémon", riftbound: "Riftbound", onepiece: "One Piece" };
  const usd = (cents: number) => `$${Math.round(cents / 100).toLocaleString()}`;
  // Movement follows the per-game top-N index series: sparse backfill dates cover shifting
  // card populations, which skews a median but barely moves a top-of-market index (dense
  // history concentrates in exactly those cards). Medians stay materialized for later use.
  const overview: MetricsOverviewRow[] = [
    { key: "pokemon-singles", label: "Pokémon singles", trackedValue: (total("pokemon", "single")?.totalCents ?? 0) / 100, products: total("pokemon", "single")?.products ?? 0, ...changes(series["index:pokemon-cards"] ?? []), breakdown: null },
    { key: "riftbound-singles", label: "Riftbound singles", trackedValue: (total("riftbound", "single")?.totalCents ?? 0) / 100, products: total("riftbound", "single")?.products ?? 0, ...changes(series["index:riftbound-cards"] ?? []), breakdown: null },
    { key: "sealed", label: "Sealed (all games)", trackedValue: sealedRows.reduce((sum, row) => sum + row.totalCents, 0) / 100, products: sealedRows.reduce((sum, row) => sum + row.products, 0), ...changes(series["index:sealed"] ?? []), breakdown: sealedRows.map(row => `${gameLabel[row.game] ?? row.game} ${usd(row.totalCents)}`).join(" · ") || null },
  ];

  // Per-set median via the same middle-rank trick used by the rollup; 30D momentum is the
  // median of member cards' stored change_30_bps.
  const setRows = (await db.prepare(`with ranked as (
      select p.set_name, p.game, cp.market_cents v,
        row_number() over (partition by p.set_name order by cp.market_cents desc) rn,
        count(*) over (partition by p.set_name) total,
        sum(cp.market_cents) over (partition by p.set_name) sumv
      from catalog_products p join current_prices cp on cp.product_id=p.product_id
      where p.kind='single' and cp.market_cents is not null
    ), medians as (
      select set_name, game, max(total) cards, max(sumv) totalCents, avg(v) medianCents
      from ranked where rn=(total+1)/2 or rn=total/2+1 group by set_name, game
    ), momentum as (
      select p.set_name, mm.change_30_bps b,
        row_number() over (partition by p.set_name order by mm.change_30_bps) rn,
        count(*) over (partition by p.set_name) total
      from catalog_products p join market_metrics mm on mm.product_id=p.product_id and mm.variant=p.printing
      where p.kind='single' and mm.change_30_bps is not null
    )
    select m.set_name as setName, m.game, m.totalCents, m.cards, m.medianCents,
      (select avg(b) from momentum mo where mo.set_name=m.set_name and (mo.rn=(mo.total+1)/2 or mo.rn=mo.total/2+1)) as change30Bps
    from medians m order by m.totalCents desc limit 30`).bind().all<SetRow>()).results ?? [];
  const sets: MetricsSetRow[] = setRows.map(row => ({ set: row.setName, game: row.game, trackedValue: row.totalCents / 100, medianPrice: row.medianCents / 100, cards: row.cards, change30: row.change30Bps == null ? null : row.change30Bps / 100 }));

  const momentumRow = await db.prepare(`select count(*) as tracked,
      sum(case when mm.change_7_bps > 0 then 1 else 0 end) as advancers7,
      sum(case when mm.change_7_bps < 0 then 1 else 0 end) as decliners7,
      sum(case when mm.change_30_bps > 0 then 1 else 0 end) as advancers30,
      sum(case when mm.change_30_bps < 0 then 1 else 0 end) as decliners30,
      sum(case when mm.historic_high_cents is not null and cp.market_cents >= mm.historic_high_cents then 1 else 0 end) as atHigh,
      sum(case when mm.historic_low_cents is not null and cp.market_cents <= mm.historic_low_cents then 1 else 0 end) as atLow
    from catalog_products p
    join current_prices cp on cp.product_id=p.product_id
    join market_metrics mm on mm.product_id=p.product_id and mm.variant=p.printing
    where p.kind='single' and cp.market_cents is not null`).bind().first<MomentumRow>();
  const momentum: MetricsMomentum = {
    tracked: momentumRow?.tracked ?? 0,
    advancers7: momentumRow?.advancers7 ?? 0,
    decliners7: momentumRow?.decliners7 ?? 0,
    advancers30: momentumRow?.advancers30 ?? 0,
    decliners30: momentumRow?.decliners30 ?? 0,
    atHistoricHigh: momentumRow?.atHigh ?? 0,
    atHistoricLow: momentumRow?.atLow ?? 0,
  };

  return { generatedAt: new Date().toISOString(), rolledUpAt: published.lastSuccessAt, series, overview, sets, momentum };
}
