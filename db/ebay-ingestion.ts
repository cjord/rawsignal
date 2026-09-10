import type { EbayListingSample, EbayListingSnapshot } from "../core/domain/types.ts";
import type { EbayListingSummary } from "../core/ebay-summary.ts";
import type { EbayFetchResult, EbayListingTarget, EbayListingsDeps } from "../core/clients/ebay-listings.ts";
import { clampBatchSize, markIngestionFailed, parseStatsJson, resumeCheckpoint } from "./ingestion-batch.ts";
import { checkpointIngestion, completeIngestion, startIngestion, type D1DatabaseLike } from "./repository.ts";
import { ingestionRunId } from "./run-id.ts";

// The public path below resolves one six-hour active-listing snapshot on demand, guarded by
// a shared daily quota and a per-product lease. The older catalog rotation remains only for
// explicit staging ops trials; production cron no longer dispatches it. Asks are listing
// prices: stored as such, never described as sales.

export const EBAY_LISTINGS_KEY = "ebay-listings";
export const EBAY_MIN_MARKET_CENTS = 2000;
export const EBAY_DAILY_BUDGET = 1500;
export const EBAY_TICK_CALLS = 40;
export const EBAY_LISTING_TTL_MS = 6 * 60 * 60 * 1000;
export const EBAY_DAILY_CALL_LIMIT = 5000;
export const EBAY_ON_DEMAND_BUDGET = 4000;
export const EBAY_FETCH_LEASE_MS = 30_000;
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
  const expiresAt = new Date(new Date(fetchedAt).getTime() + EBAY_LISTING_TTL_MS).toISOString();
  await db.prepare(`insert into ebay_listings (product_id,query,category_id,listing_count,accepted_count,lowest_cents,median_cents,samples_json,fetched_at,expires_at,updated_at)
    values (?,?,?,?,?,?,?,?,?,?,?)
    on conflict(product_id) do update set query=excluded.query,category_id=excluded.category_id,listing_count=excluded.listing_count,accepted_count=excluded.accepted_count,
    lowest_cents=excluded.lowest_cents,median_cents=excluded.median_cents,samples_json=excluded.samples_json,fetched_at=excluded.fetched_at,expires_at=excluded.expires_at,updated_at=excluded.updated_at`)
    .bind(productId, query, categoryId, summary.listingCount, summary.acceptedCount, toCents(summary.lowestAsk), toCents(summary.medianAsk), JSON.stringify(summary.samples), fetchedAt, expiresAt, updatedAt).run();
}

type ListingRow = { query: string; categoryId: number | null; listingCount: number; acceptedCount: number; lowestCents: number | null; medianCents: number | null; samplesJson: string; fetchedAt: string; expiresAt: string | null; updatedAt: string };

export async function readEbayListing(db: D1DatabaseLike, productId: number): Promise<EbayListingSnapshot | null> {
  const row = await db.prepare(`select query, category_id as categoryId, listing_count as listingCount, accepted_count as acceptedCount, lowest_cents as lowestCents, median_cents as medianCents,
    samples_json as samplesJson, fetched_at as fetchedAt, expires_at as expiresAt, updated_at as updatedAt from ebay_listings where product_id = ?`).bind(productId).first<ListingRow>();
  if (!row) return null;
  let samples: EbayListingSample[] = [];
  try { const parsed = JSON.parse(row.samplesJson) as unknown; if (Array.isArray(parsed)) samples = parsed as EbayListingSample[]; } catch { /* a malformed sample list renders as no samples */ }
  return {
    query: row.query, categoryId: row.categoryId, listingCount: row.listingCount, acceptedCount: row.acceptedCount,
    lowestAsk: row.lowestCents == null ? null : row.lowestCents / 100, medianAsk: row.medianCents == null ? null : row.medianCents / 100,
    samples, fetchedAt: row.fetchedAt, expiresAt: row.expiresAt ?? row.fetchedAt, updatedAt: row.updatedAt,
  };
}

export const ebayListingIsFresh = (snapshot: EbayListingSnapshot | null, now = new Date()) =>
  snapshot != null && Number.isFinite(Date.parse(snapshot.expiresAt)) && Date.parse(snapshot.expiresAt) > now.getTime();

type UsageRow = { calls: number; onDemandCalls: number };

