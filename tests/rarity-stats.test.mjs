import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import {parsePullRateConfig} from "../core/domain/contracts.ts";
import {buildValueBreakdown} from "../core/domain/value-breakdown.ts";
import {perPackFor,pullRateFor} from "../core/catalog-repository.ts";
import {summarizeGroupRarities,ordinaryPackPrice,tierFor} from "../core/normalize/rarity-stats.ts";
import {packProfileFor} from "../core/domain/pack-profile.ts";
import {buildPackResearch} from "../scripts/packs/build.mjs";

const raw=JSON.parse(await readFile(new URL("../public/data/pull-rates.json",import.meta.url),"utf8"));
const config=parsePullRateConfig(raw);
const card=(productId,name,rarity)=>({productId,name,extendedData:[{name:"Rarity",value:rarity},{name:"Number",value:"1/100"}]});
const price=(productId,marketPrice,subTypeName="Normal")=>({productId,marketPrice,subTypeName});
const stat=(tier,average=1,pricedCount=10)=>({tier,rarity:tier,section:null,cardCount:10,pricedCount,sumMarket:average*pricedCount,topMarket:average,topProductId:1,updatedAt:"2026-09-17"});

test("pack aggregates use ordinary printing and preserve missing prices",()=>{
 const rows=summarizeGroupRarities({game:"pokemon",products:[card(1,"A","Common"),card(2,"B","Common"),card(3,"C","Double Rare")],prices:[price(1,.1),price(1,20,"Reverse Holofoil"),price(2,30,"Reverse Holofoil"),price(3,4,"Holofoil"),price(3,99,"Master Ball")]});
 assert.deepEqual(rows.map(r=>[r.tier,r.cardCount,r.pricedCount,r.sumCents]),[["Common",2,1,10],["Double Rare",1,1,400]]);
 assert.equal(ordinaryPackPrice([price(1,null),price(1,5,"Holofoil")],"Rare"),null);
 assert.equal(ordinaryPackPrice([price(1,2,"Foil")],"Rare"),2);
 assert.equal(ordinaryPackPrice([price(1,Infinity)],"Common"),null);
 assert.deepEqual(tierFor("riftbound","Vi (Signature)","Showcase"),{tier:"signatures",section:"signatures"});
});

test("all catalog booster sets have reproducible profiles; Japanese deluxe is product-specific",async()=>{
 const catalog=(await Promise.all(["pokemon","riftbound"].map(async game=>JSON.parse(await readFile(new URL("../public/data/sealed-"+game+".json",import.meta.url),"utf8"))))).flat();
 assert.deepEqual(buildPackResearch(catalog),raw);
 const packs=catalog.filter(p=>p.category==="Booster Packs");
 assert.equal(new Set(packs.map(p=>p.game+"|"+p.set)).size,198);
 for(const p of packs)assert.ok(packProfileFor(config,p.game,p.set,p.productId),p.name);
 const deluxe=catalog.find(p=>p.set==="SV11B: Black Bolt"&&/deluxe/i.test(p.name));
 assert.ok(deluxe);
 assert.equal(packProfileFor(config,"pokemon",deluxe.set,deluxe.productId).cardsPerPack,35);
 assert.equal(packProfileFor(config,"pokemon",deluxe.set).cardsPerPack,7);
 assert.equal(packProfileFor(config,"pokemon","S8b: VMAX Climax").cardsPerPack,11);
 assert.equal(packProfileFor(config,"pokemon","Celebrations").cardsPerPack,4);
 assert.equal(packProfileFor(config,"pokemon","Unreviewed"),null);
});

