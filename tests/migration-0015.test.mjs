import assert from "node:assert/strict";
import {readFile,readdir} from "node:fs/promises";
import {DatabaseSync} from "node:sqlite";
import test from "node:test";
import {startIngestion,upsertCard,upsertHistory,upsertMarketMetrics,upsertSealedProduct} from "../db/repository.ts";

// Migration 0015 (docs/todo.md R3) folds the TCGplayer-keyed sealed series (Normal/Unopened)
// into the canonical Sealed/Unopened key and drops the duplicate metrics rows. Applied here on
// top of the earlier migrations to a seeded database, the way wrangler applies it in production.

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

async function migrations(){
  const directory=new URL("../drizzle/",import.meta.url);
  const names=(await readdir(directory)).filter(name=>/^\d+.*\.sql$/.test(name)).sort();
  return Promise.all(names.map(async name=>({name,sql:await readFile(new URL(name,directory),"utf8")})));
}
const apply=(database,sql)=>{for(const statement of sql.split("--> statement-breakpoint").map(value=>value.trim()).filter(Boolean))database.exec(statement)};
const history=(variant,condition)=>({points:[],variant,condition,coverage:"exact",change7:null,change30:null,change90:null,low30:null,high30:null,historyLow:null,historyHigh:null});
const at="2026-09-01T00:00:00Z";

test("0015 folds Normal/Unopened sealed observations into Sealed/Unopened and drops the duplicate metrics rows",async()=>{
  const all=await migrations(),target=all.find(migration=>migration.name.startsWith("0015_"));
  assert.ok(target,"migration 0015 exists");
  const database=new DatabaseSync(":memory:");database.exec("pragma foreign_keys=on");
  for(const migration of all){if(migration.name>=target.name)break;apply(database,migration.sql)}
  const db=new LocalD1(database);
  await startIngestion(db,"seed","fixture",at,{});
  await upsertSealedProduct(db,{game:"pokemon",productId:9,name:"Box",set:"Set",category:"Booster Boxes",image:null,url:"https://example.com/b",msrp:null,marketPrice:116,midPrice:null,profit:null,profitPct:null,msrpSource:null},at,"seed");
  await upsertCard(db,{game:"pokemon",section:"illustration-rares",productId:1,name:"Card",set:"Set",year:2026,rarity:"Illustration Rare",number:"1/1",image:"https://example.com/c.jpg",url:"https://example.com/c",marketPrice:5,lowPrice:null,midPrice:null,highPrice:null,printing:"Holofoil",priceChange:null},at,"seed");
  // TCGplayer-keyed depth for the box, one day overlapping the walk's own point (the stored
  // Sealed value must win); the single's series must be untouched.
  await upsertHistory(db,9,"Normal","Unopened",[{date:"2026-08-01",price:100},{date:"2026-08-30",price:110}],at);
  await upsertHistory(db,9,"Sealed","Unopened",[{date:"2026-08-30",price:115},{date:"2026-08-31",price:116}],at,"tcgcsv-daily");
  await upsertHistory(db,1,"Holofoil","Near Mint",[{date:"2026-08-30",price:5}],at);
  await upsertMarketMetrics(db,9,"Normal","Unopened","2026-08-31",history("Normal","Unopened"),at);
  await upsertMarketMetrics(db,9,"Sealed","Unopened","2026-08-31",history("Sealed","Unopened"),at);
  await upsertMarketMetrics(db,1,"Holofoil","Near Mint","2026-08-31",history("Holofoil","Near Mint"),at);

  apply(database,target.sql);

  const rows=database.prepare("select variant,condition,observed_date date,market_cents cents,source from price_observations where product_id=9 order by observed_date").all().map(row=>({...row}));
  assert.deepEqual(rows,[
    {variant:"Sealed",condition:"Unopened",date:"2026-08-01",cents:10000,source:"tcgplayer"},
    {variant:"Sealed",condition:"Unopened",date:"2026-08-30",cents:11500,source:"tcgcsv-daily"},
    {variant:"Sealed",condition:"Unopened",date:"2026-08-31",cents:11600,source:"tcgcsv-daily"},
  ]);
  assert.deepEqual(database.prepare("select variant,condition from market_metrics where product_id=9").all().map(row=>[row.variant,row.condition]),[["Sealed","Unopened"]]);
  assert.equal(database.prepare("select count(*) n from price_observations where product_id=1 and variant='Holofoil' and condition='Near Mint'").get().n,1,"singles untouched");
  assert.equal(database.prepare("select count(*) n from market_metrics where product_id=1").get().n,1);
  // Re-applying is a no-op.
  apply(database,target.sql);
  assert.equal(database.prepare("select count(*) n from price_observations where product_id=9").get().n,3);
  database.close();
});
