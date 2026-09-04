import assert from "node:assert/strict";
import {readFile,readdir} from "node:fs/promises";
import {DatabaseSync} from "node:sqlite";
import test from "node:test";
import {runDailyMarketIngestion} from "../db/daily-ingestion.ts";
import {upsertHistory} from "../db/repository.ts";
import {TIER_DAILY_MIN_DEPTH,dueHistoryTargets,historyTier,readHistoryTargetRows,readHistoryTargetRowsFor,tierDue,utcDayNumber} from "../db/history-targets.ts";

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

test("history tiers classify by liquidity, movement, and depth",()=>{
  const base={sales30:null,change7Bps:null,depth:30,marketCents:500};
  assert.equal(historyTier({...base,sales30:5}),"daily");
  assert.equal(historyTier({...base,depth:3}),"daily");          // new product needs depth fast
  assert.equal(historyTier({...base,change7Bps:-1200}),"daily"); // movement promotes a waking product
  assert.equal(historyTier({...base,sales30:1}),"spread3");
  assert.equal(historyTier({...base,marketCents:2500}),"spread3");
  assert.equal(historyTier(base),"weekly");
});

test("off-day tiers stagger by product id",()=>{
  const day=utcDayNumber("2026-08-28");
  assert.equal(tierDue("daily",123,day),true);
  // A spread3 product is due exactly every third day; a weekly product once a week.
  const due3=[0,1,2,3,4,5].filter(offset=>tierDue("spread3",7,day+offset));
  assert.equal(due3.length,2);
  assert.equal(due3[1]-due3[0],3);
  assert.equal([0,1,2,3,4,5,6].filter(offset=>tierDue("weekly",11,day+offset)).length,1);
});

test("a run's target rows are read once per database; a new run key reads again",async()=>{
  const database=await migratedDatabase(),db=new LocalD1(database);
  let prepared=0;const counting={prepare(sql){prepared++;return db.prepare(sql)},batch:statements=>db.batch(statements)};
  const first=await readHistoryTargetRowsFor(counting,"history-daily:2026-08-28");
  assert.equal(await readHistoryTargetRowsFor(counting,"history-daily:2026-08-28"),first);
  assert.equal(prepared,1);
  await readHistoryTargetRowsFor(counting,"history-daily:2026-08-29");
  assert.equal(prepared,2);
  database.close();
});

test("due targets derive from the live catalog with tier cadence (M5+M4)",async()=>{
  const database=await migratedDatabase(),db=new LocalD1(database);
  const day=utcDayNumber("2026-08-28");
  // Ids chosen so the two mature products are OFF their stagger slot on the fixture date.
  const weeklyId=[21,22,23,24,25,26,27].find(id=>id%7!==day%7);
  const spreadId=[31,32,33].find(id=>id%3!==day%3);
  const newId=41;
  const cardOf=(productId,marketPrice)=>({game:"pokemon",section:"illustration-rares",productId,name:`Card ${productId}`,set:"Fixture Set",year:2026,rarity:"Illustration Rare",number:"1/1",image:"https://example.com/c.jpg",url:"https://example.com/c",marketPrice,lowPrice:marketPrice-1,midPrice:marketPrice,highPrice:marketPrice+1,printing:"Holofoil",priceChange:null});
  const sealedNew={game:"pokemon",productId:newId,name:"New Fixture Box",set:"Fixture Set",category:"Booster Boxes",image:null,url:"https://example.com/s",msrp:null,marketPrice:79.99,midPrice:null,profit:null,profitPct:null,msrpSource:null};
  await runDailyMarketIngestion(db,{cards:[cardOf(weeklyId,5),cardOf(spreadId,25)],sealed:[sealedNew],source:"fixture",sourceUpdatedAt:"2026-08-28",schemaVersion:1},new Date("2026-08-28T12:00:00Z"));
  // Deepen the mature products past the new-product threshold; the sealed box keeps
  // only its day-one observation.
  const backPoints=Array.from({length:TIER_DAILY_MIN_DEPTH+10},(_,i)=>({date:new Date(Date.UTC(2026,6,1+i)).toISOString().slice(0,10),price:5}));
  await upsertHistory(db,weeklyId,"Holofoil","Near Mint",backPoints,"2026-08-28T12:00:00Z");
  await upsertHistory(db,spreadId,"Holofoil","Near Mint",backPoints,"2026-08-28T12:00:00Z");
  const rows=await readHistoryTargetRows(db);
  assert.deepEqual(rows.map(row=>row.productId),[weeklyId,spreadId,newId]);
  // Depth is consulted only below TIER_DAILY_MIN_DEPTH, so the read stops counting there
  // (the deepened products hold 25 observations each).
  assert.deepEqual(rows.map(row=>row.depth),[TIER_DAILY_MIN_DEPTH,TIER_DAILY_MIN_DEPTH,1]);
  // Only the thin-depth sealed product is due on the fixture date (M4 cadence)...
  assert.deepEqual(dueHistoryTargets(rows,"2026-08-28"),[{productId:newId,printing:"Sealed",sealed:true,currentPrice:79.99}]);
  // ...while an operator run covers everything, singles keeping their catalog printing.
  const all=dueHistoryTargets(rows,"2026-08-28",{all:true});
  assert.equal(all.length,3);
  assert.deepEqual(all.find(target=>target.productId===spreadId),{productId:spreadId,printing:"Holofoil",currentPrice:25});
  database.close();
});
