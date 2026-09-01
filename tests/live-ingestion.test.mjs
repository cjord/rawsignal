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
const groupJ={groupId:200,name:"SV-P Promotional Cards",publishedOn:"2026-04-01T00:00:00Z"};
const groupO={groupId:300,name:"Carrying On His Will",publishedOn:"2026-05-01T00:00:00Z"};
const groupJS={groupId:210,name:"S6a: Eevee Heroes",publishedOn:"2021-05-28T00:00:00Z"};
// Pre-cutoff JP set group with NO fixture: walking it would throw, so a passing run
// proves the ≥2020 sealed cutoff filters it out.
const groupJOld={groupId:211,name:"XY-1: Collection X",publishedOn:"2013-12-13T00:00:00Z"};
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
  // Japanese promos (category 85): rarity is often absent — the fixed section takes the
  // card anyway; sealed-shaped JP listings must never reach the English sealed catalog.
  "85:200":{
    products:[
      {productId:601,name:"Victini - 288/SV-P",imageUrl:"",url:"https://example.com/jp",extendedData:[{name:"Number",value:"288/SV-P"}]},
      {productId:602,name:"Japanese Booster Box",imageUrl:"",url:"",extendedData:[]},
    ],
    prices:[
      {productId:601,marketPrice:487,lowPrice:450,midPrice:490,highPrice:520,subTypeName:"Normal"},
      {productId:602,marketPrice:90,lowPrice:85,midPrice:92,highPrice:99,subTypeName:"Normal"},
    ],
  },
  // Japanese set group (category 85, non-promo, ≥2020): sealed-only — the box lands
  // under game "pokemon", the JP single stays out (JP singles remain promo-groups-only).
  "85:210":{
    products:[
      {productId:701,name:"Eevee Heroes Booster Box",imageUrl:"https://example.com/eh_200w.jpg",url:"https://example.com/eh",extendedData:[]},
      {productId:702,name:"Glaceon VMAX - 025/069",imageUrl:"",url:"",extendedData:[{name:"Number",value:"025/069"},{name:"Rarity",value:"RRR"}]},
    ],
    prices:[
      {productId:701,marketPrice:480,lowPrice:430,midPrice:495,highPrice:540,subTypeName:"Normal"},
      {productId:702,marketPrice:30,lowPrice:26,midPrice:31,highPrice:35,subTypeName:"Normal"},
    ],
  },
  // One Piece (category 68) is sealed-only: the box lands, the single stays out entirely.
  "68:300":{
    products:[
      {productId:501,name:"Carrying On His Will Booster Box",imageUrl:"https://example.com/op_200w.jpg",url:"https://example.com/op",extendedData:[]},
      {productId:502,name:"Monkey.D.Luffy (PSA Magazine)",imageUrl:"",url:"",extendedData:[{name:"Number",value:"OP05-060"},{name:"Rarity",value:"SP"}]},
    ],
    prices:[
      {productId:501,marketPrice:118,lowPrice:105,midPrice:120,highPrice:130,subTypeName:"Normal"},
      {productId:502,marketPrice:55,lowPrice:50,midPrice:56,highPrice:60,subTypeName:"Normal"},
    ],
  },
};
const deps={
  client:{
    async groups(categoryId){return categoryId===3?[groupA,groupB]:categoryId===89?[groupR]:categoryId===68?[groupO]:[groupJ,groupJS,groupJOld]},
    async products(categoryId,groupId){return fixtures[`${categoryId}:${groupId}`].products},
    async prices(categoryId,groupId){return fixtures[`${categoryId}:${groupId}`].prices},
  },
  async fetchMsrp(){return new Map([[201,{msrp:120,matched:true}]])},
  // The curated riftbound feed shares product 401 with the walked group (MSRP merge + dedupe).
  async loadBundledSealed(market){
    if(market==="riftbound")return [{game:"riftbound",productId:401,name:"Rift Set - Booster Display",set:"Rift Set",category:"Booster Boxes",image:null,url:"https://example.com/rbd",msrp:90,marketPrice:80,midPrice:82,profit:null,profitPct:null,msrpSource:"Asmodee/Riftbound MSRP"}];
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
  // japanese promo card, walked onepiece sealed, walked japanese sealed, bundled
  // riftbound duplicate (dedup), bundled onepiece.
  assert.deepEqual({cursor:second.cursor,done:second.done,written:second.recordsWritten,duplicates:second.duplicateDecisions},{cursor:"8:0",done:true,written:9,duplicates:2});
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
  // and merged the curated MSRP; the classifier assigned the canonical taxonomy label (D3).
  const rift=await db.prepare(`select p.product_type as productType, cp.market_cents as marketCents, sd.msrp_cents as msrpCents
    from catalog_products p join current_prices cp on cp.product_id=p.product_id join sealed_details sd on sd.product_id=p.product_id
    where p.product_id=401`).bind().first();
  assert.deepEqual({...rift},{productType:"Booster Boxes",marketCents:8500,msrpCents:9000});
  // The Japanese promo landed in its fixed section with the rarity fallback; the JP
  // sealed-shaped listing stayed out of the catalog entirely.
  const jp=await db.prepare("select section, rarity from catalog_products where product_id=601").bind().first();
  assert.deepEqual({...jp},{section:"japanese-promos",rarity:"Promo"});
  assert.equal(await db.prepare("select count(*) as n from catalog_products where product_id=602").bind().first().then(row=>row.n),0);
  // The Japanese sealed walk (≥2020 set groups) landed the box under game "pokemon"
  // with honest null MSRP; the JP single stayed out (singles remain promo-groups-only),
  // and the pre-cutoff group was never fetched (it has no fixture).
  const jpSealed=await db.prepare(`select p.kind, p.game, p.product_type as productType, cp.market_cents as marketCents, sd.msrp_cents as msrpCents
    from catalog_products p join current_prices cp on cp.product_id=p.product_id join sealed_details sd on sd.product_id=p.product_id
    where p.product_id=701`).bind().first();
  assert.deepEqual({...jpSealed},{kind:"sealed",game:"pokemon",productType:"Booster Boxes",marketCents:48000,msrpCents:null});
  assert.equal(await db.prepare("select count(*) as n from catalog_products where product_id=702").bind().first().then(row=>row.n),0);
  // The One Piece walk kept the sealed box (canonical taxonomy, live price) and the
  // sealed-only rule kept the OP single out of the catalog entirely.
  const op=await db.prepare(`select p.kind, p.game, p.product_type as productType, cp.market_cents as marketCents
    from catalog_products p join current_prices cp on cp.product_id=p.product_id where p.product_id=501`).bind().first();
  assert.deepEqual({...op},{kind:"sealed",game:"onepiece",productType:"Booster Boxes",marketCents:11800});
  assert.equal(await db.prepare("select count(*) as n from catalog_products where product_id=502").bind().first().then(row=>row.n),0);
  const runs=await db.prepare("select count(distinct ingestion_run_id) as n from catalog_products").bind().first();
  assert.equal(runs.n,1);
});

