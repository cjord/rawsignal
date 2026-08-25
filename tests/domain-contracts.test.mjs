import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {DatabaseSync} from "node:sqlite";
import test from "node:test";
import {parseCard,parsePriceHistory,parseSealedProduct} from "../app/domain/contracts.ts";
import {formatPercent,formatUsd} from "../app/domain/formatters.ts";
import {completeIngestion,readProductSnapshot,startIngestion,upsertCard,upsertHistory,upsertSealedProduct} from "../db/repository.ts";

class LocalStatement{
  constructor(statement){this.statement=statement;this.values=[]}
  bind(...values){this.values=values;return this}
  async run(){return this.statement.run(...this.values)}
  async first(){return this.statement.get(...this.values)??null}
}

class LocalD1{
  constructor(database){this.database=database}
  prepare(sql){return new LocalStatement(this.database.prepare(sql))}
  async batch(statements){this.database.exec("begin");try{const results=[];for(const statement of statements)results.push(await statement.run());this.database.exec("commit");return results}catch(error){this.database.exec("rollback");throw error}}
}

const card={game:"pokemon",section:"illustration-rares",productId:1,name:"Fixture Card",set:"Fixture Set",year:2026,rarity:"Illustration Rare",number:"1/1",image:"https://example.com/card.jpg",url:"https://example.com/card",marketPrice:12.34,lowPrice:10,midPrice:13,highPrice:15,printing:"Holofoil",priceChange:null};
const sealed={game:"pokemon",productId:2,name:"Fixture Booster Box",set:"Fixture Set",category:"Booster Boxes",image:null,url:"https://example.com/sealed",msrp:143.64,marketPrice:199.99,midPrice:205,profit:56.35,profitPct:39.23,msrpSource:"Publisher"};
const unavailable={...sealed,productId:3,name:"Regional Gift Box",msrp:null,marketPrice:null,midPrice:null,profit:null,profitPct:null,msrpSource:null};

test("validates domain contracts and formatting edge cases",()=>{
  assert.equal(parseCard(card).productId,1);
  assert.equal(parseSealedProduct(unavailable).marketPrice,null);
  assert.deepEqual(parsePriceHistory({points:[{date:"2026-05-27",price:10}],coverage:"exact"}).points,[{date:"2026-05-27",price:10}]);
  assert.throws(()=>parseCard({...card,game:"magic"}),/market/);
  assert.equal(formatUsd(0),"$0.00");
  assert.equal(formatUsd(.75),"$0.75");
  assert.equal(formatUsd(1488),"$1,488");
  assert.equal(formatUsd(null,"N/A"),"N/A");
  assert.equal(formatPercent(2.34),"+2.3%");
  assert.equal(formatPercent(-2.34),"-2.3%");
});

test("applies the D1 migration and ingests a fixture idempotently",async()=>{
  const database=new DatabaseSync(":memory:");
  database.exec("pragma foreign_keys=on");
  const migration=await readFile(new URL("../drizzle/0000_exotic_zombie.sql",import.meta.url),"utf8");
  for(const statement of migration.split("--> statement-breakpoint").map(value=>value.trim()).filter(Boolean))database.exec(statement);
  const db=new LocalD1(database),runId="fixture-2026-08-25",observedAt="2026-08-25T12:00:00.000Z";
  const points=Array.from({length:91},(_,day)=>({date:new Date(Date.UTC(2026,4,27+day)).toISOString().slice(0,10),price:10+day/10}));
  for(let pass=0;pass<2;pass++){
    await startIngestion(db,runId,"fixture",observedAt);
    await upsertCard(db,parseCard(card),observedAt,runId);
    await upsertSealedProduct(db,parseSealedProduct(sealed),observedAt,runId);
    await upsertSealedProduct(db,parseSealedProduct(unavailable),observedAt,runId);
    await upsertHistory(db,card.productId,"Holofoil","Near Mint",points,observedAt);
    await completeIngestion(db,runId,"daily-market",observedAt,3,3);
  }
  assert.equal(database.prepare("select count(*) as count from catalog_products").get().count,3);
  assert.equal(database.prepare("select count(*) as count from price_observations").get().count,91);
  assert.equal(database.prepare("select count(*) as count from ingestion_runs").get().count,1);
  assert.deepEqual({...await readProductSnapshot(db,1)},{productId:1,kind:"single",game:"pokemon",name:"Fixture Card",setName:"Fixture Set",marketCents:1234,medianCents:1300,msrpCents:null});
  assert.deepEqual({...await readProductSnapshot(db,3)},{productId:3,kind:"sealed",game:"pokemon",name:"Regional Gift Box",setName:"Fixture Set",marketCents:null,medianCents:null,msrpCents:null});
  const plan=database.prepare("explain query plan select * from catalog_products where kind='single' and game='pokemon' and section='illustration-rares'").all();
  assert.match(plan.map(row=>row.detail).join(" "),/idx_catalog_kind_game_section/);
  database.close();
});
