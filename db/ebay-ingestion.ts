import type { EbayAskHistory, EbayAskHistoryPoint, EbayListingSample, EbayListingSnapshot } from "../core/domain/types.ts";
import { summarizeEbaySamples, type EbayListingSummary } from "../core/ebay-summary.ts";
import { ebayListingDeltas } from "../core/ebay-history.ts";
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
type PoolRow = { productId: number; kind: "single" | "sealed"; game: string; name: string; setName: string; number: string | null; section: string | null; marketCents: number | null };

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
    const targets: PoolRow[] = batch === 0 ? [] : (await db.prepare(`select p.product_id as productId, p.kind, p.game, p.name, p.set_name as setName, p.card_number as number, p.section, cp.market_cents as marketCents
      from catalog_products p join current_prices cp on cp.product_id = p.product_id
      left join ebay_listings e on e.product_id = p.product_id
      where cp.market_cents >= ? and (e.updated_at is null or e.updated_at < ?)
      order by (e.updated_at is not null), e.updated_at, cp.market_cents desc
      limit ?`).bind(minMarketCents, today, batch).all<PoolRow>()).results ?? [];
    let stopped: string | null = null, consecutiveFailures = 0, seen = 0;
    for (const target of targets) {
      seen++;
      const result = await deps.fetchListings({ productId: target.productId, kind: target.kind, game: target.game, name: target.name, set: target.setName, number: target.number, section: target.section, marketCents: target.marketCents });
      calls++;
      if (result.status === 429) { stopped = "rate-limited"; break; }
      if (result.status === 401 || result.status === 403) { stopped = "auth"; break; }
      if (result.status < 200 || result.status >= 300 || !result.summary) {
        consecutiveFailures++;
        if (consecutiveFailures >= 5) { stopped = `http-${result.status}`; break; }
        continue;
      }
      consecutiveFailures = 0;
      await writeEbayListing(db, target.productId, result.query, result.categoryId, result.summary, new Date().toISOString(), today, target.marketCents);
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

type StoredPayload={version:2;reviewedCount:number;samples:EbayListingSample[]};
const storedPayload=(summary:EbayListingSummary):StoredPayload=>({version:2,reviewedCount:summary.reviewedCount,samples:summary.samples});
const record=(value:unknown):value is Record<string,unknown>=>typeof value==="object"&&value!==null;
function storedSamples(value:string):{samples:EbayListingSample[];reviewedCount:number|null}{
 try{
  const parsed=JSON.parse(value) as unknown;
  if(Array.isArray(parsed))return {samples:parsed as EbayListingSample[],reviewedCount:null};
  if(record(parsed)&&Array.isArray(parsed.samples))return {samples:parsed.samples as EbayListingSample[],reviewedCount:Number.isFinite(Number(parsed.reviewedCount))?Number(parsed.reviewedCount):null};
 }catch{/* malformed historical JSON becomes an empty sample */}
 return {samples:[],reviewedCount:null};
}
const migrationPending=(error:unknown)=>error instanceof Error&&/no such table:\s*ebay_listing_observations/i.test(error.message);

export async function writeEbayListing(db: D1DatabaseLike, productId: number, query: string, categoryId: number | null, summary: EbayListingSummary, fetchedAt: string, updatedAt: string, marketCents: number|null=null) {
  const expiresAt = new Date(new Date(fetchedAt).getTime() + EBAY_LISTING_TTL_MS).toISOString();
  const previous=await db.prepare("select samples_json as samplesJson from ebay_listings where product_id=?").bind(productId).first<{samplesJson:string}>();
  const computed=summarizeEbaySamples(summary.samples,summary.listingCount,{market:marketCents==null?null:marketCents/100,reviewedCount:summary.reviewedCount??summary.acceptedCount});
  const enriched={...computed,listingCount:summary.listingCount,reviewedCount:summary.reviewedCount??summary.acceptedCount,acceptedCount:summary.acceptedCount,lowestAsk:summary.lowestAsk,medianAsk:summary.medianAsk};
  const deltas=ebayListingDeltas(previous?storedSamples(previous.samplesJson).samples:null,enriched.samples);
  await db.prepare(`insert into ebay_listings (product_id,query,category_id,listing_count,accepted_count,lowest_cents,median_cents,samples_json,fetched_at,expires_at,updated_at)
    values (?,?,?,?,?,?,?,?,?,?,?)
    on conflict(product_id) do update set query=excluded.query,category_id=excluded.category_id,listing_count=excluded.listing_count,accepted_count=excluded.accepted_count,
    lowest_cents=excluded.lowest_cents,median_cents=excluded.median_cents,samples_json=excluded.samples_json,fetched_at=excluded.fetched_at,expires_at=excluded.expires_at,updated_at=excluded.updated_at`)
    .bind(productId, query, categoryId, enriched.listingCount, enriched.acceptedCount, toCents(enriched.lowestAsk), toCents(enriched.medianAsk), JSON.stringify(storedPayload(enriched)), fetchedAt, expiresAt, updatedAt).run();
  try{
    await db.prepare(`insert into ebay_listing_observations (product_id,observed_date,observed_at,reference_market_cents,listing_count,reviewed_count,accepted_count,lowest_cents,median_cents,lowest_delivered_cents,median_delivered_cents,delivered_q1_cents,delivered_q3_cents,below_market_count,near_market_count,free_shipping_count,best_offer_count,new_listing_count,missing_listing_count,price_reduction_count)
      values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      on conflict(product_id,observed_date) do update set observed_at=excluded.observed_at,reference_market_cents=excluded.reference_market_cents,listing_count=excluded.listing_count,reviewed_count=excluded.reviewed_count,accepted_count=excluded.accepted_count,lowest_cents=excluded.lowest_cents,median_cents=excluded.median_cents,lowest_delivered_cents=excluded.lowest_delivered_cents,median_delivered_cents=excluded.median_delivered_cents,delivered_q1_cents=excluded.delivered_q1_cents,delivered_q3_cents=excluded.delivered_q3_cents,below_market_count=excluded.below_market_count,near_market_count=excluded.near_market_count,free_shipping_count=excluded.free_shipping_count,best_offer_count=excluded.best_offer_count,new_listing_count=excluded.new_listing_count,missing_listing_count=excluded.missing_listing_count,price_reduction_count=excluded.price_reduction_count`)
      .bind(productId,fetchedAt.slice(0,10),fetchedAt,marketCents,enriched.listingCount,enriched.reviewedCount,enriched.acceptedCount,toCents(enriched.lowestAsk),toCents(enriched.medianAsk),toCents(enriched.lowestDeliveredAsk),toCents(enriched.medianDeliveredAsk),toCents(enriched.deliveredQ1),toCents(enriched.deliveredQ3),enriched.belowMarketCount,enriched.nearMarketCount,enriched.freeShippingCount,enriched.bestOfferCount,deltas.newListingCount,deltas.missingListingCount,deltas.priceReductionCount).run();
  }catch(error){
    if(!migrationPending(error))console.error(JSON.stringify({event:"ebay_listing_history_write_failed",productId,message:error instanceof Error?error.message:"Unknown failure"}));
  }
}

type ListingRow = { query: string; categoryId: number | null; listingCount: number; acceptedCount: number; lowestCents: number | null; medianCents: number | null; samplesJson: string; fetchedAt: string; expiresAt: string | null; updatedAt: string; marketCents:number|null };

export async function readEbayListing(db: D1DatabaseLike, productId: number): Promise<EbayListingSnapshot | null> {
  const row = await db.prepare(`select e.query,e.category_id as categoryId,e.listing_count as listingCount,e.accepted_count as acceptedCount,e.lowest_cents as lowestCents,e.median_cents as medianCents,
    e.samples_json as samplesJson,e.fetched_at as fetchedAt,e.expires_at as expiresAt,e.updated_at as updatedAt,cp.market_cents as marketCents from ebay_listings e left join current_prices cp on cp.product_id=e.product_id where e.product_id = ?`).bind(productId).first<ListingRow>();
  if (!row) return null;
  const stored=storedSamples(row.samplesJson),computed=summarizeEbaySamples(stored.samples,row.listingCount,{market:row.marketCents==null?null:row.marketCents/100,reviewedCount:stored.reviewedCount??row.acceptedCount});
  return {
    query: row.query, categoryId: row.categoryId, listingCount: row.listingCount, reviewedCount: computed.reviewedCount, acceptedCount: row.acceptedCount,highConfidenceCount:computed.highConfidenceCount,
    lowestAsk: row.lowestCents == null ? null : row.lowestCents / 100, medianAsk: row.medianCents == null ? null : row.medianCents / 100,
    lowestDeliveredAsk:computed.lowestDeliveredAsk,medianDeliveredAsk:computed.medianDeliveredAsk,deliveredQ1:computed.deliveredQ1,deliveredQ3:computed.deliveredQ3,
    belowMarketCount:computed.belowMarketCount,nearMarketCount:computed.nearMarketCount,freeShippingCount:computed.freeShippingCount,bestOfferCount:computed.bestOfferCount,
    samples:stored.samples, fetchedAt: row.fetchedAt, expiresAt: row.expiresAt ?? row.fetchedAt, updatedAt: row.updatedAt,
  };
}

type HistoryRow={observedDate:string;observedAt:string;referenceMarketCents:number|null;listingCount:number;reviewedCount:number;acceptedCount:number;lowestCents:number|null;medianCents:number|null;lowestDeliveredCents:number|null;medianDeliveredCents:number|null;deliveredQ1Cents:number|null;deliveredQ3Cents:number|null;belowMarketCount:number;nearMarketCount:number;freeShippingCount:number;bestOfferCount:number;newListingCount:number|null;missingListingCount:number|null;priceReductionCount:number|null};
const dollars=(cents:number|null)=>cents==null?null:cents/100;
export async function readEbayListingHistory(db:D1DatabaseLike,productId:number,now=new Date()):Promise<EbayAskHistory>{
 const from=new Date(now.getTime()-92*86_400_000).toISOString().slice(0,10);
 try{
  const rows=(await db.prepare(`select observed_date as observedDate,observed_at as observedAt,reference_market_cents as referenceMarketCents,listing_count as listingCount,reviewed_count as reviewedCount,accepted_count as acceptedCount,lowest_cents as lowestCents,median_cents as medianCents,lowest_delivered_cents as lowestDeliveredCents,median_delivered_cents as medianDeliveredCents,delivered_q1_cents as deliveredQ1Cents,delivered_q3_cents as deliveredQ3Cents,below_market_count as belowMarketCount,near_market_count as nearMarketCount,free_shipping_count as freeShippingCount,best_offer_count as bestOfferCount,new_listing_count as newListingCount,missing_listing_count as missingListingCount,price_reduction_count as priceReductionCount from ebay_listing_observations where product_id=? and observed_date>=? order by observed_date`).bind(productId,from).all<HistoryRow>()).results??[];
  const points:EbayAskHistoryPoint[]=rows.map(row=>({observedDate:row.observedDate,observedAt:row.observedAt,referenceMarketPrice:dollars(row.referenceMarketCents),listingCount:row.listingCount,reviewedCount:row.reviewedCount,acceptedCount:row.acceptedCount,lowestAsk:dollars(row.lowestCents),medianAsk:dollars(row.medianCents),lowestDeliveredAsk:dollars(row.lowestDeliveredCents),medianDeliveredAsk:dollars(row.medianDeliveredCents),deliveredQ1:dollars(row.deliveredQ1Cents),deliveredQ3:dollars(row.deliveredQ3Cents),belowMarketCount:row.belowMarketCount,nearMarketCount:row.nearMarketCount,freeShippingCount:row.freeShippingCount,bestOfferCount:row.bestOfferCount,newListingCount:row.newListingCount,missingListingCount:row.missingListingCount,priceReductionCount:row.priceReductionCount}));
  return {points};
 }catch(error){if(migrationPending(error))return {points:[]};throw error}
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
  const row = await db.prepare(`select p.product_id as productId,p.kind,p.game,p.name,p.set_name as setName,p.card_number as number,p.section,cp.market_cents as marketCents
    from catalog_products p left join current_prices cp on cp.product_id=p.product_id where p.product_id=?`)
    .bind(productId).first<PoolRow>();
  return row ? { productId: row.productId, kind: row.kind, game: row.game, name: row.name, set: row.setName, number: row.number, section: row.section, marketCents: row.marketCents } : null;
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
    await writeEbayListing(db, productId, result.query, result.categoryId, result.summary, fetchedAt, fetchedAt.slice(0, 10),target.marketCents);
    const snapshot = await readEbayListing(db, productId);
    if (!snapshot) return { status: "upstream-error", snapshot: null, upstreamStatus: 502 };
    return { status: "refreshed", snapshot };
  } finally {
    await releaseEbayFetchLease(db, productId, holder).catch(() => { /* the short lease expires on its own */ });
  }
}
