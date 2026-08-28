import assert from "node:assert/strict";
import {readFile,readdir} from "node:fs/promises";
import {DatabaseSync} from "node:sqlite";
import test from "node:test";
import {METRIC_SERIES,metricsBackfillStatements,readMetricSeries,runMetricsRollup} from "../db/metrics-ingestion.ts";
import {publishedIngestion,startIngestion,upsertCard,upsertHistory} from "../db/repository.ts";

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

const day=offset=>new Date(Date.now()-offset*86_400_000).toISOString().slice(0,10);
const card=(productId,marketPrice)=>({game:"pokemon",section:"illustration-rares",productId,name:`Card ${productId}`,set:"Fixture Set",year:2026,rarity:"Illustration Rare",number:`${productId}/100`,image:"",url:"https://example.com",marketPrice,lowPrice:null,midPrice:null,highPrice:null,printing:"Holofoil",priceChange:null});
const testSeries=[
  {key:"index:test",select:"index",topN:2,floor:3,where:"p.kind='single' and o.variant=p.printing and o.condition='Near Mint' and o.market_cents>0"},
  {key:"median:test",select:"median",floor:3,where:"p.kind='single' and o.variant=p.printing and o.condition='Near Mint' and o.market_cents>0"},
];

test("metrics rollup writes per-date index and median rows and skips sparse dates",async()=>{
  const db=new LocalD1(await migratedDatabase());
  await startIngestion(db,"live-daily:seed","tcgcsv-live","2026-08-28T00:00:00Z",{});
  for(const [id,market] of [[1,100],[2,50],[3,20]])await upsertCard(db,card(id,market),"2026-08-28T00:00:00Z","live-daily:seed");
  // Latest day observes the full cohort; the prior day only one card (below the floor of 3).
  await upsertHistory(db,1,"Holofoil","Near Mint",[{date:day(2),price:90},{date:day(1),price:100}],"now");
  await upsertHistory(db,2,"Holofoil","Near Mint",[{date:day(1),price:50}],"now");
  await upsertHistory(db,3,"Holofoil","Near Mint",[{date:day(1),price:20}],"now");
  await db.prepare("insert into market_signals (product_id, side, strictness, score, confidence, reason, detail, distance_bps, cutoff_bps, as_of_date, observation_date, coverage) values (1,'buy','balanced',88,'high','Within 1% of 30-day low','fixture',100,225,'2026-08-28','2026-08-28','exact')").bind().run();
  const result=await runMetricsRollup(db,{mode:"backfill",series:testSeries});
  assert.equal(result.done,true);
  // The rollup snapshots the day's balanced boards for the signal track record.
  assert.equal(result.signalSnapshots,1);
  const snapshot=await db.prepare("select side, product_id as productId, score, price_cents as priceCents, rank from signal_history").bind().first();
  assert.deepEqual({...snapshot},{side:"buy",productId:1,score:88,priceCents:10000,rank:1});
  const series=await readMetricSeries(db);
  // Index = mean of the top 2 prices (100, 50); the sparse day never appears.
  assert.deepEqual(series["index:test"],[{date:day(1),value:75,members:2}]);
  // Median of [100, 50, 20] is 50, carrying the full cohort as members.
  assert.deepEqual(series["median:test"],[{date:day(1),value:50,members:3}]);
  assert.equal((await publishedIngestion(db,"metrics-rollup"))?.runId,`metrics-rollup:${new Date().toISOString().slice(0,10)}`);
  // Daily mode is idempotent over the same date.
  await runMetricsRollup(db,{mode:"daily",series:testSeries});
  assert.equal((await readMetricSeries(db))["index:test"].length,1);
});

test("percentage-baseline indexes size membership to each date's cohort",async()=>{
  const db=new LocalD1(await migratedDatabase());
  await startIngestion(db,"live-daily:seed","tcgcsv-live","2026-08-28T00:00:00Z",{});
  for(const [id,market] of [[1,100],[2,50],[3,20]])await upsertCard(db,card(id,market),"2026-08-28T00:00:00Z","live-daily:seed");
  for(const [id,price] of [[1,100],[2,50],[3,20]])await upsertHistory(db,id,"Holofoil","Near Mint",[{date:day(1),price}],"now");
  const pctSeries=[{key:"index:pct",select:"index",topPct:0.66,floor:3,where:"p.kind='single' and o.variant=p.printing and o.condition='Near Mint' and o.market_cents>0"}];
  await runMetricsRollup(db,{mode:"backfill",series:pctSeries});
  // 66% of a 3-observation cohort rounds to 2 members: mean of 100 and 50.
  assert.deepEqual((await readMetricSeries(db))["index:pct"],[{date:day(1),value:75,members:2}]);
});

test("backfill statements are literal SQL that a bind-less runner can execute",async()=>{
  const db=new LocalD1(await migratedDatabase());
  await startIngestion(db,"live-daily:seed","tcgcsv-live","2026-08-28T00:00:00Z",{});
  for(const [id,market] of [[1,100],[2,50],[3,20]])await upsertCard(db,card(id,market),"2026-08-28T00:00:00Z","live-daily:seed");
  for(const [id,price] of [[1,100],[2,50],[3,20]])await upsertHistory(db,id,"Holofoil","Near Mint",[{date:day(1),price}],"now");
  const statements=metricsBackfillStatements([{key:"index:test",select:"index",topN:2,floor:3,where:"p.kind='single' and o.variant=p.printing and o.condition='Near Mint' and o.market_cents>0"}]);
  assert.equal(statements.length,2);
  assert.match(statements[0],/^delete from market_daily_metrics where series='index:test'$/);
  assert.doesNotMatch(statements[1],/\?/);
  for(const statement of statements)await db.prepare(statement).bind().run();
  assert.deepEqual((await readMetricSeries(db))["index:test"],[{date:day(1),value:75,members:2}]);
  // The full production list generates two statements per series, all literal.
  assert.equal(metricsBackfillStatements().length,METRIC_SERIES.length*2);
});

test("even cohorts take the mean of the two middle ranks as the median",async()=>{
  const db=new LocalD1(await migratedDatabase());
  await startIngestion(db,"live-daily:seed","tcgcsv-live","2026-08-28T00:00:00Z",{});
  for(const [id,market] of [[1,100],[2,60],[3,40],[4,10]])await upsertCard(db,card(id,market),"2026-08-28T00:00:00Z","live-daily:seed");
  for(const [id,price] of [[1,100],[2,60],[3,40],[4,10]])await upsertHistory(db,id,"Holofoil","Near Mint",[{date:day(1),price}],"now");
  await runMetricsRollup(db,{mode:"backfill",series:testSeries});
  const series=await readMetricSeries(db);
  assert.equal(series["median:test"][0].value,50);
});