test("set rates never leak across languages, games, unknown sets or eras",()=>{
 const rarity={rarity:"Special Illustration Rare"};
 assert.equal(pullRateFor(config,"pokemon","SV01: Scarlet & Violet Base Set",rarity).packsPerHit,100/3.15);
 assert.equal(pullRateFor(config,"pokemon","SV10: Destined Rivals",rarity).packsPerHit,100/1.06);
 for(const set of ["Base Set","ME06: Delta Reign","SV11B: Black Bolt","SV: Shrouded Fable","Unknown"])assert.equal(pullRateFor(config,"pokemon",set,rarity,"sv"),null);
 assert.equal(pullRateFor(config,"pokemon","SV: Prismatic Evolutions",{rarity:"Illustration Rare"}),null);
 for(const set of ["Spiritforged","Unleashed","Vendetta"])assert.equal(pullRateFor(config,"riftbound",set,{rarity:"Epic"}),null);
 assert.equal(pullRateFor(config,"pokemon","Origins",{rarity:"Epic"}),null);
 assert.equal(perPackFor(config,"pokemon","Unknown",{rarity:"Common"},"sv"),null);
});

test("SV Base rare replacement removes upgraded cards even if upgrade prices are absent",()=>{
 const set="SV01: Scarlet & Violet Base Set";
 const rare=perPackFor(config,"pokemon",set,{rarity:"Rare"}).perPack;
 assert.ok(Math.abs(rare+ .1376 + .0657 - 1)<1e-12);
 const b=buildValueBreakdown(config,"pokemon",set,[stat("Common"),stat("Uncommon"),stat("Rare"),stat("Double Rare"),stat("Ultra Rare")]);
 assert.ok(Math.abs(b.totalEv-8)<1e-12);
 assert.ok(Math.abs(b.impliedPackSize-8)<1e-12);
 const partial=buildValueBreakdown(config,"pokemon",set,[stat("Rare")]);
 assert.equal(partial.totalEv,rare);
 assert.equal(partial.partial,true);
 assert.equal(partial.cardsPerPack,10);
 assert.ok(partial.missingTiers.includes("Double Rare"));
});

test("Origins signatures partition Overnumbers and uncertain base rares stay unrated",()=>{
 const rate=tier=>pullRateFor(config,"riftbound","Origins",{rarity:"Showcase",section:tier}).packsPerHit;
 assert.ok(Math.abs(1/rate("overnumbered")+1/rate("signatures")-1/72)<1e-12);
 assert.equal(rate("overnumbered"),80);
 assert.equal(perPackFor(config,"riftbound","Origins",{rarity:"Rare",section:"rares"}),null);
 const b=buildValueBreakdown(config,"riftbound","Origins",[stat("Common"),stat("Uncommon"),stat("Rare")]);
 assert.equal(b.totalEv,10);
 assert.deepEqual(b.unratedTiers,["Rare"]);
});

test("missing prices never turn into zero-price cards",()=>{
 const b=buildValueBreakdown(config,"pokemon","SV01: Scarlet & Violet Base Set",[stat("Common",2,9),stat("Uncommon",1)]);
 assert.equal(b.totalEv,3);
 assert.equal(b.tiers[0].average,null);
 assert.equal(b.tiers[0].evPerPack,null);
 assert.equal(buildValueBreakdown(config,"pokemon","SV01: Scarlet & Violet Base Set",[stat("Common",2,0)]),null);
});

test("profile contract rejects inconsistent slots, unsafe sources and bad references",()=>{
 const bad=structuredClone(raw);bad.profiles.modern.cardsPerPack=11;
 assert.throws(()=>parsePullRateConfig(bad),/printed size/);
 const unknown=structuredClone(raw);unknown.setProfiles.pokemon["Base Set"]="missing";
 assert.throws(()=>parsePullRateConfig(unknown),/Unknown pack profile/);
 const url=structuredClone(raw);url.profiles.modern.sources=["javascript:alert(1)"];
 assert.throws(()=>parsePullRateConfig(url),/source URL/);
 const odds=structuredClone(raw);odds.games.pokemon.sets["SV01: Scarlet & Violet Base Set"]["Double Rare"]=0;
 assert.throws(()=>parsePullRateConfig(odds),/Invalid pull rate/);
});
