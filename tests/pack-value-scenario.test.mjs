import assert from "node:assert/strict";
import test from "node:test";
import {packValueScenario,rarityExclusions,standardBoxPacks} from "../core/domain/pack-value-scenario.ts";
const tiers=[{key:"Common",evPerPack:2,chase:false},{key:"signatures",evPerPack:3,chase:true},{key:"unknown",evPerPack:null,chase:false}];
test("pack/box scenarios scale unrounded values and recompute shares without changing odds",()=>{
 const input={tiers};
 assert.equal(packValueScenario(input,[],1).total,5);
 assert.equal(packValueScenario(input,[],24).total,120);
 const result=packValueScenario(input,["signatures"],24);
 assert.equal(result.total,48);assert.equal(result.chaseShare,0);
 assert.equal(result.tiers[0].share,1);assert.equal(result.tiers[1].excluded,true);
 assert.equal(result.tiers[2].value,null);assert.equal(tiers[1].evPerPack,3);
 assert.equal(packValueScenario(input,["Common","signatures"],24).total,null);
 assert.equal(packValueScenario(input,[],0).total,null);
});
test("box formats are exact set/language matches, not a game-wide default",()=>{
 assert.equal(standardBoxPacks("riftbound","Origins","en"),24);
 assert.equal(standardBoxPacks("pokemon","SV01: Scarlet & Violet Base Set","en"),36);
 for(const set of ["SV: Scarlet & Violet 151","SV: Prismatic Evolutions","Unreviewed"])
  assert.equal(standardBoxPacks("pokemon",set,"en"),null);
 assert.equal(standardBoxPacks("pokemon","SV01: Scarlet & Violet Base Set","ja"),null);
});
test("exclusions identify SIRs and highest known rarity without guessing from prices",()=>{
 const rows=keys=>keys.map(key=>({key,label:key}));
 assert.deepEqual(rarityExclusions("pokemon",rows(["Special Illustration Rare","Hyper Rare"])).map(o=>o.key),["Special Illustration Rare","Hyper Rare"]);
 assert.deepEqual(rarityExclusions("pokemon",rows(["Special Illustration Rare","Ultra Rare"])).map(o=>o.key),["Special Illustration Rare"]);
 assert.deepEqual(rarityExclusions("riftbound",rows(["signatures","overnumbered"])).map(o=>o.key),["signatures"]);
 assert.deepEqual(rarityExclusions("riftbound",rows(["overnumbered"])).map(o=>o.key),["overnumbered"]);
 assert.deepEqual(rarityExclusions("pokemon",rows(["Unknown"])),[]);
});
