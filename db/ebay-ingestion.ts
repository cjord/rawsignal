import type { EbayListingSample, EbayListingSnapshot } from "../core/domain/types.ts";
import type { EbayListingSummary } from "../core/ebay-summary.ts";
import { clampBatchSize, markIngestionFailed, parseStatsJson, resumeCheckpoint } from "./ingestion-batch.ts";
import { checkpointIngestion, completeIngestion, startIngestion, type D1DatabaseLike } from "./repository.ts";
import { ingestionRunId } from "./run-id.ts";

// eBay active-listing rotation (todo O2, plan docs/ebay-integration-plan-2026-09.md §C):
// one Browse search per product, stalest first, over every product priced at $20 or more.
// A day's run (`ebay-listings:<date>`) spends at most `dailyBudget` calls (1,500 of the
// keyset's 5,000) in ticks of `calls` (40 ≈ 20 s of wall time), checkpointing the call count
// between ticks and completing when the budget is spent, the pool is exhausted, or eBay
// pushes back (429, or an auth failure — which ends the day rather than retrying every
// minute). Asks are listing prices: stored as such, never described as sales.

export const EBAY_LISTINGS_KEY = "ebay-listings";
export const EBAY_MIN_MARKET_CENTS = 2000;
export const EBAY_DAILY_BUDGET = 1500;
export const EBAY_TICK_CALLS = 40;

export type EbayListingTarget = { productId: number; kind: "single" | "sealed"; game: string; name: string; set: string; number: string | null; marketCents: number | null };
export type EbayFetchResult = { status: number; query: string; categoryId: number | null; summary: EbayListingSummary | null };
export type EbayListingsDeps = {
  fetchListings(target: EbayListingTarget): Promise<EbayFetchResult>;
  wait?(ms: number): Promise<void>;
};
type EbayRunStats = { calls: number; updated: number; dailyBudget: number; stopped: string | null };
type PoolRow = { productId: number; kind: "single" | "sealed"; game: string; name: string; setName: string; number: string | null; marketCents: number | null };

const toCents = (value: number | null) => value == null ? null : Math.round(value * 100);

export async function runEbayListingsBatch(db: D1DatabaseLike, deps: EbayListingsDeps, options: { calls?: number; dailyBudget?: number; minMarketCents?: number; now?: Date } = {}) {
  const perTick = clampBatchSize(options.calls, EBAY_TICK_CALLS, 100);
  const dailyBudget = clampBatchSize(options.dailyBudget, EBAY_DAILY_BUDGET, 5000);
  const minMarketCents = options.minMarketCents ?? EBAY_MIN_MARKET_CENTS;
  const now = options.now ?? new Date(), startedAt = now.toISOString(), today = startedAt.slice(0, 10);
  const runId = ingestionRunId(EBAY_LISTINGS_KEY, today);
  const wait = deps.wait ?? (ms => new Promise<void>(resolve => setTimeout(resolve, ms)));
  // A tick continues the day's run from its checkpointed call count; a new day starts fresh.
  const resume = await resumeCheckpoint(db, EBAY_LISTINGS_KEY, runId);
  const prior = parseStatsJson<EbayRunStats>(resume.statsJson);
  let calls = resume.resumed ? prior.calls ?? 0 : 0, updated = resume.resumed ? prior.updated ?? 0 : 0;
  if (!resume.resumed) await startIngestion(db, runId, "ebay-browse", startedAt, { stats: { calls: 0, updated: 0, dailyBudget, stopped: null } });
  try {
    const batch = Math.min(perTick, Math.max(0, dailyBudget - calls));
    // Never-fetched products first, then the stalest snapshot, the higher market price
    // breaking ties; anything already refreshed today is out of the pool.
    const targets: PoolRow[] = batch === 0 ? [] : (await db.prepare(`select p.product_id as productId, p.kind, p.game, p.name, p.set_name as setName, p.card_number as number, cp.market_cents as marketCents
      from catalog_products p join current_prices cp on cp.product_id = p.product_id
      left join ebay_listings e on e.product_id = p.product_id
      where cp.market_cents >= ? and (e.updated_at is null or e.updated_at < ?)
      order by (e.updated_at is not null), e.updated_at, cp.market_cents desc
      limit ?`).bind(minMarketCents, today, batch).all<PoolRow>()).results ?? [];
    let stopped: string | null = null, consecutiveFailures = 0, seen = 0;
    for (const target of targets) {
      seen++;
      const result = await deps.fetchListings({ productId: target.productId, kind: target.kind, game: target.game, name: target.name, set: target.setName, number: target.number, marketCents: target.marketCents });
      calls++;
      if (result.status === 429) { stopped = "rate-limited"; break; }
      if (result.status === 401 || result.status === 403) { stopped = "auth"; break; }
      if (result.status < 200 || result.status >= 300 || !result.summary) {
        consecutiveFailures++;
        if (consecutiveFailures >= 5) { stopped = `http-${result.status}`; break; }
        continue;
      }
      consecutiveFailures = 0;
      await writeEbayListing(db, target.productId, result.query, result.categoryId, result.summary, new Date().toISOString(), today);
      updated++;
      if (seen < targets.length) await wait(250);
    }
    const done = stopped != null || calls >= dailyBudget || targets.length < batch;
    const stats: EbayRunStats = { calls, updated, dailyBudget, stopped };
    if (done) await completeIngestion(db, runId, EBAY_LISTINGS_KEY, new Date().toISOString(), calls, updated, 0, 0, stats);
    else await checkpointIngestion(db, runId, EBAY_LISTINGS_KEY, calls, updated, String(calls), stats);
    return { runId, calls, updated, targets: targets.length, stopped, done };
  } catch (error) {
    await markIngestionFailed(db, runId, error, "Unknown eBay listings failure");
    throw error;
  }
}

