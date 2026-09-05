import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import {parsePullRateConfig} from "../core/domain/contracts.ts";
import {buildValueBreakdown,isChaseTier,tierRank} from "../core/domain/value-breakdown.ts";
import {perPackFor,pullRateFor} from "../core/catalog-repository.ts";
import {summarizeGroupRarities,tierFor} from "../core/normalize/rarity-stats.ts";

const card=(productId,name,rarity,number="1/100")=>({productId,name,extendedData:[{name:"Rarity",value:rarity},{name:"Number",value:number}]});
const price=(productId,marketPrice,subTypeName="Normal")=>({productId,marketPrice,subTypeName});

test("a group aggregates every carded product by tier, counting unpriced cards but not pricing them",()=>{
 const rows=summarizeGroupRarities({game:"pokemon",products:[
  card(1,"Pidgey","Common"),card(2,"Rattata","Common"),card(3,"Zubat","Common"),
  card(4,"Charizard ex","Double Rare"),
  {productId:9,name:"Booster Box",extendedData:[]},
 ],prices:[price(1,0.05),price(2,0.12),price(4,40),price(4,55,"Reverse Holofoil"),price(9,120)]});
 assert.deepEqual(rows,[
  {tier:"Common",rarity:"Common",section:null,cardCount:3,pricedCount:2,sumCents:17,topCents:12,topProductId:2},
  // The highest priced printing is the card's price, as in the singles normalizer.
  {tier:"Double Rare",rarity:"Double Rare",section:null,cardCount:1,pricedCount:1,sumCents:5500,topCents:5500,topProductId:4},
 ]);
});

test("Riftbound tiers key showcase and rare cards by section and everything else by rarity",()=>{
 assert.deepEqual(tierFor("riftbound","Vi (Alternate Art)","Showcase"),{tier:"alt-arts",section:"alt-arts"});
 assert.deepEqual(tierFor("riftbound","Jinx (Overnumbered)","Showcase"),{tier:"overnumbered",section:"overnumbered"});
 assert.deepEqual(tierFor("riftbound","Jinx (Signature)","Showcase"),{tier:"signatures",section:"signatures"});
 assert.deepEqual(tierFor("riftbound","Rune","Rare"),{tier:"rares",section:"rares"});
 assert.deepEqual(tierFor("riftbound","Rune","Epic"),{tier:"epics",section:"epics"});
 assert.deepEqual(tierFor("riftbound","Grunt","Common"),{tier:"Common",section:null});
 assert.deepEqual(tierFor("pokemon","Pikachu (Alternate Art)","Illustration Rare"),{tier:"Illustration Rare",section:null});
 const rows=summarizeGroupRarities({game:"riftbound",products:[card(1,"Grunt","Common"),card(2,"Vi (Alternate Art)","Showcase"),card(3,"Vi (Signature)","Showcase")],prices:[price(1,0.1),price(2,30),price(3,1200)]});
 // Rows come back in locale tier order (the breakdown re-sorts by the curated ladder).
 assert.deepEqual(rows.map(row=>[row.tier,row.rarity,row.sumCents]),[["alt-arts","Showcase",3000],["Common","Common",10],["signatures","Showcase",120000]]);
});

test("the pull-rate config parses perPack tables with the same rules and resolves them section first",async()=>{
 const config=parsePullRateConfig(JSON.parse(await readFile(new URL("../public/data/pull-rates.json",import.meta.url),"utf8")));
 assert.deepEqual(config.games.riftbound.perPack.default,{Common:7,Uncommon:3,Rare:2});
 // Pokémon has no game-wide pack (sizes differ by era): its perPack lives in era tables only.
 assert.deepEqual(config.games.pokemon.perPack.default,{});
 assert.deepEqual(perPackFor(config,"riftbound","Origins",{rarity:"Rare",section:"rares"}),{key:"Rare",perPack:2,bySection:false});
 assert.equal(perPackFor(config,"riftbound","Origins",{rarity:"Epic",section:"epics"}),null);
 assert.equal(perPackFor(config,"pokemon","Surging Sparks",{rarity:"Common"}),null);
 const override=parsePullRateConfig({games:{riftbound:{default:{Epic:4},perPack:{default:{Common:7},sets:{Radiance:{Common:6,"alt-arts":1}}}}}});
 assert.deepEqual(perPackFor(override,"riftbound","Radiance",{rarity:"Showcase",section:"alt-arts"}),{key:"alt-arts",perPack:1,bySection:true});
 assert.equal(perPackFor(override,"riftbound","Radiance",{rarity:"Common"}).perPack,6);
 assert.throws(()=>parsePullRateConfig({games:{riftbound:{default:{},perPack:{default:{Common:0}}}}}),/Invalid pull rate for Common/);
});

