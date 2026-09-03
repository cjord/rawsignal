import { setGroupKey } from "../core/domain/eras.ts";
import { eveIneligibleSet } from "../core/domain/release.ts";
import type { EarlyValueEstimate } from "../core/domain/types.ts";
import type { D1DatabaseLike } from "./repository.ts";

// Early Value Estimate (todo P7): the expected settled price for a NEW card, anchored
// on the median current price of same-rarity cards in same-era sibling sets. Serving
// rules from the validation study (docs/backtests.md): mainline sets only (promo and
// special products lose to the naive predictor), pool of >=8 members from >=2 sibling
// sets (era cold-starts lose), and only while the card is young — under ~45 observed
// days or presale — after which the turn-confirmation model takes over.
const NEW_WINDOW_DAYS = 45;
const MIN_MEMBERS = 8;
const MIN_SETS = 2;

const quantile = (sorted: number[], q: number) => {
  const index = (sorted.length - 1) * q, lo = Math.floor(index), hi = Math.ceil(index);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (index - lo);
};

export async function readEarlyValue(db: D1DatabaseLike, productId: number, presale = false): Promise<EarlyValueEstimate | null> {
  const meta = await db.prepare("select kind, game, set_name as setName, rarity, release_year as releaseYear from catalog_products where product_id=?")
    .bind(productId).first<{ kind: string; game: string; setName: string; rarity: string | null; releaseYear: number | null }>();
  if (!meta || meta.kind !== "single" || eveIneligibleSet(meta.setName, meta.rarity)) return null;
  if (!presale) {
    const first = await db.prepare("select min(observed_date) as d from price_observations where product_id=?").bind(productId).first<{ d: string | null }>();
    if (first?.d && (Date.now() - Date.parse(`${first.d}T00:00:00Z`)) / 86400000 > NEW_WINDOW_DAYS) return null;
  }
  const era = setGroupKey(meta.game, meta.setName, meta.releaseYear);
  const sets = (await db.prepare("select set_name as s, max(release_year) as y from catalog_products where game=? and kind='single' group by set_name")
    .bind(meta.game).all<{ s: string; y: number | null }>()).results ?? [];
  const siblings = sets.filter(row => row.s !== meta.setName && !eveIneligibleSet(row.s, null) && setGroupKey(meta.game, row.s, row.y) === era).map(row => row.s);
  if (siblings.length < MIN_SETS) return null;
  const placeholders = siblings.map(() => "?").join(",");
  const rows = (await db.prepare(`select p.set_name as s, cp.market_cents as c from catalog_products p
      join current_prices cp on cp.product_id=p.product_id
      where p.game=? and p.kind='single' and p.rarity=? and cp.market_cents>0 and p.set_name in (${placeholders})`)
    .bind(meta.game, meta.rarity ?? "", ...siblings).all<{ s: string; c: number }>()).results ?? [];
  if (rows.length < MIN_MEMBERS || new Set(rows.map(row => row.s)).size < MIN_SETS) return null;
  const prices = rows.map(row => row.c / 100).sort((a, b) => a - b);
  return {
    median: Number(quantile(prices, .5).toFixed(2)),
    q25: Number(quantile(prices, .25).toFixed(2)),
    q75: Number(quantile(prices, .75).toFixed(2)),
    members: prices.length,
    sets: new Set(rows.map(row => row.s)).size,
  };
}
