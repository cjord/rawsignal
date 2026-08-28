import type { PeerAnchorStats } from "../app/domain/types.ts";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- the pure summarization stays in the .mjs module the local feed script uses
import { summarizePeerHistory } from "../scripts/details/peer-history.mjs";
import type { D1DatabaseLike } from "./repository.ts";

// Peer accumulation, D1 edition (docs/todo.md G1): price_observations already holds the
// set-rarity cohort's daily history — deeper than the one-observation-per-publish file the
// local script accumulates — so the anchor derives on read instead of maintaining a second
// table. Rows are restricted to each card's primary printing at Near Mint so multi-variant
// cards contribute once, matching dailyPeerAverages over the bundled feeds.
type CohortRow = { date: string; average: number; count: number };

export async function readPeerAnchor(db: D1DatabaseLike, game: string, set: string, rarity: string | null): Promise<PeerAnchorStats | null> {
  if (!rarity) return null;
  const rows = (await db.prepare(`select o.observed_date as date, avg(o.market_cents)/100.0 as average, count(*) as count
    from price_observations o join catalog_products p on p.product_id=o.product_id
    where p.kind='single' and p.game=? and p.set_name=? and p.rarity=?
      and o.variant=p.printing and o.condition='Near Mint' and o.market_cents>0
      and o.observed_date>=date('now','-180 days')
    group by o.observed_date order by o.observed_date`).bind(game, set, rarity).all<CohortRow>()).results ?? [];
  if (!rows.length) return null;
  const summary = (summarizePeerHistory({ cohort: rows }) as Record<string, PeerAnchorStats>).cohort;
  return summary ?? null;
}
