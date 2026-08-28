import { deriveHistoryMetrics } from "../domain/history-metrics.ts";
import { pokemonEra } from "../domain/eras.ts";
import { evRatio, packChaseEv } from "../domain/pack-ev.ts";
import type { PricePoint, PullRateConfig } from "../domain/types.ts";
import { pullRateFor } from "./catalog-repository.ts";
import { readMetricSeries, type MetricPoint } from "../../db/metrics-ingestion.ts";
import { publishedIngestion, type D1DatabaseLike } from "../../db/repository.ts";

// The /metrics payload (docs/todo.md H3/H4): materialized daily series plus same-day figures
// computed from current rows. Everything is null-honest — a market without a backing series
// reports null changes rather than an estimate. Rows carry game and kind so the client
// composes any scope (mode × market) without another request; ALL-scope aggregates are sums
// of these rows, with movement read from the combined index series.

export type MetricsOverviewRow = {
  key: string;
  label: string;
  game: string;
  kind: "single" | "sealed";
  trackedValue: number;
  products: number;
  change7: number | null;
  change30: number | null;
  change90: number | null;
};
export type MetricsSetRow = { set: string; game: string; trackedValue: number; medianPrice: number; cards: number; change30: number | null; sealedChange30: number | null; packPrice: number | null; packEv: number | null; evRatio: number | null };
export type MetricsCategoryRow = { category: string; game: string; trackedValue: number; medianPrice: number; products: number; change30: number | null };
export type MetricsEraRow = { era: string; trackedValue: number; cards: number; sets: number; change30: number | null };
export type MetricsMomentumRow = { game: string; kind: "single" | "sealed"; tracked: number; advancers7: number; decliners7: number; advancers30: number; decliners30: number; atHistoricHigh: number; atHistoricLow: number };
export type MetricsMover = { productId: number; name: string; set: string; game: string; kind: "single" | "sealed"; price: number; change: number; window: "7d" | "30d"; direction: "up" | "down" };
export type MetricsPayload = {
  generatedAt: string;
  rolledUpAt: string;
  series: Record<string, PricePoint[]>;
  overview: MetricsOverviewRow[];
  sets: MetricsSetRow[];
  sealedCategories: MetricsCategoryRow[];
  eras: MetricsEraRow[];
  momentum: MetricsMomentumRow[];
  movers: MetricsMover[];
};

const toPoints = (points: MetricPoint[] | undefined): PricePoint[] => (points ?? []).map(point => ({ date: point.date, price: point.value }));
const changes = (points: PricePoint[]) => {
  if (points.length < 2) return { change7: null, change30: null, change90: null };
  const metrics = deriveHistoryMetrics(points);
  return { change7: metrics.change7, change30: metrics.change30, change90: metrics.change90 };
};

// Sealed market_metrics rows are keyed by the history variant ("Sealed"), not a printing;
// the OR keeps the join exact for singles and permissive for the single sealed row.
const metricsJoin = "join market_metrics mm on mm.product_id=p.product_id and (mm.variant=p.printing or p.kind='sealed')";

type TotalsRow = { game: string; kind: "single" | "sealed"; totalCents: number; products: number };
type SetRow = { setName: string; game: string; totalCents: number; cards: number; medianCents: number; change30Bps: number | null };
type CategoryRow = { category: string; game: string; totalCents: number; products: number; medianCents: number; change30Bps: number | null };
type MomentumRow = { game: string; kind: "single" | "sealed"; tracked: number; advancers7: number; decliners7: number; advancers30: number; decliners30: number; atHigh: number; atLow: number };
type MoverRow = { productId: number; name: string; setName: string; game: string; kind: "single" | "sealed"; cents: number; changeBps: number; win: "7d" | "30d"; direction: "up" | "down" };

const gameLabel: Record<string, string> = { pokemon: "Pokémon", riftbound: "Riftbound", onepiece: "One Piece" };

