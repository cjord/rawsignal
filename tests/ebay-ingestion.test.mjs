import assert from "node:assert/strict";
import {readFile,readdir} from "node:fs/promises";
import {DatabaseSync} from "node:sqlite";
import test from "node:test";
import {EBAY_LISTINGS_KEY,readEbayListing,readEbayListingHistory,resolveEbayListing,runEbayListingsBatch,writeEbayListing} from "../db/ebay-ingestion.ts";
import {publishedIngestion,readRefreshCursor,startIngestion,upsertCard,upsertSealedProduct} from "../db/repository.ts";

class LocalStatement{
  constructor(statement){this.statement=statement;this.values=[]}
  bind(...values){this.values=values;return this}
  async run(){return this.statement.run(...this.values)}
  async first(){return this.statement.get(...this.values)??null}
  async all(){return{results:this.statement.all(...this.values)}}
}

class LocalD1{
  constructor(database){this.database=database}
  prepare(sql){return new LocalStatement(this.database.prepare(sql))}
  async batch(statements){this.database.exec("begin");try{const results=[];for(const statement of statements)results.push(await statement.run());this.database.exec("commit");return results}catch(error){this.database.exec("rollback");throw error}}
}

async function migratedDatabase(){
  const database=new DatabaseSync(":memory:");database.exec("pragma foreign_keys=on");
  const directory=new URL("../drizzle/",import.meta.url),names=(await readdir(directory)).filter(name=>/^\d+.*\.sql$/.test(name)).sort();
  for(const name of names){const migration=await readFile(new URL(name,directory),"utf8");for(const statement of migration.split("--> statement-breakpoint").map(value=>value.trim()).filter(Boolean))database.exec(statement)}
  return database;
}

const card=(productId,marketPrice)=>({game:"pokemon",section:"illustration-rares",productId,name:`Card ${productId} - ${productId}/100`,set:"Fixture Set",year:2026,rarity:"Illustration Rare",number:`${productId}/100`,image:"",url:"https://example.com",marketPrice,lowPrice:null,midPrice:null,highPrice:null,printing:"Holofoil",priceChange:null});
const box=(productId,marketPrice)=>({game:"pokemon",productId,name:`Box ${productId}`,set:"Fixture Set",category:"Booster Boxes",image:null,url:"https://example.com",msrp:150,marketPrice,midPrice:null,profit:null,profitPct:null,msrpSource:null});
const NOW=new Date("2026-08-28T12:00:00Z");
const sample={itemId:"v1|1|0",title:"Card 1 NM",price:20,shipping:null,condition:"Ungraded",imageUrl:"https://i.ebayimg.com/1.jpg",url:"https://www.ebay.com/itm/1"};
const okSummary={listingCount:12,acceptedCount:8,lowestAsk:20,medianAsk:25.5,samples:[sample]};

async function seededDb(){
  const db=new LocalD1(await migratedDatabase());
  await startIngestion(db,"live-daily:2026-08-28","tcgcsv-live","2026-08-28T00:00:00Z",{});
  // Two priced singles, one below the $20 floor, and one sealed product.
  for(const [id,market] of [[1,500],[2,300],[3,10]])await upsertCard(db,card(id,market),"2026-08-28T00:00:00Z","live-daily:2026-08-28");
  await upsertSealedProduct(db,box(10,200),"2026-08-28T00:00:00Z","live-daily:2026-08-28");
  return db;
}

const deps=(respond)=>{const fetched=[];return {fetched,async fetchListings(target){fetched.push(target.productId);return respond(target)},wait:async()=>{}}};
const ok=target=>({status:200,query:`q ${target.productId}`,categoryId:target.kind==="single"?183454:null,summary:okSummary});

