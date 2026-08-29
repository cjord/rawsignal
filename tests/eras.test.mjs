import assert from "node:assert/strict";
import test from "node:test";
import {eraLabel,pokemonEra} from "../core/domain/eras.ts";

test("era mapping: prefixes win where a set declares its block, year breaks ties",()=>{
 // Prefix beats a boundary year in both directions.
 assert.equal(pokemonEra("EX Dragon",2003),"ex");
 assert.equal(pokemonEra("EX Power Keepers",2007),"ex");
 assert.equal(pokemonEra("XY Promos",2013),"xy");
 assert.equal(pokemonEra("SM Promos",2016),"sm");
 assert.equal(pokemonEra("Crown Zenith",2023),"swsh");
 assert.equal(pokemonEra("Diamond and Pearl Promos",2007),"dp");
 // Year carries unprefixed sets.
 assert.equal(pokemonEra("Skyridge",2003),"wotc");
 assert.equal(pokemonEra("Base Set (Shadowless)",1999),"wotc");
 assert.equal(pokemonEra("Secret Wonders",2007),"dp");
 assert.equal(pokemonEra("Plasma Storm",2013),"bw");
 assert.equal(pokemonEra("Evolutions",2016),"xy");
 assert.equal(pokemonEra("Champion's Path",2020),"swsh");
 assert.equal(pokemonEra("SV: Prismatic Evolutions",2025),"sv");
 assert.equal(pokemonEra("ME03: Perfect Order",2026),"me");
 assert.equal(pokemonEra("Miscellaneous Cards & Products",2026),"me");
 assert.match(eraLabel("wotc"),/WotC/);
});
