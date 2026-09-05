import assert from "node:assert/strict";
import test from "node:test";
import {evRatio,packChaseEv,packValueBreakdown} from "../core/domain/pack-ev.ts";

test("pack chase EV sums tier value per pack and stays null-honest",()=>{
 // A $75-average tier hit every 8 packs plus a $200-average tier hit every 40 packs.
 assert.equal(packChaseEv([{packsPerHit:8,averageMarket:75},{packsPerHit:40,averageMarket:200}]),75/8+5);
 // Tiers without a priced average contribute nothing; an all-unpriced set has no EV.
 assert.equal(packChaseEv([{packsPerHit:8,averageMarket:75},{packsPerHit:12,averageMarket:null}]),75/8);
 assert.equal(packChaseEv([{packsPerHit:12,averageMarket:null}]),null);
 assert.equal(packChaseEv([]),null);
});

test("the EV ratio compares EV against a live pack price without inventing one",()=>{
 assert.equal(evRatio(14.375,5),2.875);
 assert.equal(evRatio(14.375,null),null);
 assert.equal(evRatio(null,5),null);
 assert.equal(evRatio(10,0),null);
});

test("the pack value breakdown prices slot tiers per pack and chase tiers per hit, and leaves unrated tiers out",()=>{
 const tier=(key,extra)=>({key,label:key,perPack:null,packsPerHit:null,cardCount:10,pricedCount:10,sumMarket:10,topMarket:5,topProductId:1,...extra});
 const breakdown=packValueBreakdown([
  tier("Common",{perPack:7,cardCount:100,pricedCount:80,sumMarket:19}),   // avg 0.19 over every card → 1.33 per pack
  tier("Epic",{packsPerHit:4,cardCount:40,pricedCount:40,sumMarket:466.8}), // avg 11.67 → 2.9175
  tier("Promo",{}),                                                        // no odds → unrated
 ]);
 assert.deepEqual(breakdown.tiers.map(item=>item.kind),["slot","chase","unrated"]);
 assert.equal(breakdown.tiers[0].average,0.19);
 assert.equal(Math.round(breakdown.tiers[0].evPerPack*100)/100,1.33);
 assert.equal(Math.round(breakdown.tiers[1].evPerPack*10000)/10000,2.9175);
 assert.equal(breakdown.tiers[2].evPerPack,null);
 assert.equal(breakdown.tiers[2].share,null);
 assert.equal(Math.round(breakdown.totalEv*10000)/10000,4.2475);
 assert.equal(breakdown.chaseEv,breakdown.tiers[1].evPerPack);
 assert.equal(breakdown.impliedPackSize,7.25);
 assert.deepEqual(breakdown.unratedTiers,["Promo"]);
 // An explicit chase flag overrides the default (odds-based tiers count as chase).
 assert.equal(packValueBreakdown([tier("Epic",{packsPerHit:4,chase:false})]).chaseEv,0);
 // Nothing rated → null; an unpriced tier has no average and no value.
 assert.equal(packValueBreakdown([tier("Promo",{})]),null);
 assert.equal(packValueBreakdown([tier("Common",{perPack:7,cardCount:0,pricedCount:0,sumMarket:0})]),null);
});