export async function writeEbayListing(db: D1DatabaseLike, productId: number, query: string, categoryId: number | null, summary: EbayListingSummary, fetchedAt: string, updatedAt: string) {
  await db.prepare(`insert into ebay_listings (product_id,query,category_id,listing_count,lowest_cents,median_cents,samples_json,fetched_at,updated_at)
    values (?,?,?,?,?,?,?,?,?)
    on conflict(product_id) do update set query=excluded.query,category_id=excluded.category_id,listing_count=excluded.listing_count,
    lowest_cents=excluded.lowest_cents,median_cents=excluded.median_cents,samples_json=excluded.samples_json,fetched_at=excluded.fetched_at,updated_at=excluded.updated_at`)
    .bind(productId, query, categoryId, summary.listingCount, toCents(summary.lowestAsk), toCents(summary.medianAsk), JSON.stringify(summary.samples), fetchedAt, updatedAt).run();
}

type ListingRow = { query: string; categoryId: number | null; listingCount: number; lowestCents: number | null; medianCents: number | null; samplesJson: string; fetchedAt: string; updatedAt: string };

export async function readEbayListing(db: D1DatabaseLike, productId: number): Promise<EbayListingSnapshot | null> {
  const row = await db.prepare(`select query, category_id as categoryId, listing_count as listingCount, lowest_cents as lowestCents, median_cents as medianCents,
    samples_json as samplesJson, fetched_at as fetchedAt, updated_at as updatedAt from ebay_listings where product_id = ?`).bind(productId).first<ListingRow>();
  if (!row) return null;
  let samples: EbayListingSample[] = [];
  try { const parsed = JSON.parse(row.samplesJson) as unknown; if (Array.isArray(parsed)) samples = parsed as EbayListingSample[]; } catch { /* a malformed sample list renders as no samples */ }
  return {
    query: row.query, categoryId: row.categoryId, listingCount: row.listingCount,
    lowestAsk: row.lowestCents == null ? null : row.lowestCents / 100, medianAsk: row.medianCents == null ? null : row.medianCents / 100,
    samples, fetchedAt: row.fetchedAt, updatedAt: row.updatedAt,
  };
}
