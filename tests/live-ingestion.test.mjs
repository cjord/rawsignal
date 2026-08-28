import assert from "node:assert/strict";
import {readFile,readdir} from "node:fs/promises";
import {DatabaseSync} from "node:sqlite";
import test from "node:test";
import {runLiveDailyIngestionBatch} from "../db/live-ingestion.ts";
import {publishedIngestion} from "../db/repository.ts";

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

const rarity=value=>[{name:"Rarity",value},{name:"Number",value:"1/1"}];
const groupA={groupId:10,name:"Fixture Set",publishedOn:"2026-01-01T00:00:00Z"};
const groupB={groupId:11,name:"Promo Reprints",publishedOn:"2026-02-01T00:00:00Z"};
const groupR={groupId:90,name:"Rift Set",publishedOn:"2026-03-01T00:00:00Z"};
const fixtures={
  "3:10":{
    products:[
      {productId:101,name:"Pikachu",imageUrl:"https://example.com/p_200w.jpg",url:"https://example.com/p",extendedData:rarity("Illustration Rare")},
      {productId:107,name:"Promo Star",imageUrl:"",url:"",extendedData:rarity("Promo")},
      {productId:201,name:"Fixture Booster Box",imageUrl:"",url:"https://example.com/bb",extendedData:[]},
    ],
    prices:[
      {productId:101,marketPrice:12,lowPrice:10,midPrice:13,highPrice:15,subTypeName:"Holofoil"},
      {productId:107,marketPrice:5,lowPrice:4,midPrice:5,highPrice:6,subTypeName:"Holofoil"},
      {productId:201,marketPrice:150,lowPrice:140,midPrice:155,highPrice:170,subTypeName:"Normal"},
    ],
  },
  "3:11":{
    products:[{productId:107,name:"Promo Star",imageUrl:"",url:"",extendedData:rarity("Promo")}],
    prices:[{productId:107,marketPrice:9,lowPrice:8,midPrice:9,highPrice:10,subTypeName:"Holofoil"}],
  },
  "89:90":{
    products:[
      {productId:301,name:"Rift Hero",imageUrl:"",url:"",extendedData:rarity("Rare")},
      {productId:401,name:"Rift Set - Booster Display",imageUrl:"",url:"https://example.com/rbd",extendedData:[]},
    ],
    prices:[
      {productId:301,marketPrice:3,lowPrice:2,midPrice:3,highPrice:4,subTypeName:"Normal"},
      {productId:401,marketPrice:85,lowPrice:80,midPrice:86,highPrice:95,subTypeName:"Normal"},
    ],
  },
};
const deps={
  client:{
    async groups(categoryId){return categoryId===3?[groupA,groupB]:[groupR]},
    async products(categoryId,groupId){return fixtures[`${categoryId}:${groupId}`].products},
    async prices(categoryId,groupId){return fixtures[`${categoryId}:${groupId}`].prices},
  },
  async fetchMsrp(){return new Map([[201,{msrp:120,matched:true}]])},
  // The curated riftbound feed shares product 401 with the walked group (MSRP merge + dedupe).
  async loadBundledSealed(market){
    if(market==="riftbound")return [{game:"riftbound",productId:401,name:"Rift Set - Booster Display",set:"Rift Set",category:"Booster boxes",image:null,url:"https://example.com/rbd",msrp:90,marketPrice:80,midPrice:82,profit:null,profitPct:null,msrpSource:"Asmodee/Riftbound MSRP"}];
    return [{game:"onepiece",productId:402,name:"onepiece Fixture Box",set:"Bundle Set",category:"Booster Boxes",image:null,url:"https://example.com/b",msrp:null,marketPrice:80,midPrice:82,profit:null,profitPct:null,msrpSource:null}];
  },
};

test("live ingestion walks groups with a record cursor and publishes once complete",async()=>{
  const db=new LocalD1(await migratedDatabase()),options={sourceUpdatedAt:"2026-08-28T20:00:00Z",minimumRecords:5};
  const first=await runLiveDailyIngestionBatch(db,deps,{...options,batchSize:2});
  assert.deepEqual({cursor:first.cursor,done:first.done,written:first.recordsWritten},{cursor:"0:2",done:false,written:2});
  assert.equal(await publishedIngestion(db,"daily-market"),null);
  const second=await runLiveDailyIngestionBatch(db,deps,{...options,batchSize:100});
  // Group A card+promo+sealed, promo reprint (dedup), riftbound card+walked sealed,
  // bundled riftbound duplicate (dedup), bundled onepiece.
  assert.deepEqual({cursor:second.cursor,done:second.done,written:second.recordsWritten,duplicates:second.duplicateDecisions},{cursor:"5:0",done:true,written:6,duplicates:2});
  const published=await publishedIngestion(db,"daily-market");
  assert.equal(published?.runId,"live-daily:2026-08-28");
  assert.equal(published?.sourceUpdatedAt,"2026-08-28T20:00:00Z");
  // The promo duplicate kept the higher market price from the reprint group.
  const promo=await db.prepare("select market_cents as marketCents from current_prices where product_id=107").bind().first();
  assert.equal(promo.marketCents,900);
  // Sealed pulled MSRP and bundled markets landed with the same run stamp.
  const sealedRow=await db.prepare("select msrp_cents as msrpCents from sealed_details where product_id=201").bind().first();
  assert.equal(sealedRow.msrpCents,12000);
  // The walked riftbound sealed row won over the bundled duplicate (its live price stands)
  // and merged the curated MSRP; the classifier assigned the riftbound taxonomy label.
  const rift=await db.prepare(`select p.product_type as productType, cp.market_cents as marketCents, sd.msrp_cents as msrpCents
    from catalog_products p join current_prices cp on cp.product_id=p.product_id join sealed_details sd on sd.product_id=p.product_id
    where p.product_id=401`).bind().first();
  assert.deepEqual({...rift},{productType:"Booster boxes",marketCents:8500,msrpCents:9000});
  const runs=await db.prepare("select count(distinct ingestion_run_id) as n from catalog_products").bind().first();
  assert.equal(runs.n,1);
});

test("a truncated upstream day never publishes and resets the walk",async()=>{
  const db=new LocalD1(await migratedDatabase());
  await assert.rejects(()=>runLiveDailyIngestionBatch(db,deps,{sourceUpdatedAt:"2026-08-28T20:00:00Z",batchSize:100,minimumRecords:999}),/below minimum records/);
  assert.equal(await publishedIngestion(db,"daily-market"),null);
  const checkpoint=await db.prepare("select cursor from refresh_state where key='live-daily-progress'").bind().first();
  assert.equal(checkpoint.cursor,"0:0");
});
