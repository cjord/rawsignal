import assert from "node:assert/strict";
import test from "node:test";
import {allowedRarities,defaultRarities} from "../core/market-state.ts";

// The section registry is a pure data contract shared by the URL codec, the query engine,
// the D1 repositories, and the Worker's feed enumeration — its invariants are what every
// consumer silently relies on.

test("every market's default rarities are allowed for that market",()=>{
 for(const market of Object.keys(defaultRarities)){
  for(const rarity of defaultRarities[market])assert.ok(allowedRarities[market].includes(rarity),`${market}: ${rarity}`);
 }
});

test("the all scope is the ordered union of the per-game registries",()=>{
 assert.deepEqual(allowedRarities.all,[...allowedRarities.pokemon,...allowedRarities.riftbound]);
 assert.deepEqual(defaultRarities.all,[...defaultRarities.pokemon,...defaultRarities.riftbound]);
});

test("registries carry no duplicates and no cross-game overlap",()=>{
 for(const [market,list] of Object.entries(allowedRarities))assert.equal(new Set(list).size,list.length,market);
 const overlap=allowedRarities.pokemon.filter(rarity=>allowedRarities.riftbound.includes(rarity));
 assert.deepEqual(overlap,[]);
});