// Pack EV inputs (audit Phase C / H1): the cheapest live booster-pack price per set, and
// per-set tier averages resolved through the same curated pull-rate rules the detail pages
// use. Shared by the metrics payload and the /api/set-ev feed the sealed view reads.
export async function loadSetEvData(db: D1DatabaseLike, pullRates?: PullRateConfig) {
  const packRows = (await db.prepare(`select p.set_name setName, min(cp.market_cents) packCents
      from catalog_products p join current_prices cp on cp.product_id=p.product_id
      where p.kind='sealed' and p.product_type='Booster Packs' and cp.market_cents > 0
      group by p.set_name`).bind().all<{ setName: string; packCents: number }>()).results ?? [];
  const packPriceBySet = new Map(packRows.map(row => [row.setName, row.packCents / 100]));
  const evBySet = new Map<string, number | null>();
  if (pullRates) {
    const tierRows = (await db.prepare(`select p.set_name setName, p.game, p.rarity, p.section, avg(cp.market_cents) avgCents, count(*) n
        from catalog_products p join current_prices cp on cp.product_id=p.product_id
        where p.kind='single' and cp.market_cents is not null
        group by p.set_name, p.game, p.rarity, p.section`).bind().all<{ setName: string; game: string; rarity: string; section: string | null; avgCents: number; n: number }>()).results ?? [];
    const tiersBySet = new Map<string, Map<string, { packsPerHit: number; weighted: number; count: number }>>();
    for (const row of tierRows) {
      const resolved = pullRateFor(pullRates, row.game, row.setName, { rarity: row.rarity, section: row.section ?? undefined });
      if (!resolved) continue;
      const tiers = tiersBySet.get(row.setName) ?? new Map();
      const tier = tiers.get(resolved.key) ?? { packsPerHit: resolved.packsPerHit, weighted: 0, count: 0 };
      tier.weighted += (row.avgCents / 100) * row.n;
      tier.count += row.n;
      tiers.set(resolved.key, tier);
      tiersBySet.set(row.setName, tiers);
    }
    for (const [setName, tiers] of tiersBySet) {
      evBySet.set(setName, packChaseEv([...tiers.values()].map(tier => ({ packsPerHit: tier.packsPerHit, averageMarket: tier.count ? tier.weighted / tier.count : null }))));
    }
  }
  return { packPriceBySet, evBySet };
}

export type SetEvRow = { set: string; packPrice: number | null; packEv: number | null; evRatio: number | null };

export async function loadSetEvRows(db: D1DatabaseLike, pullRates?: PullRateConfig): Promise<SetEvRow[]> {
  const { packPriceBySet, evBySet } = await loadSetEvData(db, pullRates);
  const sets = new Set([...packPriceBySet.keys(), ...evBySet.keys()]);
  return [...sets].map(set => {
    const packPrice = packPriceBySet.get(set) ?? null, packEv = evBySet.get(set) ?? null;
    return { set, packPrice, packEv, evRatio: evRatio(packEv, packPrice) };
  }).filter(row => row.packEv != null);
}