test("a Riftbound set's breakdown reproduces the reference: tier ladder, 40% chase, implied pack size 12.35",async()=>{
 const config=parsePullRateConfig(JSON.parse(await readFile(new URL("../public/data/pull-rates.json",import.meta.url),"utf8")));
 const stat=(tier,rarity,section,cardCount,pricedCount,avg,top)=>({tier,rarity,section,cardCount,pricedCount,sumMarket:Math.round(avg*cardCount*100)/100,topMarket:top,topProductId:1,updatedAt:"2026-09-04T00:00:00Z"});
 const stats=[
  stat("signatures","Showcase","signatures",12,12,1351.43,3474.41),
  stat("Common","Common",null,88,88,0.19,3.33),
  stat("epics","Epic","epics",42,42,11.67,70.84),
  stat("Uncommon","Uncommon",null,84,84,0.51,9.04),
  stat("alt-arts","Showcase","alt-arts",39,38,20.5,98.65),
  stat("rares","Rare","rares",84,84,1.41,25),
  stat("overnumbered","Showcase","overnumbered",12,12,153.89,372.18),
  stat("Promo","Promo",null,3,1,4,12),
 ];
 const breakdown=buildValueBreakdown(config,"riftbound","Origins",stats);
 assert.deepEqual(breakdown.tiers.map(tier=>tier.label),["Common","Uncommon","Rare","Epic","Alt art","Over-numbered","Signature","Promo"]);
 assert.deepEqual(breakdown.tiers.map(tier=>tier.kind),["slot","slot","slot","chase","chase","chase","chase","unrated"]);
 const ev=Object.fromEntries(breakdown.tiers.map(tier=>[tier.label,tier.evPerPack==null?null:Math.round(tier.evPerPack*100)/100]));
 assert.deepEqual(ev,{Common:1.33,Uncommon:1.53,Rare:2.82,Epic:2.92,"Alt art":1.71,"Over-numbered":2.14,Signature:1.88,Promo:null});
 assert.equal(breakdown.impliedPackSize.toFixed(2),"12.35");
 // Chase prints are the showcase tiers (Epics are regular pulls): 5.73 of 14.32.
 assert.equal(Math.round(breakdown.chaseShare*1000)/10,40);
 assert.equal(Math.round(breakdown.totalEv*100)/100,14.32);
 assert.ok(Math.abs(breakdown.tiers.filter(tier=>tier.share!=null).reduce((sum,tier)=>sum+tier.share,0)-1)<1e-9);
 assert.deepEqual(breakdown.unratedTiers,["Promo"]);
 assert.equal(breakdown.updatedAt,"2026-09-04T00:00:00Z");
 assert.deepEqual(breakdown.tiers.map(tier=>tier.chase),[false,false,false,false,true,true,true,false]);
 // No stats, or nothing rated, is no breakdown.
 assert.equal(buildValueBreakdown(config,"riftbound","Origins",[]),null);
 assert.equal(buildValueBreakdown(config,"pokemon","Some Set",[stat("Common","Common",null,10,10,0.1,1)]),null);
 // Ordering and chase flags are curated per game.
 assert.ok(tierRank("pokemon","Common")<tierRank("pokemon","Special Illustration Rare"));
 assert.equal(tierRank("pokemon","Mystery"),1000);
 assert.equal(isChaseTier("pokemon","Ultra Rare"),false);
 assert.equal(isChaseTier("pokemon","Special Illustration Rare"),true);
});

