import { setGroupKey } from "../core/domain/eras.ts";
import { setSlug } from "../core/domain/formatters.ts";
import type { SetDetailPayload, SetDirectoryRow, SetsDirectoryPayload } from "../core/domain/sets.ts";
import type { PricePoint, PullRateConfig } from "../core/domain/types.ts";
import { readGameSetProducts } from "./catalog-repository.ts";
import { loadSetEvData } from "./metrics-service.ts";
import { publishedIngestion, type D1DatabaseLike } from "./repository.ts";

// The sets directory (sets view 2026-08-29): one row per game+set with the counts,
// momentum, release date, and signal presence the browse tiles render. Every key and
// partition is game-scoped — set names collide across games ("Unleashed").

const metricsJoin = "join market_metrics mm on mm.product_id=p.product_id and (mm.variant=p.printing or p.kind='sealed')";
const gameSetKey = (game: string, set: string) => `${game}|${set}`;

export async function loadSetsDirectory(db: D1DatabaseLike | undefined): Promise<SetsDirectoryPayload | null> {
  if (!db) return null;
  const published = await publishedIngestion(db).catch(() => null);
  if (!published) return null;

  // Every read below depends only on the published run, so they share one round trip
  // (Q6: six sequential trips to D1 were ~1–1.5 s of the page's time to first byte).
  const singlesQuery = db.prepare(`select p.game, p.set_name setName, count(*) chase, sum(cp.market_cents) totalCents, min(p.release_year) releaseYear
    from catalog_products p join current_prices cp on cp.product_id=p.product_id
    where p.kind='single' and cp.market_cents is not null
    group by p.game, p.set_name`).bind().all<{ game: string; setName: string; chase: number; totalCents: number; releaseYear: number | null }>();

  const sealedQuery = db.prepare(`select p.game, p.set_name setName, count(*) sealed, min(p.release_year) releaseYear
    from catalog_products p where p.kind='sealed'
    group by p.game, p.set_name`).bind().all<{ game: string; setName: string; sealed: number; releaseYear: number | null }>();

  // Middle-rank median momentum per game+set+kind: singles carry the tile chips where
  // they exist; sealed-only sets (One Piece) fall back to their sealed momentum. One
  // query per window so each filters its nulls BEFORE the window functions rank rows.
  const momentumWindow = (column: string) => `with ranked as (
      select p.game, p.set_name setName, p.kind, mm.${column} b,
        row_number() over (partition by p.game, p.set_name, p.kind order by mm.${column}) rn,
        count(*) over (partition by p.game, p.set_name, p.kind) total
      from catalog_products p ${metricsJoin}
      where mm.${column} is not null
    ) select game, setName, kind, avg(b) bps from ranked where rn=(total+1)/2 or rn=total/2+1 group by game, setName, kind`;
  type MomentumRow = { game: string; setName: string; kind: string; bps: number | null };
  const releasesQuery = db.prepare(`select p.game, p.set_name setName, min(pd.published_on) releaseDate
    from product_details pd join catalog_products p on p.product_id=pd.product_id
    where pd.published_on is not null
    group by p.game, p.set_name`).bind().all<{ game: string; setName: string; releaseDate: string }>();

  // Signal presence at the site-default strictness; the chips are a pointer into the
  // hot boards, not a strictness-aware count.
  const signalsQuery = db.prepare(`select p.game, p.set_name setName, ms.side, count(distinct ms.product_id) n
    from market_signals ms join catalog_products p on p.product_id=ms.product_id
    where p.kind='single' and ms.strictness='balanced'
    group by p.game, p.set_name, ms.side`).bind().all<{ game: string; setName: string; side: "buy" | "sell"; n: number }>();

  const [singlesResult, sealedResult, momentum7Result, momentum30Result, releasesResult, signalsResult] = await Promise.all([
    singlesQuery, sealedQuery,
    db.prepare(momentumWindow("change_7_bps")).bind().all<MomentumRow>(),
    db.prepare(momentumWindow("change_30_bps")).bind().all<MomentumRow>(),
    releasesQuery, signalsQuery,
  ]);
  const singles = singlesResult.results ?? [], sealed = sealedResult.results ?? [];
  const momentum7 = momentum7Result.results ?? [], momentum30 = momentum30Result.results ?? [];
  const releases = releasesResult.results ?? [], signals = signalsResult.results ?? [];

  const momentumBy = new Map<string, { bps7: number | null; bps30: number | null }>();
  for (const row of momentum7) momentumBy.set(`${gameSetKey(row.game, row.setName)}|${row.kind}`, { bps7: row.bps, bps30: null });
  for (const row of momentum30) {
    const key = `${gameSetKey(row.game, row.setName)}|${row.kind}`;
    const entry = momentumBy.get(key) ?? { bps7: null, bps30: null };
    entry.bps30 = row.bps;
    momentumBy.set(key, entry);
  }
  const releaseBy = new Map(releases.map(row => [gameSetKey(row.game, row.setName), row.releaseDate.slice(0, 10)]));
  const signalsBy = new Map<string, { buy: number; sell: number }>();
  for (const row of signals) {
    const entry = signalsBy.get(gameSetKey(row.game, row.setName)) ?? { buy: 0, sell: 0 };
    entry[row.side] = row.n;
    signalsBy.set(gameSetKey(row.game, row.setName), entry);
  }

  const rows = new Map<string, SetDirectoryRow>();
  const ensure = (game: string, setName: string, releaseYear: number | null) => {
    const key = gameSetKey(game, setName);
    const existing = rows.get(key);
    if (existing) return existing;
    const row: SetDirectoryRow = {
      game, set: setName, slug: setSlug(setName), group: setGroupKey(game, setName, releaseYear),
      releaseDate: releaseBy.get(key) ?? null, releaseYear,
      chase: 0, sealed: 0, trackedValue: 0, change7: null, change30: null,
      buySignals: signalsBy.get(key)?.buy ?? 0, sellSignals: signalsBy.get(key)?.sell ?? 0,
    };
    rows.set(key, row);
    return row;
  };
  for (const row of singles) {
    const entry = ensure(row.game, row.setName, row.releaseYear);
    entry.chase = row.chase;
    entry.trackedValue = row.totalCents / 100;
  }
  for (const row of sealed) {
    const entry = ensure(row.game, row.setName, row.releaseYear);
    entry.sealed = row.sealed;
  }
  for (const row of rows.values()) {
    const key = gameSetKey(row.game, row.set);
    const source = row.chase > 0 ? momentumBy.get(`${key}|single`) : momentumBy.get(`${key}|sealed`);
    row.change7 = source?.bps7 == null ? null : source.bps7 / 100;
    row.change30 = source?.bps30 == null ? null : source.bps30 / 100;
  }
  return { generatedAt: new Date().toISOString(), sets: [...rows.values()] };
}

