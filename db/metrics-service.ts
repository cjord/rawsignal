import { deriveHistoryMetrics } from "../core/domain/history-metrics.ts";
import { pokemonEra } from "../core/domain/eras.ts";
import { evRatio, packChaseEv } from "../core/domain/pack-ev.ts";
import type { PricePoint, PullRateConfig } from "../core/domain/types.ts";
import { pullRateFor } from "../core/catalog-repository.ts";
import { readMetricSeries, type MetricPoint } from "./metrics-ingestion.ts";
import { publishedIngestion, type D1DatabaseLike } from "./repository.ts";

// The /metrics service (docs/todo.md H3/H4): materialized daily series plus same-day
// figures computed from current rows — the largest SQL surface in the repo, so it lives
// with the rest of the SQL (decision D4). The payload shapes are core domain contracts.
import type { MetricsCategoryRow, MetricsEraRow, MetricsMomentumRow, MetricsMover, MetricsOverviewRow, MetricsPayload, MetricsSetRow } from "../core/domain/metrics.ts";
export * from "../core/domain/metrics.ts";

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
type CategoryRow = { category: string; game: string; totalCents: number; products: number; medianCents: number; change7Bps: number | null; change30Bps: number | null; change90Bps: number | null };
type MomentumRow = { game: string; kind: "single" | "sealed"; tracked: number; advancers7: number; decliners7: number; advancers30: number; decliners30: number; atHigh: number; atLow: number };
type MoverRow = { productId: number; name: string; setName: string; game: string; kind: "single" | "sealed"; printing: string | null; image: string | null; cents: number; midCents: number | null; changeBps: number; win: "7d" | "30d" | "90d"; direction: "up" | "down" };

const gameLabel: Record<string, string> = { pokemon: "Pokémon", riftbound: "Riftbound", onepiece: "One Piece" };

// Pack EV inputs (audit Phase C / H1): the cheapest live booster-pack price per set, and
// per-set tier averages resolved through the same curated pull-rate rules the detail pages
// use. Shared by the metrics payload and the /api/set-ev feed the sealed view reads.
// Set names collide across games ("Unleashed" is both an HGSS Pokémon set and a
// Riftbound set — live since D3 put riftbound packs in the shared Booster Packs
// bucket), so every per-set map in this module is keyed `${game}|${set}`.
const gameSetKey = (game: string, set: string) => `${game}|${set}`;

export async function loadSetEvData(db: D1DatabaseLike, pullRates?: PullRateConfig) {
  const packRows = (await db.prepare(`select p.game, p.set_name setName, min(cp.market_cents) packCents
      from catalog_products p join current_prices cp on cp.product_id=p.product_id
      where p.kind='sealed' and p.product_type='Booster Packs' and cp.market_cents > 0
      group by p.game, p.set_name`).bind().all<{ game: string; setName: string; packCents: number }>()).results ?? [];
  const packPriceBySet = new Map(packRows.map(row => [gameSetKey(row.game, row.setName), row.packCents / 100]));
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
      const key = gameSetKey(row.game, row.setName);
      const tiers = tiersBySet.get(key) ?? new Map();
      const tier = tiers.get(resolved.key) ?? { packsPerHit: resolved.packsPerHit, weighted: 0, count: 0 };
      tier.weighted += (row.avgCents / 100) * row.n;
      tier.count += row.n;
      tiers.set(resolved.key, tier);
      tiersBySet.set(key, tiers);
    }
    for (const [key, tiers] of tiersBySet) {
      evBySet.set(key, packChaseEv([...tiers.values()].map(tier => ({ packsPerHit: tier.packsPerHit, averageMarket: tier.count ? tier.weighted / tier.count : null }))));
    }
  }
  return { packPriceBySet, evBySet };
}

export type SetEvRow = { game: string; set: string; packPrice: number | null; packEv: number | null; evRatio: number | null };

