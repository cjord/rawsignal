import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFile, readdir } from "node:fs/promises";
import { createHistorySnapshot, matchingRowHistory, rowHistoryTarget } from "../core/domain/history-snapshot.ts";
import { readHistorySnapshots } from "../db/history-snapshot.ts";
import { historyBatchKey, encodeHistoryTargets, parseHistoryTargets } from "../core/history-batch.ts";
import { persistRecord, persistStoredHistory } from "../db/daily-ingestion.ts";
import { startIngestion, upsertHistory, upsertMarketMetrics } from "../db/repository.ts";
import { readSectionFeed, readSealedFeed } from "../db/catalog-repository.ts";
import { buildCatalogDerived } from "../app/leaderboard/mode-adapter.ts";
import { querySinglesCatalog, querySealedCatalog } from "../core/catalog-query.ts";
import { loadPriceHistoryBatch } from "../app/data/usePriceHistoryBatch.ts";

class Statement {
  constructor(statement) { this.statement=statement; this.values=[]; }
  bind(...values) { this.values=values; return this; }
  async run() { return this.statement.run(...this.values); }
  async all() { return {results:this.statement.all(...this.values)}; }
  async first() { return this.statement.get(...this.values)??null; }
}
class LocalD1 {
  constructor(database) { this.database=database; this.batches=0; this.reads=0; }
  prepare(sql) { if(sql.startsWith("select"))this.reads++; return new Statement(this.database.prepare(sql)); }
  async batch(statements) { this.batches++; this.database.exec("begin"); try {const results=[]; for(const statement of statements)results.push(await statement.run());this.database.exec("commit");return results;}catch(error){this.database.exec("rollback");throw error;} }
}
async function seeded(t) {
  const database=new DatabaseSync(":memory:"); t.after(()=>database.close());
  const directory=new URL("../drizzle/",import.meta.url);
  for(const name of (await readdir(directory)).filter(name=>/^\d+.*\.sql$/.test(name)).sort())database.exec(await readFile(new URL(name,directory),"utf8"));
  const db=new LocalD1(database);
  await startIngestion(db,"fixture","fixture","2026-10-01T00:00:00Z");
  return {db,database};
}
const card={productId:1,game:"pokemon",section:"rares",name:"Card",set:"Set",year:2026,rarity:"Rare",number:"1",printing:"Holofoil",image:"",url:"",marketPrice:30,midPrice:30,lowPrice:1,highPrice:100,priceChange:null};
const sealed={productId:2,game:"pokemon",name:"Box",set:"Set",category:"Booster Boxes",image:null,url:"",marketPrice:30,midPrice:30,msrp:null,msrpSource:null,profit:null,profitPct:null};
const points=[{date:"2026-09-01",price:20},{date:"2026-09-24",price:10},{date:"2026-10-01",price:30}];

test("snapshot points and rounded row metrics are identical for Singles and Sealed without an extra daily batch",async t=>{
 const {db}=await seeded(t);
 for(const item of [card,sealed]){
  const target=rowHistoryTarget(item),condition=target.sealed?"Unopened":"Near Mint";
  await persistRecord(db,item,"2026-10-01T00:00:00Z","2026-10-01","fixture");
  await upsertHistory(db,item.productId,target.printing,condition,points.slice(0,-1),"2026-10-01","tcgcsv-archive");
  db.batches=0;
  await persistRecord(db,item,"2026-10-01T00:00:00Z","2026-10-01","fixture");
  assert.equal(db.batches,2,"catalog+observation batch and metrics+signals batch only");
  const row=(target.sealed?await readSealedFeed(db,"pokemon"):await readSectionFeed(db,["rares"]))[0];
  const versioned=rowHistoryTarget(row),history=(await readHistorySnapshots(db,[versioned])).get(historyBatchKey(versioned));
  assert.deepEqual(history.points,points);
  for(const key of ["change7","change30","low30","high30"])assert.equal(history[key],row.metrics[key]);
  assert.equal(history.snapshotId,row.metrics.snapshotId);
  assert.equal(history.asOfDate,row.metrics.asOfDate);
 }
});

test("previous versions survive a new snapshot, idempotent repeats do not evict them, expired versions fail closed",async t=>{
 const {db,database}=await seeded(t);
 await persistRecord(db,card,"2026-10-01T00:00:00Z","2026-10-01","fixture");
 const original=(await readSectionFeed(db,["rares"]))[0],target=rowHistoryTarget(original);
 for(const price of [40,40]){
  const snapshot=createHistorySnapshot([...points,{date:"2026-10-02",price}],"Holofoil","Near Mint","exact");
  await upsertMarketMetrics(db,1,"Holofoil","Near Mint","2026-10-02",snapshot,"2026-10-02T00:00:00Z");
  assert.equal((await readHistorySnapshots(db,[target])).get(historyBatchKey(target)).snapshotId,target.snapshotId);
 }
 const last=createHistorySnapshot([...points,{date:"2026-10-03",price:50}],"Holofoil","Near Mint","exact");
 await upsertMarketMetrics(db,1,"Holofoil","Near Mint","2026-10-03",last,"2026-10-03T00:00:00Z");
 assert.equal((await readHistorySnapshots(db,[target])).get(historyBatchKey(target)),null);
 assert.ok(database.prepare("select previous_history_snapshot_json from market_metrics").get().previous_history_snapshot_json);
});

