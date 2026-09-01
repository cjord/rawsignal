import type { HistoryBackfillTarget } from "./history-backfill.ts";
import type { D1DatabaseLike } from "./repository.ts";

// History targets from the live catalog (todo M5) with tiered refresh cadence (todo M4).
//
// M5: targets derive from catalog_products + current_prices instead of the deploy-time
// bundled feeds, so anything the walk ingests gets history coverage the next day —
// no sync-script regeneration, no redeploy, and no snapshot-drift skips.
//
// M4: not every product deserves a TCGplayer call every day. The daily live walk
// already records every product's price and re-derives its signals from stored
// observations, so a slower cadence only ages sales-velocity counts and late point
// revisions. Tiers:
//   daily   — products that matter now: liquid (sales_30 at or above the signal gate's
//             floor — which also covers everything the Hot boards can display, since
//             board visibility requires that same floor; signal-row presence itself is
//             NOT a criterion — measured 2026-08-31, 81% of the catalog carries a
//             stored signal row across the strictness tiers), a big weekly move
//             (movement promotion — a waking product must not stay stuck in a slow
//             tier), or thin observation depth (new products need their deep backfill
//             and early dailies).
//   spread3 — the middle: anything with recent sales or a real price tag, every 3 days.
//   weekly  — the illiquid tail, every 7 days.
// Off-day members stagger by productId so each calendar day carries an even slice.
//
// Known trade-off: the due list is recomputed per batch while the day's walk itself
// updates the tier inputs, so a mid-run tier flip can shift the cursor by a row and
// skip or repeat a product that day. Accepted: a miss is covered at that product's
// next due day, and a repeat is one cheap re-fetch.

export type HistoryTier = "daily" | "spread3" | "weekly";

export const TIER_DAILY_SALES_30 = 5;    // the balanced signal gate's liquidity floor
export const TIER_DAILY_MOVE_BPS = 1000; // ±10% 7-day move promotes to daily
export const TIER_DAILY_MIN_DEPTH = 14;  // fewer stored observations than this = new product
export const TIER_SPREAD3_MIN_CENTS = 2000; // $20+ products refresh every 3 days

export type HistoryTargetRow = {
  productId: number;
  kind: string;
  printing: string | null;
  marketCents: number;
  sales30: number | null;
  change7Bps: number | null;
  depth: number;
};

export function historyTier(row: Pick<HistoryTargetRow, "sales30" | "change7Bps" | "depth" | "marketCents">): HistoryTier {
  if ((row.sales30 ?? 0) >= TIER_DAILY_SALES_30 || row.depth < TIER_DAILY_MIN_DEPTH) return "daily";
  if (Math.abs(row.change7Bps ?? 0) >= TIER_DAILY_MOVE_BPS) return "daily";
  if ((row.sales30 ?? 0) > 0 || row.marketCents >= TIER_SPREAD3_MIN_CENTS) return "spread3";
  return "weekly";
}

export function tierDue(tier: HistoryTier, productId: number, dayNumber: number): boolean {
  if (tier === "daily") return true;
  if (tier === "spread3") return dayNumber % 3 === productId % 3;
  return dayNumber % 7 === productId % 7;
}

export const utcDayNumber = (isoDate: string) => Math.floor(Date.parse(`${isoDate.slice(0, 10)}T00:00:00Z`) / 86400000);

const targetOf = (row: HistoryTargetRow): HistoryBackfillTarget => row.kind === "sealed"
  ? { productId: row.productId, printing: "Sealed", sealed: true, currentPrice: row.marketCents / 100 }
  : { productId: row.productId, printing: row.printing ?? "Normal", currentPrice: row.marketCents / 100 };

export async function readHistoryTargetRows(db: D1DatabaseLike): Promise<HistoryTargetRow[]> {
  return (await db.prepare(`select p.product_id as productId, p.kind, p.printing, cp.market_cents as marketCents,
      mm.sales_30 as sales30, mm.change_7_bps as change7Bps,
      (select count(*) from price_observations po where po.product_id = p.product_id) as depth
    from catalog_products p
    join current_prices cp on cp.product_id = p.product_id
    left join market_metrics mm on mm.product_id = p.product_id
      and mm.variant = case p.kind when 'sealed' then 'Sealed' else coalesce(p.printing, 'Normal') end
      and mm.condition = case p.kind when 'sealed' then 'Unopened' else 'Near Mint' end
    where cp.market_cents > 0
    order by p.product_id`).bind().all<HistoryTargetRow>()).results ?? [];
}

// asOfDate keys the day's stagger; `all` bypasses the tier filter (operator backfills
// refresh everything regardless of cadence). Pure so the caller can distinguish "no
// catalog rows" (fall back to the bundled snapshot) from "nothing due today".
export function dueHistoryTargets(rows: HistoryTargetRow[], asOfDate: string, options: { all?: boolean } = {}): HistoryBackfillTarget[] {
  const day = utcDayNumber(asOfDate);
  return rows.filter(row => options.all || tierDue(historyTier(row), row.productId, day)).map(targetOf);
}