export async function loadSetEvRows(db: D1DatabaseLike, pullRates?: PullRateConfig): Promise<SetEvRow[]> {
  const { packPriceBySet, evBySet } = await loadSetEvData(db, pullRates);
  const keys = new Set([...packPriceBySet.keys(), ...evBySet.keys()]);
  return [...keys].map(key => {
    const game = key.slice(0, key.indexOf("|")), set = key.slice(key.indexOf("|") + 1);
    const packPrice = packPriceBySet.get(key) ?? null, packEv = evBySet.get(key) ?? null;
    return { game, set, packPrice, packEv, evRatio: evRatio(packEv, packPrice) };
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
        row_number() over (partition by p.game, p.set_name order by cp.market_cents desc) rn,
        count(*) over (partition by p.game, p.set_name) total,
        sum(cp.market_cents) over (partition by p.game, p.set_name) sumv
      from catalog_products p join current_prices cp on cp.product_id=p.product_id
      where p.kind='single' and cp.market_cents is not null
    ), medians as (
      select set_name, game, max(total) cards, max(sumv) totalCents, avg(v) medianCents
      from ranked where rn=(total+1)/2 or rn=total/2+1 group by set_name, game
    ), momentum as (
      select p.set_name, p.game, mm.change_30_bps b,
        row_number() over (partition by p.game, p.set_name order by mm.change_30_bps) rn,
        count(*) over (partition by p.game, p.set_name) total
      from catalog_products p join market_metrics mm on mm.product_id=p.product_id and mm.variant=p.printing
      where p.kind='single' and mm.change_30_bps is not null
    ), setChange as (
      -- Aggregated once and joined: a correlated subselect against a window CTE re-evaluates
      -- the whole window per outer row in SQLite, which turned this payload pathological.
      select set_name, game, avg(b) as change30Bps from momentum where rn=(total+1)/2 or rn=total/2+1 group by set_name, game
    ), sized as (
      select m.set_name as setName, m.game, m.totalCents, m.cards, m.medianCents, c.change30Bps,
        row_number() over (partition by m.game order by m.totalCents desc) as gameRank
      from medians m left join setChange c on c.set_name=m.set_name and c.game=m.game
    )
    select setName, game, totalCents, cards, medianCents, change30Bps from sized where gameRank <= 50 order by totalCents desc`).bind().all<SetRow>()).results ?? [];

  // Sealed-vs-singles divergence (audit H2): each set's sealed products' median 30D change,
  // read the same middle-rank way as the singles momentum above.
  const sealedSetRows = (await db.prepare(`with momentum as (
      select p.set_name setName, p.game, mm.change_30_bps b,
        row_number() over (partition by p.game, p.set_name order by mm.change_30_bps) rn,
        count(*) over (partition by p.game, p.set_name) total
      from catalog_products p ${metricsJoin}
      where p.kind='sealed' and mm.change_30_bps is not null
    ) select setName, game, avg(b) as change30Bps from momentum where rn=(total+1)/2 or rn=total/2+1 group by setName, game`).bind().all<{ setName: string; game: string; change30Bps: number | null }>()).results ?? [];
  const sealedChangeBySet = new Map(sealedSetRows.map(row => [gameSetKey(row.game, row.setName), row.change30Bps]));

  const { packPriceBySet, evBySet } = await loadSetEvData(db, options.pullRates);

  const sets: MetricsSetRow[] = setRows.map(row => {
    const key = gameSetKey(row.game, row.setName);
    const packPrice = packPriceBySet.get(key) ?? null;
    const packEv = evBySet.get(key) ?? null;
    return {
      set: row.setName, game: row.game, trackedValue: row.totalCents / 100, medianPrice: row.medianCents / 100,
      cards: row.cards, change30: row.change30Bps == null ? null : row.change30Bps / 100,
      sealedChange30: (sealedChangeBySet.get(key) ?? null) == null ? null : (sealedChangeBySet.get(key) as number) / 100,
      packPrice, packEv, evRatio: evRatio(packEv, packPrice),
    };
  });

  // Sealed groups by product category — sets barely exist as a sealed concept. Each
  // momentum window is aggregated once and joined (never a correlated subselect against
  // a window CTE — the pattern that made this payload pathological before).
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
    ), m7 as (
      select p.game, p.product_type category, mm.change_7_bps b,
        row_number() over (partition by p.game, p.product_type order by mm.change_7_bps) rn,
        count(*) over (partition by p.game, p.product_type) total
      from catalog_products p ${metricsJoin}
      where p.kind='sealed' and mm.change_7_bps is not null
    ), m30 as (
      select p.game, p.product_type category, mm.change_30_bps b,
        row_number() over (partition by p.game, p.product_type order by mm.change_30_bps) rn,
        count(*) over (partition by p.game, p.product_type) total
      from catalog_products p ${metricsJoin}
      where p.kind='sealed' and mm.change_30_bps is not null
    ), m90 as (
      select p.game, p.product_type category, mm.change_90_bps b,
        row_number() over (partition by p.game, p.product_type order by mm.change_90_bps) rn,
        count(*) over (partition by p.game, p.product_type) total
      from catalog_products p ${metricsJoin}
      where p.kind='sealed' and mm.change_90_bps is not null
    ), c7 as (
      select game, category, avg(b) as change7Bps from m7 where rn=(total+1)/2 or rn=total/2+1 group by game, category
    ), c30 as (
      select game, category, avg(b) as change30Bps from m30 where rn=(total+1)/2 or rn=total/2+1 group by game, category
    ), c90 as (
      select game, category, avg(b) as change90Bps from m90 where rn=(total+1)/2 or rn=total/2+1 group by game, category
    )
    select m.category, m.game, m.totalCents, m.products, m.medianCents, c7.change7Bps, c30.change30Bps, c90.change90Bps
    from medians m
    left join c7 on c7.game=m.game and c7.category=m.category
    left join c30 on c30.game=m.game and c30.category=m.category
    left join c90 on c90.game=m.game and c90.category=m.category
    order by m.totalCents desc`).bind().all<CategoryRow>()).results ?? [];
  const sealedCategories: MetricsCategoryRow[] = categoryRows.map(row => ({
    category: row.category, game: row.game, trackedValue: row.totalCents / 100, medianPrice: row.medianCents / 100, products: row.products,
    change7: row.change7Bps == null ? null : row.change7Bps / 100,
    change30: row.change30Bps == null ? null : row.change30Bps / 100,
    change90: row.change90Bps == null ? null : row.change90Bps / 100,
  }));

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
    ), setChange as (
      select setName, avg(b) as change30Bps from momentum where rn=(total+1)/2 or rn=total/2+1 group by setName
    )
    select t.setName, t.year, t.totalCents, t.cards, c.change30Bps
    from totals t left join setChange c on c.setName=t.setName`).bind().all<{ setName: string; year: number | null; totalCents: number; cards: number; change30Bps: number | null }>()).results ?? [];
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
  // Moves beyond 4x (7D) / 6x (30D) / 10x (90D) in either direction are excluded for the
  // same reason: at those magnitudes the "move" is listing turnover, not a repricing.
  const moverRows = (await db.prepare(`with eligible as (
      select p.product_id productId, p.name, p.set_name setName, p.game, p.kind, p.image_url image,
        mm.variant printing, cp.market_cents cents, cp.median_cents midCents,
        mm.change_7_bps c7, mm.change_30_bps c30, mm.change_90_bps c90,
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
    ), nineties as (
      select *, row_number() over (partition by game, kind order by c90 desc) up, row_number() over (partition by game, kind order by c90 asc) down
      from eligible where c90 is not null and c90 != 0 and c90 between -9000 and 90000 and cents / (1.0 + c90 / 10000.0) >= floorCents
    )
    select productId, name, setName, game, kind, printing, image, cents, midCents, c7 as changeBps, '7d' as win, case when up <= 8 and c7 > 0 then 'up' else 'down' end as direction
      from sevens where (up <= 8 and c7 > 0) or (down <= 8 and c7 < 0)
    union all
    select productId, name, setName, game, kind, printing, image, cents, midCents, c30, '30d', case when up <= 8 and c30 > 0 then 'up' else 'down' end
      from thirties where (up <= 8 and c30 > 0) or (down <= 8 and c30 < 0)
    union all
    select productId, name, setName, game, kind, printing, image, cents, midCents, c90, '90d', case when up <= 8 and c90 > 0 then 'up' else 'down' end
      from nineties where (up <= 8 and c90 > 0) or (down <= 8 and c90 < 0)`).bind().all<MoverRow>()).results ?? [];
  const movers: MetricsMover[] = moverRows.map(row => ({
    productId: row.productId, name: row.name, set: row.setName, game: row.game, kind: row.kind,
    printing: row.printing ?? (row.kind === "sealed" ? "Sealed" : "Normal"), image: row.image ?? null,
    price: row.cents / 100, mid: row.midCents == null ? null : row.midCents / 100,
    change: row.changeBps / 100, window: row.win, direction: row.direction,
  }));

  return { generatedAt: new Date().toISOString(), rolledUpAt: published.lastSuccessAt, series, overview, sets, sealedCategories, eras, momentum, movers };
}
