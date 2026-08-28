import assert from "node:assert/strict";
import {readFile,readdir} from "node:fs/promises";
import {DatabaseSync} from "node:sqlite";
import test from "node:test";
import {parseCards,parseSealedProducts} from "../app/domain/contracts.ts";
import {readSectionFeed,readSealedFeed} from "../db/catalog-repository.ts";
import {startIngestion,upsertCard,upsertSealedProduct} from "../db/repository.ts";
import {liveFeedTarget} from "../worker/live-feeds.ts";

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

const card=(productId,section,rarity,marketPrice)=>({game:"pokemon",section,productId,name:`Card ${productId}`,set:"Fixture Set",year:2026,rarity,number:`${productId}/100`,image:"",url:"https://example.com",marketPrice,lowPrice:1,midPrice:2,highPrice:3,printing:"Holofoil",priceChange:null});
const sealed={game:"pokemon",productId:9,name:"Fixture Booster Box",set:"Fixture Set",category:"Booster Boxes",image:null,url:"https://example.com/bb",msrp:120,marketPrice:150,midPrice:155,profit:30,profitPct:25,msrpSource:"Publisher"};

test("live feed URLs map to sections and sealed markets, everything else stays static",()=>{
  assert.deepEqual(liveFeedTarget("/data/illustration-rares.json"),{kind:"sections",sections:["illustration-rares"]});
  assert.deepEqual(liveFeedTarget("/data/illustration-and-special-rares.json"),{kind:"sections",sections:["illustration-rares","special-illustration-rares"]});
  assert.deepEqual(liveFeedTarget("/data/sealed-onepiece.json"),{kind:"sealed",market:"onepiece"});
  assert.equal(liveFeedTarget("/data/sealed-scalping.json"),null);
  assert.equal(liveFeedTarget("/data/detail-manifest.json"),null);
  assert.equal(liveFeedTarget("/data/details/3-1387.json"),null);
  assert.equal(liveFeedTarget("/data/pull-rates.json"),null);
  assert.equal(liveFeedTarget("/api/catalog"),null);
});

test("section and sealed feeds reproduce the bundled feed shapes from D1 rows",async()=>{
  const db=new LocalD1(await migratedDatabase());
  await startIngestion(db,"live-daily:2026-08-28","tcgcsv-live","2026-08-28T00:00:00Z",{});
  await upsertCard(db,card(1,"illustration-rares","Illustration Rare",10),"2026-08-28T00:00:00Z","live-daily:2026-08-28");
  await upsertCard(db,card(2,"illustration-rares","Illustration Rare",40),"2026-08-28T00:00:00Z","live-daily:2026-08-28");
  await upsertCard(db,card(3,"special-illustration-rares","Special Illustration Rare",25),"2026-08-28T00:00:00Z","live-daily:2026-08-28");
  await upsertSealedProduct(db,sealed,"2026-08-28T00:00:00Z","live-daily:2026-08-28");
  const section=await readSectionFeed(db,["illustration-rares"]);
  assert.deepEqual(section.map(row=>row.productId),[2,1]);
  assert.equal(parseCards(section).length,2);
  const merged=await readSectionFeed(db,["illustration-rares","special-illustration-rares"]);
  assert.deepEqual(merged.map(row=>row.productId),[2,3,1]);
  const sealedFeed=await readSealedFeed(db,"pokemon");
  assert.equal(parseSealedProducts(sealedFeed).length,1);
  assert.equal(sealedFeed[0].msrp,120);
  assert.deepEqual(await readSealedFeed(db,"riftbound"),[]);
});
