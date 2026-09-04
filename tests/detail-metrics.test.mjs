import assert from "node:assert/strict";
import {readFile,readdir} from "node:fs/promises";
import {DatabaseSync} from "node:sqlite";
import test from "node:test";
import {createD1CatalogRepository,readSetRowMetrics} from "../db/catalog-repository.ts";
import {startIngestion,upsertCard,upsertMarketMetrics,upsertSealedProduct} from "../db/repository.ts";

// The detail page's set-scoped tables (chase cards, related sealed) carry each row's latest
// market_metrics so they render change/range columns without a per-row history request
// (review §14, wave 14). Rows without a metrics row simply carry none.

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

const card=(productId,marketPrice)=>({game:"pokemon",section:"illustration-rares",productId,name:`Card ${productId}`,set:"Fixture Set",year:2026,rarity:"Illustration Rare",number:`${productId}/100`,image:"https://example.com/c.jpg",url:"https://example.com/c",marketPrice,lowPrice:null,midPrice:null,highPrice:null,printing:"Holofoil",priceChange:null});
const sealed=(productId,category,marketPrice)=>({game:"pokemon",productId,name:`${category} ${productId}`,set:"Fixture Set",category,image:null,url:"https://example.com/s",msrp:null,marketPrice,midPrice:null,profit:null,profitPct:null,msrpSource:null});
const history=(variant,condition)=>({points:[],variant,condition,coverage:"exact",change7:1.5,change30:-3.2,change90:null,low30:35,high30:44,historyLow:null,historyHigh:null});
const expected={change7:1.5,change30:-3.2,low30:35,high30:44,regime:"steady"};

async function seededDb(){
  const db=new LocalD1(await migratedDatabase()),at="2026-08-28T00:00:00Z",run="live-daily:2026-08-28";
  await startIngestion(db,run,"tcgcsv-live",at,{});
  await upsertCard(db,card(1,500),at,run);
  await upsertCard(db,card(2,300),at,run);
  await upsertSealedProduct(db,sealed(9,"Booster Boxes",120),at,run);
  await upsertSealedProduct(db,sealed(10,"Booster Packs",4.5),at,run);
  // Card 1 and the pack carry metrics; card 2 and the box do not.
  await upsertMarketMetrics(db,1,"Holofoil","Near Mint","2026-08-28",history("Holofoil","Near Mint"),at,undefined,"steady");
  await upsertMarketMetrics(db,10,"Sealed","Unopened","2026-08-28",history("Sealed","Unopened"),at,undefined,"steady");
  return db;
}

test("set row metrics are keyed by product id and cover both kinds",async()=>{
  const metrics=await readSetRowMetrics(await seededDb(),"pokemon","Fixture Set");
  assert.deepEqual([...metrics.keys()].sort(),[1,10]);
  assert.deepEqual(metrics.get(1),expected);
  assert.deepEqual(await readSetRowMetrics(await seededDb(),"pokemon","Other Set"),new Map());
});

test("chase cards and related sealed carry their metrics; rows without a metrics row carry none",async()=>{
  const repository=createD1CatalogRepository(await seededDb());
  const box=await repository.getDetail("sealed",9,"pokemon");
  assert.deepEqual(box.chaseCards.map(item=>[item.productId,item.metrics??null]),[[1,expected],[2,null]]);
  assert.deepEqual(box.relatedSealed.map(item=>[item.productId,item.metrics??null]),[[10,expected]]);
  const single=await repository.getDetail("single",1);
  assert.deepEqual(single.relatedSealed.map(item=>[item.productId,item.metrics??null]),[[9,null],[10,expected]]);
  assert.equal("metrics" in single,false,"the product itself is not decorated");
});