export async function reserveEbayOnDemandCall(db: D1DatabaseLike, now = new Date(), options: { dailyLimit?: number; onDemandBudget?: number } = {}): Promise<UsageRow | null> {
  const dailyLimit = options.dailyLimit ?? EBAY_DAILY_CALL_LIMIT;
  const onDemandBudget = options.onDemandBudget ?? EBAY_ON_DEMAND_BUDGET;
  if (dailyLimit < 1 || onDemandBudget < 1) return null;
  const at = now.toISOString(), day = at.slice(0, 10);
  return db.prepare(`insert into ebay_api_usage (usage_date,calls,on_demand_calls,background_calls,updated_at)
    values (?,1,1,0,?)
    on conflict(usage_date) do update set calls=ebay_api_usage.calls+1,on_demand_calls=ebay_api_usage.on_demand_calls+1,updated_at=excluded.updated_at
    where ebay_api_usage.calls < ? and ebay_api_usage.on_demand_calls < ?
    returning calls,on_demand_calls as onDemandCalls`)
    .bind(day, at, dailyLimit, onDemandBudget).first<UsageRow>();
}

async function claimEbayFetchLease(db: D1DatabaseLike, productId: number, holder: string, now: Date, leaseMs: number): Promise<boolean> {
  const expiresAt = new Date(now.getTime() + leaseMs).toISOString();
  const row = await db.prepare(`insert into ebay_fetch_leases (product_id,holder,expires_at) values (?,?,?)
    on conflict(product_id) do update set holder=excluded.holder,expires_at=excluded.expires_at
    where ebay_fetch_leases.expires_at <= ? returning holder`)
    .bind(productId, holder, expiresAt, now.toISOString()).first<{ holder: string }>();
  return row?.holder === holder;
}

async function releaseEbayFetchLease(db: D1DatabaseLike, productId: number, holder: string) {
  await db.prepare("delete from ebay_fetch_leases where product_id = ? and holder = ?").bind(productId, holder).run();
}

async function readEbayListingTarget(db: D1DatabaseLike, productId: number): Promise<EbayListingTarget | null> {
  const row = await db.prepare(`select p.product_id as productId,p.kind,p.game,p.name,p.set_name as setName,p.card_number as number,cp.market_cents as marketCents
    from catalog_products p left join current_prices cp on cp.product_id=p.product_id where p.product_id=?`)
    .bind(productId).first<PoolRow>();
  return row ? { productId: row.productId, kind: row.kind, game: row.game, name: row.name, set: row.setName, number: row.number, marketCents: row.marketCents } : null;
}

export type EbayListingResolution =
  | { status: "fresh" | "refreshed"; snapshot: EbayListingSnapshot }
  | { status: "not-found" | "quota" | "busy"; snapshot: null }
  | { status: "upstream-error"; snapshot: null; upstreamStatus: number };

export async function resolveEbayListing(db: D1DatabaseLike, productId: number, deps: EbayListingsDeps, options: { now?: Date; dailyLimit?: number; onDemandBudget?: number; leaseMs?: number; leaseId?: () => string } = {}): Promise<EbayListingResolution> {
  const now = options.now ?? new Date();
  const cached = await readEbayListing(db, productId);
  if (ebayListingIsFresh(cached, now)) return { status: "fresh", snapshot: cached! };
  const target = await readEbayListingTarget(db, productId);
  if (!target) return { status: "not-found", snapshot: null };
  const holder = (options.leaseId ?? (() => crypto.randomUUID()))();
  if (!await claimEbayFetchLease(db, productId, holder, now, options.leaseMs ?? EBAY_FETCH_LEASE_MS)) return { status: "busy", snapshot: null };
  try {
    // Close the race between the first read and the lease claim: a previous owner may have
    // committed its replacement immediately before releasing the lease.
    const latest = await readEbayListing(db, productId);
    if (ebayListingIsFresh(latest, now)) return { status: "fresh", snapshot: latest! };
    const reserved = await reserveEbayOnDemandCall(db, now, { dailyLimit: options.dailyLimit, onDemandBudget: options.onDemandBudget });
    if (!reserved) return { status: "quota", snapshot: null };
    const result: EbayFetchResult = await deps.fetchListings(target);
    if (result.status < 200 || result.status >= 300 || !result.summary) return { status: "upstream-error", snapshot: null, upstreamStatus: result.status };
    const fetchedAt = now.toISOString();
    await writeEbayListing(db, productId, result.query, result.categoryId, result.summary, fetchedAt, fetchedAt.slice(0, 10));
    const snapshot = await readEbayListing(db, productId);
    if (!snapshot) return { status: "upstream-error", snapshot: null, upstreamStatus: 502 };
    return { status: "refreshed", snapshot };
  } finally {
    await releaseEbayFetchLease(db, productId, holder).catch(() => { /* the short lease expires on its own */ });
  }
}