test("on-demand eBay access remains available for a catalog-only unpriced single",async()=>{
 const db=await seededDb();
 await upsertCard(db,{...card(20,null),game:"riftbound",section:"metal-promos",name:"Kai'Sa, Daughter of the Void (Metal) (Best Of)"},NOW.toISOString(),"live-daily:2026-08-28");
 const source=deps(target=>{assert.equal(target.marketCents,null);return ok(target)});
 const result=await resolveEbayListing(db,20,source,{now:NOW});
 assert.equal(result.status,"refreshed");assert.equal(result.snapshot.samples.length,1);assert.deepEqual(source.fetched,[20]);
 const cached=await resolveEbayListing(db,20,source,{now:NOW});assert.equal(cached.status,"fresh");assert.deepEqual(source.fetched,[20]);
});

test("a tick walks never-fetched products by market price, checkpoints its call count, and the day's run completes when the pool is exhausted",async()=>{
  const db=await seededDb();
  const first=deps(ok);
  const tick=await runEbayListingsBatch(db,first,{calls:2,now:NOW});
  assert.deepEqual(first.fetched,[1,2]);
  assert.deepEqual({calls:tick.calls,updated:tick.updated,targets:tick.targets,done:tick.done,stopped:tick.stopped,runId:tick.runId},{calls:2,updated:2,targets:2,done:false,stopped:null,runId:"ebay-listings:2026-08-28"});
  // The snapshot round-trips, in dollars, with its samples and the day it was fetched.
  const stored=await readEbayListing(db,1);
  assert.deepEqual({query:stored.query,categoryId:stored.categoryId,listingCount:stored.listingCount,reviewedCount:stored.reviewedCount,acceptedCount:stored.acceptedCount,lowestAsk:stored.lowestAsk,medianAsk:stored.medianAsk,samples:stored.samples,fetchedAt:null,expiresAt:null,updatedAt:stored.updatedAt},{query:"q 1",categoryId:183454,listingCount:12,reviewedCount:8,acceptedCount:8,lowestAsk:20,medianAsk:25.5,samples:[sample],fetchedAt:null,expiresAt:null,updatedAt:"2026-08-28"});
  assert.equal(await readEbayListing(db,3),null);
  assert.equal(await publishedIngestion(db,EBAY_LISTINGS_KEY),null);
  assert.equal((await readRefreshCursor(db,EBAY_LISTINGS_KEY)).cursor,"2");
  // The next tick resumes the count, skips today's rows, reaches the sealed product, and completes.
  const second=deps(ok);
  const next=await runEbayListingsBatch(db,second,{calls:2,now:NOW});
  assert.deepEqual(second.fetched,[10]);
  assert.deepEqual({calls:next.calls,updated:next.updated,done:next.done},{calls:3,updated:3,done:true});
  const published=await publishedIngestion(db,EBAY_LISTINGS_KEY);
  assert.equal(published.runId,"ebay-listings:2026-08-28");
  assert.deepEqual(JSON.parse(published.statsJson),{calls:3,updated:3,dailyBudget:1500,stopped:null});
  // Nothing left today: a further tick makes no calls and stays complete.
  const third=deps(ok);
  assert.deepEqual(await runEbayListingsBatch(db,third,{calls:2,now:NOW}),{runId:"ebay-listings:2026-08-28",calls:3,updated:3,targets:0,stopped:null,done:true});
  assert.deepEqual(third.fetched,[]);
});

