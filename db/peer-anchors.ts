import type { PeerAnchorStats } from "../core/domain/types.ts";
import { summarizePeerHistory } from "../core/peer-history.ts";
import type { D1DatabaseLike } from "./repository.ts";

// Peer accumulation, D1 edition (docs/todo.md G1): price_observations already holds the
// set-rarity cohort's daily history — deeper than the one-observation-per-publish file the
// local script accumulates — so the anchor derives on read instead of maintaining a second
// table. Rows are restricted to each card's primary printing at Near Mint so multi-variant
// cards contribute once, matching dailyPeerAverages over the bundled feeds.
//
// Memoized per isolate (todo Q9, 2026-09-09): every card of one set and rarity shares this
// cohort, and the query was the site's largest read (142 M rows a day at ~8.8 k rows per
// call once crawlers walk a set card by card). The cohort changes only when a run publishes,
// so an isolate keeps each cohort's summary for ten minutes; a failed read is not kept.
type CohortRow = { date: string; average: number; count: number };

export const PEER_ANCHOR_TTL_MS = 10 * 60_000;
type Memo = { at: number; value: Promise<PeerAnchorStats | null> };
const memos = new WeakMap<D1DatabaseLike, Map<string, Memo>>();

export function readPeerAnchor(db: D1DatabaseLike, game: string, set: string, rarity: string | null, options: { now?: number } = {}): Promise<PeerAnchorStats | null> {
  if (!rarity) return Promise.resolve(null);
  const perDb = memos.get(db) ?? new Map<string, Memo>();
  memos.set(db, perDb);
  const key = `${game}|${set}|${rarity}`, now = options.now ?? Date.now(), hit = perDb.get(key);
  if (hit && now - hit.at < PEER_ANCHOR_TTL_MS) return hit.value;
  const value = queryPeerAnchor(db, game, set, rarity).catch(error => { perDb.delete(key); throw error; });
  perDb.set(key, { at: now, value });
  return value;
}

async function queryPeerAnchor(db: D1DatabaseLike, game: string, set: string, rarity: string): Promise<PeerAnchorStats | null> {
  const rows = (await db.prepare(`select o.observed_date as date, avg(o.market_cents)/100.0 as average, count(*) as count
    from price_observations o join catalog_products p on p.product_id=o.product_id
    where p.kind='single' and p.game=? and p.set_name=? and p.rarity=?
      and o.variant=p.printing and o.condition='Near Mint' and o.market_cents>0
      and o.observed_date>=date('now','-180 days')
    group by o.observed_date order by o.observed_date`).bind(game, set, rarity).all<CohortRow>()).results ?? [];
  if (!rows.length) return null;
  // Backfilled history is composition-biased: sparse dates carry only a subset of the cohort
  // (daily "averages" swing hundreds of dollars purely from which cards were observed), so
  // only days observing at least 80% of the best-covered day count. Live daily ingestion
  // writes the full cohort every day, so current data always passes.
  const maxCount = Math.max(...rows.map(row => row.count));
  const complete = rows.filter(row => row.count >= Math.ceil(maxCount * 0.8));
  if (!complete.length) return null;
  const summary = summarizePeerHistory({ cohort: complete }).cohort;
  return summary ?? null;
}