test("refreshing upstream history preserves daily/archive observations in the shared snapshot",async t=>{
 const {db}=await seeded(t);
 await persistRecord(db,card,"2026-10-01T00:00:00Z","2026-10-01","fixture");
 await upsertHistory(db,1,"Holofoil","Near Mint",points.slice(0,-1),"2026-10-02");
 await persistStoredHistory(db,1,"Holofoil","Near Mint",30,"2026-10-02T00:00:00Z");
 const row=(await readSectionFeed(db,["rares"]))[0],target=rowHistoryTarget(row);
 assert.deepEqual((await readHistorySnapshots(db,[target])).get(historyBatchKey(target)).points,points);
 const wrong={productId:1,printing:"Normal"};
 assert.equal((await readHistorySnapshots(db,[wrong])).get(historyBatchKey(wrong)),null);
});

test("hover loads cannot reorder either leaderboard, change membership, or substitute stale metrics",()=>{
 const snapshot=createHistorySnapshot(points,"Holofoil","Near Mint","exact"),metrics={...snapshot,regime:"steady"};
 const items=[{...card,metrics},{...card,productId:3,name:"Other",metrics:{...metrics,low30:20,high30:40,change7:5,change30:10}}];
 const changed={1:{...snapshot,low30:999,high30:999,change7:-99,change30:-99,snapshotId:"newer"}};
 const before=buildCatalogDerived(items,{}, {ready:false,derived:{}},()=>null),after=buildCatalogDerived(items,changed,{ready:false,derived:{}},()=>null);
 assert.deepEqual(before,after);
 assert.deepEqual(matchingRowHistory(metrics,changed[1]).points,[]);
 assert.equal(matchingRowHistory(metrics,changed[1]).low30,snapshot.low30);
 const options={market:"pokemon",sections:[],query:"",sets:[],minPrice:"",maxPrice:"",marketMin:"",marketMax:"",msrpMin:"",msrpMax:"",profitMin:"",profitMax:"",profitPctMin:"",profitPctMax:"",productTypes:[],up7:true,down7:false,up30:false,down30:false,signal:"leaderboard",strictness:"balanced",direction:"asc",page:1,perPage:20,basis:"market",keepPct:100,taxOn:false,taxRate:0,shipping:0,profitableOnly:false};
 for(const sort of ["low","high","change7","change30","market"]){
  assert.deepEqual(querySinglesCatalog(items,{...options,sort},before),querySinglesCatalog(items,{...options,sort},after));
  const boxes=items.map(item=>({...sealed,productId:item.productId,metrics:item.metrics}));
  assert.deepEqual(querySealedCatalog(boxes,{...options,sort},before),querySealedCatalog(boxes,{...options,sort},after));
 }
});

test("snapshot versions round-trip and mismatched responses never replace requested metrics",async()=>{
 const snapshot=createHistorySnapshot(points,"Holofoil","Near Mint","exact");
 const target={productId:1,printing:"Holofoil",snapshotId:snapshot.snapshotId};
 assert.deepEqual(parseHistoryTargets(encodeHistoryTargets([target])),[target]);
 const calls=[];
 const fetcher=async url=>{calls.push(url);return new Response(JSON.stringify({...snapshot,snapshotId:"wrong-version"}));};
 const [entry]=await loadPriceHistoryBatch([target],new AbortController().signal,fetcher);
 assert.deepEqual(entry.history.points,[]);
 assert.match(calls[0],new RegExp(`snapshot=${snapshot.snapshotId}`));
 const missing=await loadPriceHistoryBatch([{...target,snapshotId:"unavailable"}],new AbortController().signal,fetcher);
 assert.equal(calls.length,1,"legacy metrics do not fetch incompatible points");
 assert.equal(missing[0].history.coverage,"none");
});

test("history GET routes are read-only and never spend upstream calls",async()=>{
 for(const path of ["../app/api/history/route.ts","../app/api/history/batch/route.ts"]){
  const source=await readFile(new URL(path,import.meta.url),"utf8");
  assert.match(source,/readHistorySnapshots/);
  assert.doesNotMatch(source,/fetchTcgplayerHistory|persistDerivedHistory|upsertHistory/);
 }
});

test("bounded snapshots keep all-time extrema and the true 1Y baseline without retaining every old point",()=>{
 const input=[{date:"2020-01-01",price:1},{date:"2024-01-01",price:500},{date:"2025-09-30",price:10},...points];
 const snapshot=createHistorySnapshot(input,"Holofoil","Near Mint","exact");
 assert.equal(snapshot.points[0].date,"2025-09-30");
 assert.equal(snapshot.points.length,4);
 assert.equal(snapshot.historyLow,1);assert.equal(snapshot.historyHigh,500);
 assert.equal(snapshot.low30,10);assert.equal(snapshot.high30,30);
});