test("stale snapshots refresh after never-fetched products, and a thin result still records the count",async()=>{
  const db=await seededDb();
  await db.prepare("insert into ebay_listings (product_id,query,category_id,listing_count,lowest_cents,median_cents,samples_json,fetched_at,updated_at) values (1,'old',183454,3,1000,1200,'[]','2026-08-20T00:00:00Z','2026-08-20')").bind().run();
  const thin=deps(target=>target.productId===2?{status:200,query:"q 2",categoryId:183454,summary:{listingCount:2,acceptedCount:2,lowestAsk:null,medianAsk:null,samples:[]}}:ok(target));
  const tick=await runEbayListingsBatch(db,thin,{calls:3,now:NOW});
  assert.deepEqual(thin.fetched,[2,10,1]);
  assert.equal(tick.updated,3);
  const stored=await readEbayListing(db,2);
  assert.deepEqual({query:stored.query,categoryId:stored.categoryId,listingCount:stored.listingCount,reviewedCount:stored.reviewedCount,acceptedCount:stored.acceptedCount,lowestAsk:stored.lowestAsk,medianAsk:stored.medianAsk,samples:stored.samples,updatedAt:stored.updatedAt},{query:"q 2",categoryId:183454,listingCount:2,reviewedCount:2,acceptedCount:2,lowestAsk:null,medianAsk:null,samples:[],updatedAt:"2026-08-28"});
  assert.equal((await readEbayListing(db,1)).lowestAsk,20);
});

test("a rate limit or an auth failure ends the day's run; repeated server errors stop it after five",async()=>{
  const limited=await seededDb();
  const limitedDeps=deps(()=>({status:429,query:"q",categoryId:null,summary:null}));
  const limitedTick=await runEbayListingsBatch(limited,limitedDeps,{calls:5,now:NOW});
  assert.deepEqual({calls:limitedTick.calls,updated:limitedTick.updated,stopped:limitedTick.stopped,done:limitedTick.done},{calls:1,updated:0,stopped:"rate-limited",done:true});
  assert.equal((await publishedIngestion(limited,EBAY_LISTINGS_KEY)).runId,"ebay-listings:2026-08-28");
  const denied=await seededDb();
  const deniedTick=await runEbayListingsBatch(denied,deps(()=>({status:401,query:"q",categoryId:null,summary:null})),{calls:5,now:NOW});
  assert.deepEqual({stopped:deniedTick.stopped,done:deniedTick.done},{stopped:"auth",done:true});
  const failing=await seededDb();
  // Three products in the pool: every call fails, but fewer than five failures just skip.
  const failingDeps=deps(()=>({status:500,query:"q",categoryId:null,summary:null}));
  const failingTick=await runEbayListingsBatch(failing,failingDeps,{calls:5,now:NOW});
  assert.deepEqual({calls:failingTick.calls,updated:failingTick.updated,stopped:failingTick.stopped,done:failingTick.done},{calls:3,updated:0,stopped:null,done:true});
});

test("the daily budget caps a tick and completes the run once spent",async()=>{
  const db=await seededDb();
  const budgeted=deps(ok);
  const tick=await runEbayListingsBatch(db,budgeted,{calls:5,dailyBudget:1,now:NOW});
  assert.deepEqual(budgeted.fetched,[1]);
  assert.deepEqual({calls:tick.calls,done:tick.done},{calls:1,done:true});
  assert.deepEqual(JSON.parse((await publishedIngestion(db,EBAY_LISTINGS_KEY)).statsJson),{calls:1,updated:1,dailyBudget:1,stopped:null});
});

test("on-demand lookup shares a fresh six-hour snapshot without spending another call",async()=>{
  const db=await seededDb(),now=new Date("2026-08-28T12:00:00Z");
  await db.prepare("insert into ebay_listings (product_id,query,category_id,listing_count,accepted_count,lowest_cents,median_cents,samples_json,fetched_at,expires_at,updated_at) values (1,'cached',183454,12,8,2000,2550,?,'2026-08-28T10:00:00.000Z','2026-08-28T16:00:00.000Z','2026-08-28')").bind(JSON.stringify([sample])).run();
  const fetch=deps(ok),result=await resolveEbayListing(db,1,fetch,{now,leaseId:()=>"lease-a"});
  assert.equal(result.status,"fresh");assert.equal(result.snapshot.query,"cached");assert.deepEqual(fetch.fetched,[]);
  assert.equal(await db.prepare("select calls from ebay_api_usage where usage_date='2026-08-28'").first(),null);
});

