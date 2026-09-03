import assert from "node:assert/strict";
import {readFile,readdir} from "node:fs/promises";
import {DatabaseSync} from "node:sqlite";
import test from "node:test";
import {METRIC_SERIES,metricsBackfillStatements,readMetricSeries,runMetricsRollup} from "../db/metrics-ingestion.ts";
import {publishedIngestion,readCohortStats,startIngestion,upsertCard,upsertHistory,upsertSealedProduct} from "../db/repository.ts";
import {loadMetricsPayload} from "../db/metrics-service.ts";

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
  // Challenger row (P1b): the rollup snapshots the shadow board in the parallel table.
  await db.prepare("insert into shadow_signals (product_id, side, score, confidence, reason, detail, distance_bps, cutoff_bps, as_of_date, updated_at) values (2,'buy',74,'medium','Within 2% of 90-day typical low','fixture',200,225,'2026-08-28','now')").bind().run();
  // Cohort fixture (P4): eight same-cohort members with known 30-day changes.
  const cohortBps=[-500,-300,-100,100,200,300,400,600];
  for(let index=0;index<cohortBps.length;index++){
    const id=100+index;
    await upsertCard(db,card(id,25),"2026-08-28T00:00:00Z","live-daily:seed");
    await db.prepare("insert into market_metrics (product_id, variant, condition, as_of_date, coverage, change_30_bps, updated_at) values (?,?,?,?,?,?,?)").bind(id,"Holofoil","Near Mint","2026-08-28","exact",cohortBps[index],"now").run();
  }
  const result=await runMetricsRollup(db,{mode:"backfill",series:testSeries});
  assert.equal(result.done,true);
  // The rollup snapshots the day's balanced boards for the signal track record.
  assert.equal(result.signalSnapshots,1);
  const snapshot=await db.prepare("select side, product_id as productId, score, price_cents as priceCents, rank from signal_history").bind().first();
  assert.deepEqual({...snapshot},{side:"buy",productId:1,score:88,priceCents:10000,rank:1});
  assert.equal(result.shadowSnapshots,1);
  const shadow=await db.prepare("select side, strictness, product_id as productId, score, rank from shadow_signal_history").bind().first();
  assert.deepEqual({...shadow},{side:"buy",strictness:"balanced",productId:2,score:74,rank:1});
  // Cohort stats (P4): both ladder rungs materialize with the median and breadth.
  assert.equal(result.cohorts,2);
  const rung=await db.prepare("select members, median_change30_bps as median, breadth_pct as breadth from cohort_stats where cohort_key='single|pokemon|Fixture Set|Illustration Rare'").bind().first();
  assert.deepEqual({...rung},{members:8,median:150,breadth:63});
  const fallback=await db.prepare("select members from cohort_stats where cohort_key='single|pokemon|Illustration Rare'").bind().first();
  assert.equal(fallback.members,8);
  // The lookup prefers the set rung and converts to the evaluator's shape:
  // ln(1 + 150bps) ≈ 0.014889, breadth passthrough.
  const looked=await readCohortStats(db,100);
  assert.ok(Math.abs(looked.logReturn30-Math.log(1.015))<1e-9);
  assert.equal(looked.breadth,63);
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

test("the metrics payload prices per-set pack EV from pull rates and live pack prices",async()=>{
  const db=new LocalD1(await migratedDatabase());
  await startIngestion(db,"live-daily:seed","tcgcsv-live","2026-08-28T00:00:00Z",{});
  for(const [id,market] of [[1,100],[2,50]])await upsertCard(db,card(id,market),"2026-08-28T00:00:00Z","live-daily:seed");
  await upsertSealedProduct(db,{game:"pokemon",productId:9,name:"Fixture Booster Pack",set:"Fixture Set",category:"Booster Packs",image:null,url:"https://example.com/pack",msrp:null,marketPrice:4,midPrice:4.5,profit:null,profitPct:null,msrpSource:null},"2026-08-28T00:00:00Z","live-daily:seed");
  for(const [id,price] of [[1,100],[2,50]])await upsertHistory(db,id,"Holofoil","Near Mint",[{date:day(1),price}],"now");
  await runMetricsRollup(db,{mode:"backfill",series:testSeries});
  const pullRates={note:"",sources:[],games:{pokemon:{default:{"Illustration Rare":8},sets:{}}}};
  const payload=await loadMetricsPayload(db,{pullRates});
  const set=payload.sets.find(row=>row.set==="Fixture Set");
  // Tier average (100+50)/2=75 at 1-in-8 packs → EV $9.375 against a $4 live pack.
  assert.equal(set.packEv,9.375);
  assert.equal(set.packPrice,4);
  assert.equal(set.evRatio,9.375/4);
  // Era rollup folds the fixture set (year 2026 → Mega era) with its tracked totals.
  const era=payload.eras.find(row=>row.era==="me");
  assert.equal(era.cards,2);
  assert.equal(era.trackedValue,150);
  assert.equal(era.sets,1);
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

test("an explicit asOfDate keys the run id and the snapshot day (R1: rollups follow the live run's date)",async()=>{
  const database=await migratedDatabase(),db=new LocalD1(database);
  await startIngestion(db,"live-daily:2026-08-27","tcgcsv-live","2026-08-27T20:10:00Z",{});
  await upsertCard(db,card(1,100),"2026-08-27T20:10:00Z","live-daily:2026-08-27");
  await upsertHistory(db,1,"Holofoil","Near Mint",[{date:"2026-08-26",price:95},{date:"2026-08-27",price:100}],"now");
  await db.prepare("insert into market_signals (product_id, side, strictness, score, confidence, reason, detail, distance_bps, cutoff_bps, as_of_date, observation_date, coverage) values (1,'buy','balanced',80,'high','Near low','d',100,500,'2026-08-27','2026-08-27','exact')").run();
  // The tick runs this at ~05:00Z on the 28th for the run that ingested the 27th's publish.
  const result=await runMetricsRollup(db,{mode:"daily",series:testSeries,asOfDate:"2026-08-27",now:new Date("2026-08-28T05:10:00Z")});
  assert.equal(result.runId,"metrics-rollup:2026-08-27");
  assert.equal(database.prepare("select status from ingestion_runs where id=?").get("metrics-rollup:2026-08-27")?.status,"succeeded");
  // The track-record snapshot is dated by the data day, not the wall clock.
  assert.deepEqual(database.prepare("select distinct observed_date d from signal_history").all().map(r=>r.d),["2026-08-27"]);
  // Without asOfDate the wall-clock day still keys operator/backfill runs.
  const fallback=await runMetricsRollup(db,{mode:"daily",series:testSeries,now:new Date("2026-08-28T05:10:00Z")});
  assert.equal(fallback.runId,"metrics-rollup:2026-08-28");
});
