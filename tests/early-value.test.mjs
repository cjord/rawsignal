import assert from "node:assert/strict";
import {readFile,readdir} from "node:fs/promises";
import {DatabaseSync} from "node:sqlite";
import test from "node:test";
import {readEarlyValue} from "../db/early-value.ts";
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
  async batch(statements){for(const statement of statements)await statement.run();return[]}
}
async function migratedDatabase(){
  const database=new DatabaseSync(":memory:");database.exec("pragma foreign_keys=on");
  const directory=new URL("../drizzle/",import.meta.url),names=(await readdir(directory)).filter(name=>/^\d+.*\.sql$/.test(name)).sort();
  for(const name of names){const migration=await readFile(new URL(name,directory),"utf8");for(const statement of migration.split("--> statement-breakpoint").map(value=>value.trim()).filter(Boolean))database.exec(statement)}
  return database;
}
const card=(productId,set,rarity,marketPrice)=>({game:"pokemon",section:"special-illustration-rares",productId,name:`Card ${productId}`,set,year:2026,rarity,number:`${productId}/100`,image:"",url:"https://example.com",marketPrice,lowPrice:null,midPrice:null,highPrice:null,printing:"Holofoil",priceChange:null});
const dayAgo=days=>new Date(Date.now()-days*86400000).toISOString().slice(0,10);

test("EVE anchors a new card on mature same-era siblings and refuses everything else (P7)",async()=>{
  const db=new LocalD1(await migratedDatabase());
  await startIngestion(db,"seed","fixture","2026-09-01T00:00:00Z",{});
  // Target: brand-new Delta Reign SIR (no observations yet — presale/launch window).
  await upsertCard(db,card(900,"ME06: Delta Reign","Special Illustration Rare",250),"2026-09-01T00:00:00Z","seed");
  // Era siblings: two mature ME sets with 5 SIRs each at known prices.
  const prices=[40,60,80,100,120,140,160,180,200,220];
  for(let index=0;index<10;index++)await upsertCard(db,card(100+index,index<5?"ME01: Mega Evolution":"ME02: Phantasmal Flames","Special Illustration Rare",prices[index]),"2026-09-01T00:00:00Z","seed");
  const eve=await readEarlyValue(db,900);
  assert.ok(eve,"new SIR should get an estimate");
  assert.equal(eve.members,10);assert.equal(eve.sets,2);
  assert.equal(eve.median,130);
  assert.deepEqual([eve.q25,eve.q75],[85,175]);
  // A mature card (first observation 60 days back) is past the launch window.
  await upsertHistory(db,900,"Holofoil","Near Mint",[{date:dayAgo(60),price:240}],"now");
  assert.equal(await readEarlyValue(db,900),null);
  // But presale flag overrides the window check.
  assert.ok(await readEarlyValue(db,900,true));
  // Promo-style sets never serve an estimate.
  await upsertCard(db,card(901,"ME: Mega Evolution Promo","Promo",25),"2026-09-01T00:00:00Z","seed");
  assert.equal(await readEarlyValue(db,901),null);
  // Era cold-start: one sibling set is not enough.
  await upsertCard(db,card(902,"SV99: Lone Era","Special Illustration Rare",99),"2026-09-01T00:00:00Z","seed");
  assert.equal(await readEarlyValue(db,902),null);
});