test("an expired or missing snapshot refreshes once and records the shared daily quota",async()=>{
  const db=await seededDb(),fetch=deps(ok),now=new Date("2026-08-28T12:00:00Z");
  const result=await resolveEbayListing(db,1,fetch,{now,leaseId:()=>"lease-b"});
  assert.equal(result.status,"refreshed");assert.equal(result.snapshot.expiresAt,"2026-08-28T18:00:00.000Z");assert.deepEqual(fetch.fetched,[1]);
  assert.deepEqual({...await db.prepare("select calls,on_demand_calls as onDemandCalls from ebay_api_usage where usage_date='2026-08-28'").first()},{calls:1,onDemandCalls:1});
  assert.equal(await db.prepare("select holder from ebay_fetch_leases where product_id=1").first(),null);
  const history=await readEbayListingHistory(db,1,now);
  assert.equal(history.points.length,1);assert.equal(history.points[0].referenceMarketPrice,500);assert.equal(history.points[0].acceptedCount,8);
});

test("daily ask history updates in place and records listing turnover without calling it sales",async()=>{
  const db=await seededDb(),rich={...sample,shipping:0,deliveredPrice:20,buyingOptions:["FIXED_PRICE"],sellerFeedbackPercentage:99.8,sellerFeedbackScore:100,topRated:true,watchCount:3,listedAt:"2026-08-20T00:00:00Z",endsAt:null,locationCountry:"US",matchConfidence:"high"};
  const first={...okSummary,reviewedCount:1,acceptedCount:1,highConfidenceCount:1,lowestDeliveredAsk:20,medianDeliveredAsk:20,deliveredQ1:20,deliveredQ3:20,belowMarketCount:1,nearMarketCount:0,freeShippingCount:1,bestOfferCount:0,samples:[rich]};
  await writeEbayListing(db,1,"q",183454,first,"2026-08-28T08:00:00Z","2026-08-28",50000);
  const replacement={...rich,itemId:"v1|2|0",price:19,deliveredPrice:19};
  await writeEbayListing(db,1,"q",183454,{...first,lowestAsk:19,medianAsk:19,lowestDeliveredAsk:19,medianDeliveredAsk:19,deliveredQ1:19,deliveredQ3:19,samples:[replacement]},"2026-08-28T14:00:00Z","2026-08-28",50000);
  const history=await readEbayListingHistory(db,1,new Date("2026-08-28T14:00:00Z"));
  assert.equal(history.points.length,1);
  assert.deepEqual({observedAt:history.points[0].observedAt,newListingCount:history.points[0].newListingCount,missingListingCount:history.points[0].missingListingCount,priceReductionCount:history.points[0].priceReductionCount},{observedAt:"2026-08-28T14:00:00Z",newListingCount:1,missingListingCount:1,priceReductionCount:0});
});

test("on-demand lookup preserves headroom and never serves an expired snapshot",async()=>{
  const db=await seededDb(),now=new Date("2026-08-28T12:00:00Z");
  await db.prepare("insert into ebay_api_usage (usage_date,calls,on_demand_calls,background_calls,updated_at) values ('2026-08-28',4,4,0,'2026-08-28T11:00:00Z')").run();
  const fetch=deps(ok),result=await resolveEbayListing(db,1,fetch,{now,dailyLimit:5,onDemandBudget:4,leaseId:()=>"lease-c"});
  assert.deepEqual(result,{status:"quota",snapshot:null});assert.deepEqual(fetch.fetched,[]);
});

test("an active per-product lease coalesces concurrent on-demand misses",async()=>{
  const db=await seededDb(),now=new Date("2026-08-28T12:00:00Z");
  await db.prepare("insert into ebay_fetch_leases (product_id,holder,expires_at) values (1,'other','2026-08-28T12:00:30.000Z')").run();
  const fetch=deps(ok),result=await resolveEbayListing(db,1,fetch,{now,leaseId:()=>"lease-d"});
  assert.deepEqual(result,{status:"busy",snapshot:null});assert.deepEqual(fetch.fetched,[]);
});
