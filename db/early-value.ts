import { setGroupKey } from "../core/domain/eras.ts";
import { blendEarlyValue, eveIneligibleSet, releaseSettleFor } from "../core/domain/release.ts";
import type { EarlyValueEstimate } from "../core/domain/types.ts";
import type { D1DatabaseLike } from "./repository.ts";

// Early Value Estimate (todo P7): the expected settled price for a NEW product,
// anchored on the median current price of same-rung products (rarity for singles,
// product type for sealed) in same-era sibling sets, then blended toward the product's
// OWN decay-curve projection as launch prices are discovered (user 2026-09-03; the
// blend earns full weight by ~14 observed days — validated in
// scripts/release-curves/dynamic.mjs, docs/backtests.md). Serving rules from the
// validation studies: mainline sets only (promo and special products lose to the
// naive predictor), a pool of >=8 singles / >=4 sealed members from >=2 sibling sets
// (era cold-starts lose), and only while the product is young — under ~45 days from
// the set's estimated release (median first observation of its singles), or presale —
// after which the turn-confirmation model takes over.
const NEW_WINDOW_DAYS = 45;
const MIN_SETS = 2;
const minMembers = (kind: string) => (kind === "sealed" ? 4 : 8);

// The sibling-set list (one row per set of the game+kind, ~14 k rows read on Pokémon singles)
// was the one catalog-wide read left on every detail view (review §15). It changes only when
// a run publishes, so each isolate keeps it per database for a few minutes.
const SET_LIST_TTL_MS = 10 * 60_000;
type SetListRow = { s: string; y: number | null };
const setListCache = new WeakMap<D1DatabaseLike, Map<string, { at: number; rows: Promise<SetListRow[]> }>>();
function cachedSetList(db: D1DatabaseLike, game: string, kind: string): Promise<SetListRow[]> {
  const perDb = setListCache.get(db) ?? new Map<string, { at: number; rows: Promise<SetListRow[]> }>();
  setListCache.set(db, perDb);
  const key = `${game}|${kind}`, hit = perDb.get(key), now = Date.now();
  if (hit && now - hit.at < SET_LIST_TTL_MS) return hit.rows;
  const rows = db.prepare("select set_name as s, max(release_year) as y from catalog_products where game=? and kind=? group by set_name")
    .bind(game, kind).all<SetListRow>().then(result => result.results ?? []).catch(error => { perDb.delete(key); throw error; });
  perDb.set(key, { at: now, rows });
  return rows;
}

const quantile = (sorted: number[], q: number) => {
  const index = (sorted.length - 1) * q, lo = Math.floor(index), hi = Math.ceil(index);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (index - lo);
};
const daysSince = (iso: string) => (Date.now() - Date.parse(`${iso}T00:00:00Z`)) / 86400000;

export async function readEarlyValue(db: D1DatabaseLike, productId: number, presale = false): Promise<EarlyValueEstimate | null> {
  const meta = await db.prepare("select kind, game, set_name as setName, rarity, product_type as productType, release_year as releaseYear from catalog_products where product_id=?")
    .bind(productId).first<{ kind: string; game: string; setName: string; rarity: string | null; productType: string | null; releaseYear: number | null }>();
  if (!meta || eveIneligibleSet(meta.setName, meta.kind === "single" ? meta.rarity : null)) return null;
  const kind = meta.kind === "sealed" ? "sealed" as const : "single" as const;
  const rung = kind === "single" ? meta.rarity : meta.productType;

  // The set's release day = median first observation of its SINGLES (sealed lists as
  // presale ~75 days early and cannot date a launch). No singles yet => unreleased.
  // One index seek per member (rows read ≈ members, not observations — review §14 F2): the
  // correlated min() rides idx_price_observations_product_date; members with no observations
  // yet drop out, matching the previous inner join.
  const firsts = (await db.prepare(`select f from (
        select (select min(o.observed_date) from price_observations o where o.product_id=p.product_id) as f
        from catalog_products p where p.game=? and p.set_name=? and p.kind='single'
      ) where f is not null order by f`)
    .bind(meta.game, meta.setName).all<{ f: string }>()).results ?? [];
  const release = firsts.length >= 8 ? firsts[Math.floor(firsts.length / 2)].f : null;
  const ageDays = release ? daysSince(release) : null;
  const unreleased = ageDays == null || ageDays < 0;

  // Serving window: presale-flagged, set unreleased, or set within the launch window.
  // A set too small to date falls back to the product's own first observation, so a
  // long-tracked product in an undatable set still ages out.
  const own = await db.prepare("select min(observed_date) as f, count(distinct observed_date) as n from price_observations where product_id=?")
    .bind(productId).first<{ f: string | null; n: number }>();
  if (!presale) {
    if (!unreleased && ageDays > NEW_WINDOW_DAYS) return null;
    if (release == null && own?.f && daysSince(own.f) > NEW_WINDOW_DAYS) return null;
  }

  const era = setGroupKey(meta.game, meta.setName, meta.releaseYear);
  const sets = await cachedSetList(db, meta.game, meta.kind);
  const siblings = sets.filter(row => row.s !== meta.setName && !eveIneligibleSet(row.s, null) && setGroupKey(meta.game, row.s, row.y) === era).map(row => row.s);
  if (siblings.length < MIN_SETS) return null;
  const placeholders = siblings.map(() => "?").join(",");
  const rungColumn = kind === "single" ? "p.rarity" : "p.product_type";
  const rows = (await db.prepare(`select p.set_name as s, cp.market_cents as c from catalog_products p
      join current_prices cp on cp.product_id=p.product_id
      where p.game=? and p.kind=? and ${rungColumn}=? and cp.market_cents>0 and p.set_name in (${placeholders})`)
    .bind(meta.game, meta.kind, rung ?? "", ...siblings).all<{ s: string; c: number }>()).results ?? [];
  if (rows.length < minMembers(kind) || new Set(rows.map(row => row.s)).size < MIN_SETS) return null;
  const prices = rows.map(row => row.c / 100).sort((a, b) => a - b);
  const anchor = { median: quantile(prices, .5), q25: quantile(prices, .25), q75: quantile(prices, .75) };

  const current = await db.prepare("select market_cents as c from current_prices where product_id=?").bind(productId).first<{ c: number | null }>();
  const blend = blendEarlyValue({
    anchor,
    currentPrice: current?.c ? current.c / 100 : null,
    observedDays: own?.n ?? 0,
    ageDays: unreleased ? null : ageDays,
    settle: releaseSettleFor(meta.game, kind, rung),
  });
  return {
    median: Number(blend.median.toFixed(2)),
    q25: Number(blend.q25.toFixed(2)),
    q75: Number(blend.q75.toFixed(2)),
    members: prices.length,
    sets: new Set(rows.map(row => row.s)).size,
    ownWeight: blend.ownWeight,
    observedDays: own?.n ?? 0,
  };
}