test("sealed-only categories use their own higher group-fetch cap (M3)",async()=>{
  const db=new LocalD1(await migratedDatabase());
  const sealedGroups=Array.from({length:20},(_,i)=>({groupId:1000+i,name:`OP Wave ${i}`,publishedOn:"2026-01-01T00:00:00Z"}));
  const sealedDeps={
    client:{
      async groups(categoryId){return categoryId===68?sealedGroups:[]},
      async products(_categoryId,groupId){return [{productId:groupId,name:`Wave ${groupId} Booster Box`,imageUrl:"",url:"",extendedData:[]}]},
      async prices(_categoryId,groupId){return [{productId:groupId,marketPrice:100,lowPrice:90,midPrice:101,highPrice:110,subTypeName:"Normal"}]},
    },
    async fetchMsrp(){return new Map()},
    async loadBundledSealed(){return []},
  };
  // 20 sealed groups exceed the singles-calibrated cap (12, pinned explicitly) but
  // finish in ONE batch under the sealed cap — group count no longer taxes sealed walks.
  const result=await runLiveDailyIngestionBatch(db,sealedDeps,{sourceUpdatedAt:"2026-08-31T20:00:00Z",batchSize:100,groupFetchCap:12,minimumRecords:5});
  assert.deepEqual({done:result.done,written:result.recordsWritten},{done:true,written:20});
});

test("a truncated upstream day never publishes and resets the walk",async()=>{
  const db=new LocalD1(await migratedDatabase());
  await assert.rejects(()=>runLiveDailyIngestionBatch(db,deps,{sourceUpdatedAt:"2026-08-28T20:00:00Z",batchSize:100,minimumRecords:999}),/below minimum records/);
  assert.equal(await publishedIngestion(db,"daily-market"),null);
  const checkpoint=await db.prepare("select cursor from refresh_state where key='live-daily-progress'").bind().first();
  assert.equal(checkpoint.cursor,"0:0");
});
