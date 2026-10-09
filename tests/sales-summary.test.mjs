import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { summarizeSales, salesFreshness, salesPeriodChange } from "../core/domain/sales-summary.ts";
import { persistSalesSummary, readSalesSummary } from "../db/sales-summary.ts";
import { fetchTcgplayerHistory } from "../core/clients/tcgplayer-history.ts";

const fetched = "2026-10-09T12:00:00Z";
const sales = { windowDays: 90, totalQuantity: 30, totalTransactions: null, buckets: Array.from({length:30},(_,i)=>({
  date:new Date(Date.parse("2026-10-09")-i*3*86400000).toISOString().slice(0,10), quantity:1,
  low:null,high:null,lowWithShipping:null,highWithShipping:null,
})).reverse() };

test("sales summaries use whole buckets with disjoint recent and prior windows",()=>{
  const s=summarizeSales(sales,fetched);
  assert.deepEqual(s,{sales7:3,sales30:10,sales30Prior:10,throughDate:"2026-10-09",fetchedAt:fetched,bucketDays:3});
  assert.equal(salesPeriodChange(s),0);
  assert.equal(salesPeriodChange({...s,sales30Prior:0}),null);
  assert.equal(salesPeriodChange({...s,sales30:20}),100);
  assert.equal(salesFreshness(s,Date.parse(fetched)),"recent");
  assert.equal(salesFreshness(s,Date.parse("2026-10-20")),"stale");
  assert.equal(salesFreshness({...s,fetchedAt:null}),"unknown");
  assert.equal(summarizeSales({...sales,buckets:[]},fetched),null);
  assert.equal(summarizeSales({...sales,buckets:sales.buckets.slice(-2)},fetched).sales30,null);
  assert.equal(summarizeSales({...sales,buckets:sales.buckets.filter((_,i)=>i!==10)},fetched),null);
  assert.equal(summarizeSales({...sales,buckets:[...sales.buckets,sales.buckets[0]]},fetched),null);
  assert.equal(summarizeSales({...sales,buckets:sales.buckets.map(b=>({...b,quantity:0}))},fetched).sales30,0);
});

test("source quantities omitted or blank never become zero-volume claims",async()=>{
  for(const quantitySold of [undefined,"",null,"invalid","-1"]){
    let calls=0;
    const h=await fetchTcgplayerHistory(497606,"Holofoil",false,async()=>{
      calls++;return Response.json({result:[{variant:"Holofoil",condition:"Near Mint",language:"English",buckets:[{bucketStartDate:"2026-10-09",marketPrice:"10",quantitySold}]}]});
    });
    assert.equal(h.sales,undefined);assert.equal(h.salesSummary,undefined);assert.equal(calls,2);
  }
});

test("summary storage isolates printing and condition and leaves freshness untouched on price-only passes",async()=>{
  const sqlite=new DatabaseSync(":memory:");
  sqlite.exec("create table catalog_products(product_id integer primary key); insert into catalog_products values(1); create table market_metrics(product_id integer,variant text,condition text,sales_7 integer,sales_30 integer,sales_30_prior integer);");
  sqlite.exec(readFileSync(new URL("../docs/paused-migrations/sales_summaries.sql",import.meta.url),"utf8"));
  let reads=0,writes=0;
  const db={prepare(sql){
    const statement=sqlite.prepare(sql);
    return {bind(...values){return {
      async run(){writes++;return statement.run(...values)},
      async first(){reads++;return statement.get(...values)??null},
    }}};
  }};
  await persistSalesSummary(db,1,"Holofoil","Near Mint",fetched,sales);
  assert.equal(writes,1);
  let s=await readSalesSummary(db,1,"Holofoil","Near Mint");assert.equal(reads,1);
  assert.equal(s.sales30,10);
  await persistSalesSummary(db,1,"Holofoil","Near Mint","2026-10-20T00:00:00Z");
  s=await readSalesSummary(db,1,"Holofoil","Near Mint");assert.equal(s.fetchedAt,fetched);assert.equal(writes,1);
  assert.equal(await readSalesSummary(db,1,"Normal","Near Mint"),undefined);
  assert.equal(await readSalesSummary(db,1,"Holofoil","Lightly Played"),undefined);
  sqlite.exec("insert into market_metrics values(1,'Sealed','Unopened',7,30,20)");
  const old=await readSalesSummary(db,1,"Sealed","Unopened");assert.equal(old.sales30Prior,20);assert.equal(salesFreshness(old),"unknown");
  sqlite.exec("drop table sales_summaries");
  assert.equal((await readSalesSummary(db,1,"Sealed","Unopened")).sales30,30);
  await persistSalesSummary(db,1,"Sealed","Unopened",fetched,sales);
  sqlite.close();
});