// One set's detail payload (sets view 2026-08-29): products of both kinds, the daily
// set-value series, the chase cutoff, momentum, and pack EV. The value series is the
// SUM of observed member prices per day with a 60% coverage floor — sparse days where
// most of the set was unobserved would read as crashes, so they are dropped rather
// than estimated (the empty-day rule from the metrics indexes).
const COVERAGE_FLOOR = 0.6;

export async function loadSetDetail(db: D1DatabaseLike | undefined, game: string, slug: string, pullRates?: PullRateConfig): Promise<SetDetailPayload | null> {
  if (!db) return null;
  const published = await publishedIngestion(db).catch(() => null);
  if (!published) return null;
  const names = (await db.prepare(`select distinct set_name setName from catalog_products where game=?`).bind(game).all<{ setName: string }>()).results ?? [];
  const setName = names.map(row => row.setName).find(name => setSlug(name) === slug);
  if (!setName) return null;

  const momentum = async (kind: "single" | "sealed") => {
    const row = await db.prepare(`with ranked as (
        select mm.change_30_bps b,
          row_number() over (order by mm.change_30_bps) rn,
          count(*) over () total
        from catalog_products p ${metricsJoin}
        where p.game=? and p.set_name=? and p.kind=? and mm.change_30_bps is not null
      ) select avg(b) bps from ranked where rn=(total+1)/2 or rn=total/2+1`).bind(game, setName, kind).first<{ bps: number | null }>();
    return row?.bps == null ? null : row.bps / 100;
  };

  // Every read below depends only on game+set, so they run concurrently: the observation
  // aggregation dominates the page (review 2026-09-03) and the other six overlap with it.
  const [{ cards, sealed }, observations, singlesChange30, sealedChange30, release, signalRows, { packPriceBySet, evBySet }] = await Promise.all([
    readGameSetProducts(db, game, setName),
    db.prepare(`select o.observed_date date, p.kind, sum(o.market_cents) cents, count(distinct o.product_id) members
      from price_observations o join catalog_products p on p.product_id=o.product_id and (o.variant=p.printing or p.kind='sealed')
      where p.game=? and p.set_name=?
      group by o.observed_date, p.kind
      order by o.observed_date`).bind(game, setName).all<{ date: string; kind: "single" | "sealed"; cents: number; members: number }>().then(result => result.results ?? []),
    momentum("single"),
    momentum("sealed"),
    db.prepare(`select min(pd.published_on) releaseDate from product_details pd
      join catalog_products p on p.product_id=pd.product_id
      where p.game=? and p.set_name=? and pd.published_on is not null`).bind(game, setName).first<{ releaseDate: string | null }>(),
    db.prepare(`select ms.side, count(distinct ms.product_id) n
      from market_signals ms join catalog_products p on p.product_id=ms.product_id
      where p.game=? and p.set_name=? and p.kind='single' and ms.strictness='balanced'
      group by ms.side`).bind(game, setName).all<{ side: "buy" | "sell"; n: number }>().then(result => result.results ?? []),
    loadSetEvData(db, pullRates),
  ]);

  const packs = sealed.filter(product => product.category === "Booster Packs" && product.marketPrice != null && product.marketPrice > 0);
  const packPrice = packs.length ? Math.min(...packs.map(product => product.marketPrice as number)) : null;
  const chase = packPrice != null ? cards.filter(card => card.marketPrice > packPrice) : cards;
  const seriesFor = (kind: "single" | "sealed"): PricePoint[] => {
    const rows = observations.filter(row => row.kind === kind);
    const maxMembers = Math.max(0, ...rows.map(row => row.members));
    const floor = Math.max(1, Math.ceil(maxMembers * COVERAGE_FLOOR));
    return rows.filter(row => row.members >= floor).map(row => ({ date: row.date, price: row.cents / 100 }));
  };
  const signalCount = (side: "buy" | "sell") => signalRows.find(row => row.side === side)?.n ?? 0;
  const releaseYear = cards.length ? Math.min(...cards.map(card => card.year).filter(year => year > 0)) : null;
  const evKey = `${game}|${setName}`;
  const packEv = evBySet.get(evKey) ?? null;
  const evPack = packPriceBySet.get(evKey) ?? packPrice;
  return {
    generatedAt: new Date().toISOString(),
    game, set: setName, slug, group: setGroupKey(game, setName, releaseYear),
    releaseDate: release?.releaseDate ? release.releaseDate.slice(0, 10) : null,
    releaseYear: Number.isFinite(releaseYear) ? releaseYear : null,
    chaseCount: chase.length,
    chaseMarket: chase.reduce((sum, card) => sum + card.marketPrice, 0),
    sealedCount: sealed.length,
    packPrice,
    packEv,
    evRatio: packEv != null && evPack != null && evPack > 0 ? packEv / evPack : null,
    singlesChange30,
    sealedChange30,
    buySignals: signalCount("buy"),
    sellSignals: signalCount("sell"),
    singlesIndex: seriesFor("single"),
    sealedIndex: seriesFor("sealed"),
    cards, sealed,
  };
}