test("Pokémon compositions resolve by era between a set override and the game default",async()=>{
 const config=parsePullRateConfig(JSON.parse(await readFile(new URL("../public/data/pull-rates.json",import.meta.url),"utf8")));
 assert.deepEqual(Object.keys(config.games.pokemon.perPack.eras),["wotc","ex","dp","bw","xy","sm","swsh","sv","me"]);
 // Era tables carry the expected pack: 4 commons in Scarlet & Violet, 7 in WotC, none without an era.
 assert.equal(perPackFor(config,"pokemon","SV: Prismatic Evolutions",{rarity:"Common"},"sv").perPack,4);
 assert.equal(perPackFor(config,"pokemon","Base Set",{rarity:"Common"},"wotc").perPack,7);
 assert.equal(perPackFor(config,"pokemon","Base Set",{rarity:"Holo Rare"},"wotc").perPack,0.33);
 assert.equal(perPackFor(config,"pokemon","Base Set",{rarity:"Common"}),null);
 // A set override beats its era; an era beats the game default; packs-per-hit resolves the same way.
 const custom=parsePullRateConfig({games:{pokemon:{default:{"Double Rare":4},eras:{sv:{"Double Rare":5}},sets:{"SV: Prismatic Evolutions":{"Double Rare":6}},perPack:{default:{Common:9},eras:{sv:{Common:4}},sets:{"SV: Prismatic Evolutions":{Common:3}}}}}});
 assert.equal(perPackFor(custom,"pokemon","SV: Prismatic Evolutions",{rarity:"Common"},"sv").perPack,3);
 assert.equal(perPackFor(custom,"pokemon","SV: Paldea Evolved",{rarity:"Common"},"sv").perPack,4);
 assert.equal(perPackFor(custom,"pokemon","Base Set",{rarity:"Common"},"wotc").perPack,9);
 assert.equal(pullRateFor(custom,"pokemon","SV: Prismatic Evolutions",{rarity:"Double Rare"},"sv").packsPerHit,6);
 assert.equal(pullRateFor(custom,"pokemon","SV: Paldea Evolved",{rarity:"Double Rare"},"sv").packsPerHit,5);
 assert.equal(pullRateFor(custom,"pokemon","Base Set",{rarity:"Double Rare"},"wotc").packsPerHit,4);
 assert.throws(()=>parsePullRateConfig({games:{pokemon:{default:{},eras:"sv"}}}),/Invalid pull-rate eras/);
 // A Scarlet & Violet set prices its bulk from the era table and its chase tiers from the game default.
 const stat=(tier,cardCount,avg)=>({tier,rarity:tier,section:null,cardCount,pricedCount:cardCount,sumMarket:Math.round(avg*cardCount*100)/100,topMarket:null,topProductId:null,updatedAt:"2026-09-04T00:00:00Z"});
 const breakdown=buildValueBreakdown(config,"pokemon","SV: Surging Sparks",[stat("Common",80,0.08),stat("Uncommon",60,0.15),stat("Rare",30,0.4),stat("Double Rare",20,3),stat("Special Illustration Rare",12,60),stat("Reverse Holofoil",5,1)],"sv");
 assert.deepEqual(breakdown.tiers.map(tier=>[tier.label,tier.kind,tier.chase]),[["Common","slot",false],["Uncommon","slot",false],["Rare","slot",false],["Reverse Holofoil","unrated",false],["Double Rare","chase",false],["Special Illustration Rare","chase",true]]);
 assert.equal(Math.round(breakdown.totalEv*100)/100,Math.round((0.08*4+0.15*3+0.4+3/4+60/58)*100)/100);
 assert.equal(breakdown.impliedPackSize.toFixed(3),(4+3+1+1/4+1/58).toFixed(3));
});