export async function loadMetricsPayload(db: D1DatabaseLike | undefined, options: { pullRates?: PullRateConfig } = {}): Promise<MetricsPayload | null> {
  if (!db) return null;
  const published = await publishedIngestion(db, "metrics-rollup").catch(() => null);
  if (!published) return null;
  const bySeries = await readMetricSeries(db);
  const series = Object.fromEntries(Object.entries(bySeries).map(([key, points]) => [key, toPoints(points)]));

  // Movement follows the per-game top-N index series: sparse backfill dates cover shifting
  // product populations, which skews a median but barely moves a top-of-market index (dense
  // history concentrates in exactly those products). Medians stay materialized for later use.
  const totals = (await db.prepare(`select p.game, p.kind, sum(cp.market_cents) as totalCents, count(*) as products
    from catalog_products p join current_prices cp on cp.product_id=p.product_id
    where cp.market_cents is not null group by p.game, p.kind`).bind().all<TotalsRow>()).results ?? [];
  const overview: MetricsOverviewRow[] = totals
    .filter(row => gameLabel[row.game])
    .map(row => ({
      key: `${row.game}-${row.kind === "single" ? "singles" : "sealed"}`,
      label: `${gameLabel[row.game]} ${row.kind === "single" ? "singles" : "sealed"}`,
      game: row.game,
      kind: row.kind,
      trackedValue: row.totalCents / 100,
      products: row.products,
      ...changes(series[`index:${row.game}-${row.kind === "single" ? "cards" : "sealed"}`] ?? []),
    }))
    .sort((a, b) => b.trackedValue - a.trackedValue);

  // Per-set median via the same middle-rank trick used by the rollup; 30D momentum is the
  // median of member cards' stored change_30_bps. Each game keeps its own top 30 so every
  // scope has a full table (the ALL view re-ranks the union by tracked value).
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
    ), sized as (
      select m.set_name as setName, m.game, m.totalCents, m.cards, m.medianCents,
        (select avg(b) from momentum mo where mo.set_name=m.set_name and (mo.rn=(mo.total+1)/2 or mo.rn=mo.total/2+1)) as change30Bps,
        row_number() over (partition by m.game order by m.totalCents desc) as gameRank
      from medians m
    )
    select setName, game, totalCents, cards, medianCents, change30Bps from sized where gameRank <= 30 order by totalCents desc`).bind().all<SetRow>()).results ?? [];

  // Sealed-vs-singles divergence (audit H2): each set's sealed products' median 30D change,
  // read the same middle-rank way as the singles momentum above.
  const sealedSetRows = (await db.prepare(`with momentum as (
      select p.set_name setName, mm.change_30_bps b,
        row_number() over (partition by p.set_name order by mm.change_30_bps) rn,
        count(*) over (partition by p.set_name) total
      from catalog_products p ${metricsJoin}
      where p.kind='sealed' and mm.change_30_bps is not null
    ) select setName, avg(b) as change30Bps from momentum where rn=(total+1)/2 or rn=total/2+1 group by setName`).bind().all<{ setName: string; change30Bps: number | null }>()).results ?? [];
  const sealedChangeBySet = new Map(sealedSetRows.map(row => [row.setName, row.change30Bps]));

  const { packPriceBySet, evBySet } = await loadSetEvData(db, options.pullRates);

  const sets: MetricsSetRow[] = setRows.map(row => {
    const packPrice = packPriceBySet.get(row.setName) ?? null;
    const packEv = evBySet.get(row.setName) ?? null;
    return {
      set: row.setName, game: row.game, trackedValue: row.totalCents / 100, medianPrice: row.medianCents / 100,
      cards: row.cards, change30: row.change30Bps == null ? null : row.change30Bps / 100,
      sealedChange30: (sealedChangeBySet.get(row.setName) ?? null) == null ? null : (sealedChangeBySet.get(row.setName) as number) / 100,
      packPrice, packEv, evRatio: evRatio(packEv, packPrice),
    };
  });

  // Sealed groups by product category — sets barely exist as a sealed concept.
  const categoryRows = (await db.prepare(`with ranked as (
      select p.product_type category, p.game, cp.market_cents v,
        row_number() over (partition by p.game, p.product_type order by cp.market_cents desc) rn,
        count(*) over (partition by p.game, p.product_type) total,
        sum(cp.market_cents) over (partition by p.game, p.product_type) sumv
      from catalog_products p join current_prices cp on cp.product_id=p.product_id
      where p.kind='sealed' and cp.market_cents is not null
    ), medians as (
      select category, game, max(total) products, max(sumv) totalCents, avg(v) medianCents
      from ranked where rn=(total+1)/2 or rn=total/2+1 group by game, category
    ), momentum as (
      select p.game, p.product_type category, mm.change_30_bps b,
        row_number() over (partition by p.game, p.product_type order by mm.change_30_bps) rn,
        count(*) over (partition by p.game, p.product_type) total
      from catalog_products p ${metricsJoin}
      where p.kind='sealed' and mm.change_30_bps is not null
    )
    select m.category, m.game, m.totalCents, m.products, m.medianCents,
      (select avg(b) from momentum mo where mo.game=m.game and mo.category=m.category and (mo.rn=(mo.total+1)/2 or mo.rn=mo.total/2+1)) as change30Bps
    from medians m order by m.totalCents desc`).bind().all<CategoryRow>()).results ?? [];
  const sealedCategories: MetricsCategoryRow[] = categoryRows.map(row => ({ category: row.category, game: row.game, trackedValue: row.totalCents / 100, medianPrice: row.medianCents / 100, products: row.products, change30: row.change30Bps == null ? null : row.change30Bps / 100 }));

  // Era performance (audit R2 / Phase D): every Pokémon set's totals and 30D median fold
  // into collector eras in JS (prefix + year mapping) — era momentum is the tracked-value-
  // weighted mean of member sets' median changes, honest to what each set contributes.
  const eraSetRows = (await db.prepare(`with totals as (
      select p.set_name setName, max(p.release_year) year, sum(cp.market_cents) totalCents, count(*) cards
      from catalog_products p join current_prices cp on cp.product_id=p.product_id
      where p.kind='single' and p.game='pokemon' and cp.market_cents is not null group by p.set_name
    ), momentum as (
      select p.set_name setName, mm.change_30_bps b,
        row_number() over (partition by p.set_name order by mm.change_30_bps) rn,
        count(*) over (partition by p.set_name) total
      from catalog_products p join market_metrics mm on mm.product_id=p.product_id and mm.variant=p.printing
      where p.kind='single' and p.game='pokemon' and mm.change_30_bps is not null
    )
    select t.setName, t.year, t.totalCents, t.cards,
      (select avg(b) from momentum mo where mo.setName=t.setName and (mo.rn=(mo.total+1)/2 or mo.rn=mo.total/2+1)) as change30Bps
    from totals t`).bind().all<{ setName: string; year: number | null; totalCents: number; cards: number; change30Bps: number | null }>()).results ?? [];
  const eraFold = new Map<string, { trackedValue: number; cards: number; sets: number; weighted: number; weight: number }>();
  for (const row of eraSetRows) {
    const era = pokemonEra(row.setName, row.year);
    const bucket = eraFold.get(era) ?? { trackedValue: 0, cards: 0, sets: 0, weighted: 0, weight: 0 };
    bucket.trackedValue += row.totalCents / 100;
    bucket.cards += row.cards;
    bucket.sets += 1;
    if (row.change30Bps != null) { bucket.weighted += (row.change30Bps / 100) * row.totalCents; bucket.weight += row.totalCents; }
    eraFold.set(era, bucket);
  }
  const eras: MetricsEraRow[] = [...eraFold.entries()].map(([era, bucket]) => ({
    era, trackedValue: bucket.trackedValue, cards: bucket.cards, sets: bucket.sets,
    change30: bucket.weight > 0 ? bucket.weighted / bucket.weight : null,
  }));

  const momentumRows = (await db.prepare(`select p.game, p.kind, count(*) as tracked,
      sum(case when mm.change_7_bps > 0 then 1 else 0 end) as advancers7,
      sum(case when mm.change_7_bps < 0 then 1 else 0 end) as decliners7,
      sum(case when mm.change_30_bps > 0 then 1 else 0 end) as advancers30,
      sum(case when mm.change_30_bps < 0 then 1 else 0 end) as decliners30,
      sum(case when mm.historic_high_cents is not null and cp.market_cents >= mm.historic_high_cents then 1 else 0 end) as atHigh,
      sum(case when mm.historic_low_cents is not null and cp.market_cents <= mm.historic_low_cents then 1 else 0 end) as atLow
    from catalog_products p
    join current_prices cp on cp.product_id=p.product_id
    ${metricsJoin}
    where cp.market_cents is not null group by p.game, p.kind`).bind().all<MomentumRow>()).results ?? [];
  const momentum: MetricsMomentumRow[] = momentumRows.map(row => ({
    game: row.game, kind: row.kind, tracked: row.tracked ?? 0,
    advancers7: row.advancers7 ?? 0, decliners7: row.decliners7 ?? 0,
    advancers30: row.advancers30 ?? 0, decliners30: row.decliners30 ?? 0,
    atHistoricHigh: row.atHigh ?? 0, atHistoricLow: row.atLow ?? 0,
  }));

  // Movers: each scope's top gainers and decliners per window, floored at $10 singles /
  // $20 sealed on BOTH ends of the move — the implied prior price must clear the floor too,
  // or a $2 listing flipping to $89 tops the list as "+4,344%" (repricing noise, not market).
  // Moves beyond 4x (7D) / 6x (30D) in either direction are excluded for the same reason:
  // at those magnitudes the "move" is listing turnover, not the market repricing a product.
  const moverRows = (await db.prepare(`with eligible as (
      select p.product_id productId, p.name, p.set_name setName, p.game, p.kind, cp.market_cents cents,
        mm.change_7_bps c7, mm.change_30_bps c30,
        case when p.kind='sealed' then 2000 else 1000 end floorCents
      from catalog_products p
      join current_prices cp on cp.product_id=p.product_id
      ${metricsJoin}
      where cp.market_cents >= case when p.kind='sealed' then 2000 else 1000 end
    ), sevens as (
      select *, row_number() over (partition by game, kind order by c7 desc) up, row_number() over (partition by game, kind order by c7 asc) down
      from eligible where c7 is not null and c7 != 0 and c7 between -7500 and 30000 and cents / (1.0 + c7 / 10000.0) >= floorCents
    ), thirties as (
      select *, row_number() over (partition by game, kind order by c30 desc) up, row_number() over (partition by game, kind order by c30 asc) down
      from eligible where c30 is not null and c30 != 0 and c30 between -8333 and 50000 and cents / (1.0 + c30 / 10000.0) >= floorCents
    )
    select productId, name, setName, game, kind, cents, c7 as changeBps, '7d' as win, case when up <= 8 and c7 > 0 then 'up' else 'down' end as direction
      from sevens where (up <= 8 and c7 > 0) or (down <= 8 and c7 < 0)
    union all
    select productId, name, setName, game, kind, cents, c30, '30d', case when up <= 8 and c30 > 0 then 'up' else 'down' end
      from thirties where (up <= 8 and c30 > 0) or (down <= 8 and c30 < 0)`).bind().all<MoverRow>()).results ?? [];
  const movers: MetricsMover[] = moverRows.map(row => ({
    productId: row.productId, name: row.name, set: row.setName, game: row.game, kind: row.kind,
    price: row.cents / 100, change: row.changeBps / 100, window: row.win, direction: row.direction,
  }));

  return { generatedAt: new Date().toISOString(), rolledUpAt: published.lastSuccessAt, series, overview, sets, sealedCategories, eras, momentum, movers };
}
