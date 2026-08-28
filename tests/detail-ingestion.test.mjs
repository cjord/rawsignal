import assert from "node:assert/strict";
import {readFile,readdir} from "node:fs/promises";
import {DatabaseSync} from "node:sqlite";
import test from "node:test";
import {runDetailIngestionBatch} from "../db/detail-ingestion.ts";
import {createD1CatalogRepository} from "../db/catalog-repository.ts";
import {publishedIngestion,startIngestion,upsertCard,upsertSealedProduct} from "../db/repository.ts";

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

const card={game:"pokemon",section:"illustration-rares",productId:1,name:"Fixture Card",set:"Fixture Set",year:2026,rarity:"Illustration Rare",number:"1/1",image:"https://example.com/card.jpg",url:"https://example.com/card",marketPrice:12.34,lowPrice:10,midPrice:13,highPrice:15,printing:"Holofoil",priceChange:null};
const sealed={game:"pokemon",productId:2,name:"Fixture Booster Box",set:"Fixture Set",category:"Booster Boxes",image:null,url:"https://example.com/sealed",msrp:143.64,marketPrice:199.99,midPrice:205,profit:56.35,profitPct:39.23,msrpSource:"Publisher"};
const source={categoryId:3,groupId:44,setAbbreviation:"FIX",publishedOn:"2026-01-01",modifiedOn:"2026-08-01",imageCount:1,isPresale:false,presaleNote:null,sourceUpdatedAt:"2026-08-27T00:00:00Z"};
const enrichment=(kind,productId)=>({kind,productId,metadata:[{name:"HP",label:"HP",value:"120"}],priceVariants:[{printing:kind==="single"?"Holofoil":"Sealed",marketPrice:12.34,lowPrice:10,directLowPrice:null,midPrice:13,highPrice:15}],source});
const chunks={
  "/data/details/chunk-a.json":[enrichment("single",1),enrichment("single",999)],
  "/data/details/chunk-b.json":[enrichment("sealed",2)],
};
const chunkPaths=Object.keys(chunks).sort();
const fetchChunk=async path=>{const chunk=chunks[path];if(!chunk)throw new Error(`Unknown chunk ${path}`);return chunk};

async function seededDb(){
  const db=new LocalD1(await migratedDatabase());
  await startIngestion(db,"daily-market:2026-08-27","bundled-feed","2026-08-27T00:00:00Z",{});
  await upsertCard(db,card,"2026-08-27T00:00:00Z","daily-market:2026-08-27");
  await upsertSealedProduct(db,sealed,"2026-08-27T00:00:00Z","daily-market:2026-08-27");
  return db;
}

test("detail ingestion checkpoints per chunk, skips unknown products, and publishes on completion",async()=>{
  const db=await seededDb(),options={batchSize:1,sourceUpdatedAt:"2026-08-27T12:00:00Z"};
  const first=await runDetailIngestionBatch(db,chunkPaths,fetchChunk,options);
  assert.deepEqual({cursor:first.cursor,done:first.done,written:first.detailsWritten,skipped:first.detailsSkipped},{cursor:1,done:false,written:1,skipped:1});
  assert.equal(await publishedIngestion(db,"product-details"),null);
  const second=await runDetailIngestionBatch(db,chunkPaths,fetchChunk,options);
  assert.deepEqual({cursor:second.cursor,done:second.done,written:second.detailsWritten,skipped:second.detailsSkipped},{cursor:2,done:true,written:2,skipped:1});
  const published=await publishedIngestion(db,"product-details");
  assert.equal(published?.runId,"product-details:2026-08-27");
  assert.equal(published?.sourceUpdatedAt,"2026-08-27T12:00:00Z");
  assert.equal((await db.prepare("select count(*) as count from product_details").bind().first()).count,2);
  // A re-invocation after completion no-ops instead of replaying the tail chunk.
  const third=await runDetailIngestionBatch(db,chunkPaths,fetchChunk,options);
  assert.deepEqual({cursor:third.cursor,done:third.done,processed:third.processed},{cursor:2,done:true,processed:0});
});

test("ingested details reach the D1 detail adapter with peers of both kinds",async()=>{
  const db=await seededDb();
  await runDetailIngestionBatch(db,chunkPaths,fetchChunk,{batchSize:10,sourceUpdatedAt:"2026-08-27T12:00:00Z"});
  const repository=createD1CatalogRepository(db,"daily-market:2026-08-27");
  const detail=await repository.getDetail("single",1);
  assert.equal(detail?.kind,"single");
  assert.deepEqual(detail.metadata,[{name:"HP",label:"HP",value:"120"}]);
  assert.equal(detail.source.setAbbreviation,"FIX");
  // Singles served from D1 list same-game sealed peers (related sealed needs both kinds).
  assert.equal(detail.relatedSealed.length,1);
  assert.equal(detail.relatedSealed[0].productId,2);
  // The production detail path reads unscoped: an in-progress re-ingestion re-stamps
  // ingestion_run_id, and a run-pinned repository would drop those products mid-run.
  const unscoped=createD1CatalogRepository(db);
  assert.equal((await unscoped.getDetail("single",1))?.kind,"single");
});
