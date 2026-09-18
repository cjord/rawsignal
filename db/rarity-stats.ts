import type { SetRarityStat } from "../core/domain/types.ts";
import type { GroupRarityStat } from "../core/normalize/rarity-stats.ts";
import type { D1DatabaseLike } from "./repository.ts";

// `set_rarity_stats` (todo J2, migration 0017): the live walk upserts one row per set × tier
// the first time it touches a group each run (about 3 k rows a day across every game);
// the set page reads a set's rows back with one primary-key range scan.

export async function writeSetRarityStats(db: D1DatabaseLike, game: string, setName: string, rows: GroupRarityStat[], updatedAt: string, runId: string) {
  if (!rows.length) return;
  await db.batch(rows.map(row => db.prepare(`insert into set_rarity_stats (game,set_name,tier,rarity,section,card_count,priced_count,sum_cents,top_cents,top_product_id,updated_at,ingestion_run_id)
    values (?,?,?,?,?,?,?,?,?,?,?,?)
    on conflict(game,set_name,tier) do update set rarity=excluded.rarity,section=excluded.section,card_count=excluded.card_count,priced_count=excluded.priced_count,
    sum_cents=excluded.sum_cents,top_cents=excluded.top_cents,top_product_id=excluded.top_product_id,updated_at=excluded.updated_at,ingestion_run_id=excluded.ingestion_run_id`)
    .bind(game, setName, `pack-v2:${row.tier}`, row.rarity, row.section, row.cardCount, row.pricedCount, row.sumCents, row.topCents, row.topProductId, updatedAt, runId)));
}

type StatRow = { tier: string; rarity: string; section: string | null; cardCount: number; pricedCount: number; sumCents: number; topCents: number | null; topProductId: number | null; updatedAt: string };

export async function readSetRarityStats(db: D1DatabaseLike, game: string, setName: string): Promise<SetRarityStat[]> {
  const rows = (await db.prepare(`select tier, rarity, section, card_count as cardCount, priced_count as pricedCount, sum_cents as sumCents, top_cents as topCents, top_product_id as topProductId, updated_at as updatedAt
    from set_rarity_stats where game=? and set_name=? and tier like 'pack-v2:%' order by tier`).bind(game, setName).all<StatRow>()).results ?? [];
  return rows.map(row => ({
    tier: row.tier.replace(/^pack-v2:/,""), rarity: row.rarity, section: row.section, cardCount: row.cardCount, pricedCount: row.pricedCount,
    sumMarket: row.sumCents / 100, topMarket: row.topCents == null ? null : row.topCents / 100, topProductId: row.topProductId, updatedAt: row.updatedAt,
  }));
}
