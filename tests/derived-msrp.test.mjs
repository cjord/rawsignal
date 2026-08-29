import assert from "node:assert/strict";
import test from "node:test";
import {DERIVED_MSRP_SOURCE,derivedPokemonMsrp} from "../core/msrp/derived-msrp.ts";
import {normalizePokemonSealedProduct} from "../core/normalize/sealed.ts";

test("standard pricing derives by product type and era, and refuses what it cannot know",()=>{
 // The SV boundary (2023) moved packs $3.99 -> $4.49 and ETBs $39.99 -> $49.99.
 assert.deepEqual(derivedPokemonMsrp("SWSH07: Evolving Skies Elite Trainer Box",2021),{msrp:39.99,msrpSource:DERIVED_MSRP_SOURCE});
 assert.deepEqual(derivedPokemonMsrp("SV08: Surging Sparks Elite Trainer Box",2024),{msrp:49.99,msrpSource:DERIVED_MSRP_SOURCE});
 assert.equal(derivedPokemonMsrp("SV: Prismatic Evolutions Booster Bundle",2025).msrp,26.94);
 assert.equal(derivedPokemonMsrp("ME01: Mega Evolution Booster Box",2026).msrp,161.64);
 assert.equal(derivedPokemonMsrp("ME01: Mega Evolution Booster Pack",2026).msrp,4.49);
 // Exclusions: variable-priced and exclusive products stay null for the verified pass.
 assert.equal(derivedPokemonMsrp("SV03: Obsidian Flames Pokemon Center Elite Trainer Box",2023),null);
 assert.equal(derivedPokemonMsrp("SV01: Sleeved Booster Pack",2023),null);
 assert.equal(derivedPokemonMsrp("Booster Bundle Display",2024),null);
 assert.equal(derivedPokemonMsrp("Crown Zenith Premium Collection",2023),null);
 // Pre-SWSH standards are unverified: never derive.
 assert.equal(derivedPokemonMsrp("Base Set Booster Pack",1999),null);
 assert.equal(derivedPokemonMsrp("Booster Pack",null),null);
});

test("the normalizer prefers published MSRP and falls back to badged derived pricing",()=>{
 const group={groupId:1,name:"SV08: Surging Sparks",publishedOn:"2024-11-08T00:00:00"};
 const product={productId:501,name:"SV08: Surging Sparks Elite Trainer Box",imageUrl:"",url:"https://example.com",extendedData:[]};
 const price={marketPrice:62,midPrice:64,subTypeName:"Normal"};
 const published=normalizePokemonSealedProduct(product,group,price,{msrp:49.99,matched:true});
 assert.equal(published.msrpSource,"Published product MSRP");
 const derived=normalizePokemonSealedProduct(product,group,price,undefined);
 assert.equal(derived.msrp,49.99);
 assert.equal(derived.msrpSource,DERIVED_MSRP_SOURCE);
 assert.equal(derived.profit,Number((62-49.99).toFixed(2)));
 // A product outside every rule keeps its honest null.
 const collection=normalizePokemonSealedProduct({...product,productId:502,name:"Surging Sparks Premium Collection"},group,price,undefined);
 assert.equal(collection.msrp,null);
 assert.equal(collection.msrpSource,null);
});
