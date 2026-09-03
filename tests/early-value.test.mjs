import assert from "node:assert/strict";
import {readFile,readdir} from "node:fs/promises";
import {DatabaseSync} from "node:sqlite";
import test from "node:test";
import {readEarlyValue} from "../db/early-value.ts";
import {blendEarlyValue,settleRatioAt} from "../core/domain/release.ts";
import {startIngestion,upsertCard,upsertHistory,upsertSealedProduct} from "../db/repository.ts";

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
const sealed=(productId,set,category,marketPrice)=>({game:"pokemon",productId,name:`Sealed ${productId}`,set,category,image:"",url:"https://example.com",marketPrice,midPrice:null,msrp:null,msrpSource:null,priceChange:null});
const dayAgo=days=>new Date(Date.now()-days*86400000).toISOString().slice(0,10);

test("settle curve interpolates log-linearly and the blend shifts with observed trading (P7 dynamic)",()=>{
  const settle={d14:.9,d30:.76,d60:.65};
  assert.equal(settleRatioAt(settle,3),1);
  assert.equal(settleRatioAt(settle,90),.65);
  const mid=settleRatioAt(settle,22);
  assert.ok(mid<.9&&mid>.76,`day-22 ratio ${mid} sits between the day-14 and day-30 nodes`);
  const anchor={median:130,q25:85,q75:175};
  // No trading yet: the cohort anchor serves untouched.
  assert.deepEqual(blendEarlyValue({anchor,currentPrice:null,observedDays:0,ageDays:null,settle}),{median:130,q25:85,q75:175,ownWeight:0});
  // 14+ observed days post-release: fully tracking the product's own projection.
  const full=blendEarlyValue({anchor,currentPrice:200,observedDays:20,ageDays:20,settle});
  assert.equal(full.ownWeight,1);
  const projected=200*(.65/settleRatioAt(settle,20));
  assert.ok(Math.abs(full.median-projected)<.5,`full-weight median ${full.median} ≈ own projection ${projected.toFixed(2)}`);
  // Presale trading counts but keeps the cohort tether (weight cap).
  const presale=blendEarlyValue({anchor,currentPrice:250,observedDays:30,ageDays:null,settle});
  assert.equal(presale.ownWeight,.75);
  assert.ok(presale.median>130&&presale.median<250*.65,"presale blend sits between anchor and full projection");
});

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
  assert.equal(eve.ownWeight,0,"no observations → pure cohort anchor");
  assert.equal(eve.median,130);
  assert.deepEqual([eve.q25,eve.q75],[85,175]);
  // A mature card (first observation 60 days back, set undatable) is past the window.
  await upsertHistory(db,900,"Holofoil","Near Mint",[{date:dayAgo(60),price:240}],"now");
  assert.equal(await readEarlyValue(db,900),null);
  // But the presale flag overrides the window check — and its observed trading now
  // pulls the estimate above the pure anchor, toward the card's own projection.
  const blended=await readEarlyValue(db,900,true);
  assert.ok(blended,"presale card still serves");
  assert.ok(blended.ownWeight>0&&blended.ownWeight<=.75,`presale weight ${blended.ownWeight} is tethered`);
  assert.ok(blended.median>130&&blended.median<250*.65,`median ${blended.median} shifted toward the $${(250*.65).toFixed(0)} projection`);
  // Promo-style sets never serve an estimate.
  await upsertCard(db,card(901,"ME: Mega Evolution Promo","Promo",25),"2026-09-01T00:00:00Z","seed");
  assert.equal(await readEarlyValue(db,901),null);
  // Era cold-start: one sibling set is not enough.
  await upsertCard(db,card(902,"SV99: Lone Era","Special Illustration Rare",99),"2026-09-01T00:00:00Z","seed");
  assert.equal(await readEarlyValue(db,902),null);
});

test("EVE serves sealed products on the product-type rung (P7 follow-up 2026-09-03)",async()=>{
  const db=new LocalD1(await migratedDatabase());
  await startIngestion(db,"seed","fixture","2026-09-01T00:00:00Z",{});
  // Target: Delta Reign ETB on presale at $139.
  await upsertSealedProduct(db,sealed(910,"ME06: Delta Reign","Elite Trainer Boxes",139),"2026-09-01T00:00:00Z","seed");
  // Sibling sealed: two mature ME sets, two ETBs each (sealed floor is 4 members).
  const boxPrices=[45,55,65,75];
  for(let index=0;index<4;index++)await upsertSealedProduct(db,sealed(920+index,index<2?"ME01: Mega Evolution":"ME02: Phantasmal Flames","Elite Trainer Boxes",boxPrices[index]),"2026-09-01T00:00:00Z","seed");
  const eve=await readEarlyValue(db,910,true);
  assert.ok(eve,"presale sealed should get an estimate");
  assert.equal(eve.members,4);assert.equal(eve.sets,2);
  assert.equal(eve.ownWeight,0);
  assert.equal(eve.median,60);
  // Presale trading shifts the sealed estimate toward its own ETB-curve projection.
  await upsertHistory(db,910,"Sealed","Unopened",Array.from({length:14},(_,i)=>({date:dayAgo(20-i),price:139})),"now");
  const blended=await readEarlyValue(db,910,true);
  assert.ok(blended.ownWeight>=.75,`14 presale days observed → weight ${blended.ownWeight} at the cap`);
  assert.ok(blended.median>60,`median ${blended.median} moved off the $60 anchor toward the ETB projection`);
  // A different product type with too few members refuses (floor 4).
  await upsertSealedProduct(db,sealed(930,"ME06: Delta Reign","Booster Bundles",90),"2026-09-01T00:00:00Z","seed");
  await upsertSealedProduct(db,sealed(931,"ME01: Mega Evolution","Booster Bundles",30),"2026-09-01T00:00:00Z","seed");
  await upsertSealedProduct(db,sealed(932,"ME02: Phantasmal Flames","Booster Bundles",32),"2026-09-01T00:00:00Z","seed");
  assert.equal(await readEarlyValue(db,930,true),null);
});
