import type { D1DatabaseLike } from "./repository.ts";
import type { SalesSummary } from "../core/domain/sales-summary.ts";
import { summarizeSales } from "../core/domain/sales-summary.ts";
import type { SalesActivity } from "../core/domain/types.ts";

export async function persistSalesSummary(db: D1DatabaseLike, productId: number, variant: string, condition: string, fetchedAt: string, sales?: SalesActivity) {
  const summary = sales ? summarizeSales(sales, fetchedAt) : null;
  if (!summary) return;
  try { await salesSummaryStatement(db, productId, variant, condition, summary).run(); }
  catch (error) { if (!(error instanceof Error) || !/no such table/.test(error.message)) throw error; }
}

export function salesSummaryStatement(db: D1DatabaseLike, productId: number, variant: string, condition: string, summary: SalesSummary) {
  return db.prepare(`insert into sales_summaries
    (product_id,variant,condition,sales_7,sales_30,sales_30_prior,through_date,fetched_at,bucket_days)
    values (?,?,?,?,?,?,?,?,?) on conflict(product_id,variant,condition) do update set
    sales_7=excluded.sales_7,sales_30=excluded.sales_30,sales_30_prior=excluded.sales_30_prior,
    through_date=excluded.through_date,fetched_at=excluded.fetched_at,bucket_days=excluded.bucket_days`)
    .bind(productId, variant, condition, summary.sales7, summary.sales30, summary.sales30Prior,
      summary.throughDate, summary.fetchedAt, summary.bucketDays);
}

/** Detail-only read; never triggers upstream fetching. Legacy counts retain unknown freshness. */
export async function readSalesSummary(db: D1DatabaseLike, productId: number, variant: string, condition: string): Promise<SalesSummary | undefined> {
  try {
    const row = await db.prepare(`select sales_7 as sales7,sales_30 as sales30,sales_30_prior as sales30Prior,
      through_date as throughDate,fetched_at as fetchedAt,bucket_days as bucketDays
      from sales_summaries where product_id=? and variant=? and condition=?`)
      .bind(productId, variant, condition).first<SalesSummary>();
    if (row) return row;
  } catch (error) {
    if (!(error instanceof Error) || !/no such table/.test(error.message)) throw error;
  }
  const legacy = await db.prepare(`select sales_7 as sales7,sales_30 as sales30,sales_30_prior as sales30Prior
    from market_metrics where product_id=? and variant=? and condition=?`)
    .bind(productId, variant, condition).first<Pick<SalesSummary, "sales7" | "sales30" | "sales30Prior">>();
  return legacy ? { ...legacy, throughDate: null, fetchedAt: null, bucketDays: 3 } : undefined;
}
