import assert from "node:assert/strict";
import {readFile,readdir} from "node:fs/promises";
import {DatabaseSync} from "node:sqlite";
import test from "node:test";
import {createD1CatalogRepository} from "../db/catalog-repository.ts";
import {compactGrades,readGradedCard,runGradedRotationBatch} from "../db/graded-ingestion.ts";
import {publishedIngestion,startIngestion,upsertCard} from "../db/repository.ts";

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

const card=(productId,marketPrice)=>({game:"pokemon",section:"illustration-rares",productId,name:`Card ${productId}`,set:"Fixture Set",year:2026,rarity:"Illustration Rare",number:`${productId}/100`,image:"",url:"https://example.com",marketPrice,lowPrice:null,midPrice:null,highPrice:null,printing:"Holofoil",priceChange:null});
const salesPayload={data:{ebay:{salesByGrade:{psa10:{count:4,averagePrice:120.5,medianPrice:118,smartMarketPrice:{price:119.25,confidence:"high"},marketTrend:"up",lastSaleDate:"2026-08-27T12:00:00Z"}}}}};

async function seededDb(){
  const db=new LocalD1(await migratedDatabase());
  await startIngestion(db,"live-daily:2026-08-28","tcgcsv-live","2026-08-28T00:00:00Z",{});
  for(const [id,market] of [[1,500],[2,300],[3,100]])await upsertCard(db,card(id,market),"2026-08-28T00:00:00Z","live-daily:2026-08-28");
  return db;
}

test("graded rotation prefers never-fetched then stalest cards within the credit budget",async()=>{
  const db=await seededDb();
  // Card 1 already has a fresh-ish snapshot; 2 and 3 have never been fetched.
  await db.prepare("insert into graded_prices (product_id,grades_json,updated_at) values (1,'{}','2026-08-20')").bind().run();
  const fetched=[];
  const deps={async fetchCard(productId){fetched.push(productId);return{status:200,creditsConsumed:2,dailyRemaining:80,payload:salesPayload}},wait:async()=>{}};
  const result=await runGradedRotationBatch(db,deps,{budget:4,now:new Date("2026-08-28T21:00:00Z")});
  // Budget 4 credits -> 2 cards: the never-fetched pair, higher market first.
  assert.deepEqual(fetched,[2,3]);
  assert.deepEqual({targets:result.targets,updated:result.updated,stopped:result.stopped},{targets:2,updated:2,stopped:null});
  assert.equal((await publishedIngestion(db,"graded-rotation"))?.runId,"graded-rotation:2026-08-28");
  const stored=await readGradedCard(db,2);
  assert.equal(stored?.grades.psa10.smartPrice,119.25);
  assert.equal(stored?.grades.psa10.trend,"up");
  // The D1 detail adapter surfaces the stored grades.
  const detail=await createD1CatalogRepository(db).getDetail("single",2);
  assert.equal(detail?.graded?.grades.psa10.count,4);
});

test("rotation stops on exhausted credits and still publishes the day's run",async()=>{
  const db=await seededDb();
  const deps={async fetchCard(){return{status:200,creditsConsumed:2,dailyRemaining:1,payload:salesPayload}},wait:async()=>{}};
  const result=await runGradedRotationBatch(db,deps,{budget:90,now:new Date("2026-08-28T21:00:00Z")});
  assert.deepEqual({updated:result.updated,stopped:result.stopped},{updated:1,stopped:"budget-exhausted"});
  assert.equal((await publishedIngestion(db,"graded-rotation"))?.runId,"graded-rotation:2026-08-28");
});

test("a failing key fails the run without publishing",async()=>{
  const db=await seededDb();
  const deps={async fetchCard(){return{status:401,creditsConsumed:null,dailyRemaining:null,payload:null}},wait:async()=>{}};
  await assert.rejects(()=>runGradedRotationBatch(db,deps,{budget:90,now:new Date("2026-08-28T21:00:00Z")}),/HTTP 401/);
  assert.equal(await publishedIngestion(db,"graded-rotation"),null);
});

test("compactGrades keeps only priced, counted grades",()=>{
  const grades=compactGrades({psa10:{count:2,averagePrice:10,medianPrice:9,smartMarketPrice:{price:9.5,confidence:"medium"},marketTrend:"sideways"},empty:{count:0},junk:"nope"});
  assert.deepEqual(Object.keys(grades),["psa10"]);
  assert.equal(grades.psa10.trend,null);
  assert.equal(grades.psa10.confidence,"medium");
});
