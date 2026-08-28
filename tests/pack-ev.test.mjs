import assert from "node:assert/strict";
import test from "node:test";
import {evRatio,packChaseEv} from "../app/domain/pack-ev.ts";

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
