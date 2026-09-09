import assert from "node:assert/strict";
import {readFile,readdir} from "node:fs/promises";
import {DatabaseSync} from "node:sqlite";
import test from "node:test";
import {createD1CatalogRepository} from "../db/catalog-repository.ts";
import {PEER_ANCHOR_TTL_MS,readPeerAnchor} from "../db/peer-anchors.ts";
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
  // The two-days-ago row saw only card 1 of the 2-card cohort — composition-incomplete days
  // are dropped, so the summary rests on the latest complete day: cards 1 (12) and 2 (8).
  assert.deepEqual(anchor,{current:10,cardCount:2,avg30:10,avg90:10,observations:1});
  // The Promo cohort stands alone and never mixes in.
  const promo=await readPeerAnchor(db,"pokemon","Fixture Set","Promo");
  assert.deepEqual(promo,{current:50,cardCount:1,avg30:50,avg90:50,observations:1});
  assert.equal(await readPeerAnchor(db,"pokemon","Fixture Set","Ultra Rare"),null);
  assert.equal(await readPeerAnchor(db,"pokemon","Fixture Set",null),null);
});

test("the D1 detail adapter exposes the derived peer anchor",async()=>{
  const db=await seededDb();
  const detail=await createD1CatalogRepository(db).getDetail("single",1);
  assert.deepEqual(detail?.peerAnchor,{current:10,cardCount:2,avg30:10,avg90:10,observations:1});
});

test("peer anchors are memoized per cohort for ten minutes, and a failed read is not kept (Q9)",async()=>{
  const inner=await seededDb();
  // A counting shell around the database: the query is the one thing being counted.
  let queries=0,fail=false;
  const db={prepare(sql){if(fail)throw new Error("D1 unavailable");if(/from price_observations o join catalog_products/.test(sql))queries++;return inner.prepare(sql)},batch:statements=>inner.batch(statements)};
  const first=await readPeerAnchor(db,"pokemon","Fixture Set","Illustration Rare",{now:1_000_000});
  const again=await readPeerAnchor(db,"pokemon","Fixture Set","Illustration Rare",{now:1_000_000+PEER_ANCHOR_TTL_MS-1});
  assert.deepEqual(again,first);
  assert.equal(queries,1);
  // Another cohort is its own entry; a null result is memoized too.
  assert.equal(await readPeerAnchor(db,"pokemon","Fixture Set","Ultra Rare",{now:1_000_000}),null);
  assert.equal(await readPeerAnchor(db,"pokemon","Fixture Set","Ultra Rare",{now:1_000_000+5}),null);
  assert.equal(queries,2);
  // Past the TTL the cohort is read again.
  await readPeerAnchor(db,"pokemon","Fixture Set","Illustration Rare",{now:1_000_000+PEER_ANCHOR_TTL_MS});
  assert.equal(queries,3);
  // A failure is not kept: the next call retries instead of serving the rejection.
  fail=true;
  await assert.rejects(readPeerAnchor(db,"pokemon","Fixture Set","Promo",{now:2_000_000}),/D1 unavailable/);
  fail=false;
  assert.deepEqual(await readPeerAnchor(db,"pokemon","Fixture Set","Promo",{now:2_000_001}),{current:50,cardCount:1,avg30:50,avg90:50,observations:1});
  assert.equal(queries,4);
});
