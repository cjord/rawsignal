import assert from "node:assert/strict";
import {readFile,readdir} from "node:fs/promises";
import {DatabaseSync} from "node:sqlite";
import test from "node:test";
import {createD1CatalogRepository} from "../db/catalog-repository.ts";
import {readPeerAnchor} from "../db/peer-anchors.ts";
import {startIngestion,upsertCard,upsertHistory} from "../db/repository.ts";

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

const day=offset=>new Date(Date.now()-offset*86_400_000).toISOString().slice(0,10);
const card=(productId,rarity,marketPrice)=>({game:"pokemon",section:"illustration-rares",productId,name:`Card ${productId}`,set:"Fixture Set",year:2026,rarity,number:`${productId}/100`,image:"",url:"https://example.com",marketPrice,lowPrice:null,midPrice:null,highPrice:null,printing:"Holofoil",priceChange:null});

async function seededDb(){
  const db=new LocalD1(await migratedDatabase());
  await startIngestion(db,"live-daily:2026-08-28","tcgcsv-live","2026-08-28T00:00:00Z",{});
  await upsertCard(db,card(1,"Illustration Rare",500),"2026-08-28T00:00:00Z","live-daily:2026-08-28");
  await upsertCard(db,card(2,"Illustration Rare",300),"2026-08-28T00:00:00Z","live-daily:2026-08-28");
  await upsertCard(db,card(3,"Promo",50),"2026-08-28T00:00:00Z","live-daily:2026-08-28");
  await upsertHistory(db,1,"Holofoil","Near Mint",[{date:day(2),price:10},{date:day(1),price:12}],"2026-08-28T00:00:00Z");
  // A secondary printing's observations must not dilute the cohort average.
  await upsertHistory(db,1,"1st Edition Holofoil","Near Mint",[{date:day(1),price:99}],"2026-08-28T00:00:00Z");
  await upsertHistory(db,2,"Holofoil","Near Mint",[{date:day(1),price:8}],"2026-08-28T00:00:00Z");
  await upsertHistory(db,3,"Holofoil","Near Mint",[{date:day(1),price:50}],"2026-08-28T00:00:00Z");
  return db;
}

test("peer anchors derive cohort daily averages from primary-printing observations",async()=>{
  const db=await seededDb();
  const anchor=await readPeerAnchor(db,"pokemon","Fixture Set","Illustration Rare");
  // Day-1: card 1 at 10 alone; latest day: cards 1 (12) and 2 (8) average to 10.
  assert.deepEqual(anchor,{current:10,cardCount:2,avg30:10,avg90:10,observations:2});
  // The Promo cohort stands alone and never mixes in.
  const promo=await readPeerAnchor(db,"pokemon","Fixture Set","Promo");
  assert.deepEqual(promo,{current:50,cardCount:1,avg30:50,avg90:50,observations:1});
  assert.equal(await readPeerAnchor(db,"pokemon","Fixture Set","Ultra Rare"),null);
  assert.equal(await readPeerAnchor(db,"pokemon","Fixture Set",null),null);
});

test("the D1 detail adapter exposes the derived peer anchor",async()=>{
  const db=await seededDb();
  const detail=await createD1CatalogRepository(db).getDetail("single",1);
  assert.deepEqual(detail?.peerAnchor,{current:10,cardCount:2,avg30:10,avg90:10,observations:2});
});
