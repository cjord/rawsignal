import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import {querySealedCatalog,querySinglesCatalog} from "../core/catalog-query.ts";
import {parseCards,parseSealedProducts} from "../core/domain/contracts.ts";
import {parseMarketQuery,serializeMarketQuery} from "../app/state/market-query.ts";

const json=async path=>JSON.parse(await readFile(new URL(path,import.meta.url),"utf8"));

test("critical URL journey preserves Singles controls and switches cleanly to Sealed",async()=>{
 const singles=parseMarketQuery("?market=pokemon&mode=singles&rarity=illustration-rares&view=medium&sort=market&direction=desc&page=1&perPage=20&signal=leaderboard&strictness=balanced");
 assert.equal(singles.mode,"singles");
 const filtered={...singles,query:"magikarp",sets:["SV02: Paldea Evolved"],sort:"name",direction:"asc",page:1};
 assert.deepEqual(parseMarketQuery(serializeMarketQuery(filtered)),filtered);
 const cards=parseCards(await json("../public/data/illustration-rares.json"));
 const result=querySinglesCatalog(cards,{market:filtered.market,sections:filtered.rarities,query:filtered.query,sets:filtered.sets,minPrice:filtered.minPrice,maxPrice:filtered.maxPrice,up7:filtered.up7,down7:filtered.down7,up30:filtered.up30,down30:filtered.down30,signal:filtered.signal,strictness:filtered.strictness,sort:filtered.sort,direction:filtered.direction,page:filtered.page,perPage:filtered.perPage});
 assert.ok(result.total>=1);
 assert.ok(result.items.every(card=>/magikarp/i.test(card.name)&&card.set==="SV02: Paldea Evolved"));

 const sealed=parseMarketQuery("?market=pokemon&mode=sealed&type=Booster+Boxes&view=medium&sort=market&direction=desc&page=1&perPage=20&signal=leaderboard&strictness=balanced");
 assert.equal(sealed.mode,"sealed");
 assert.deepEqual(parseMarketQuery(serializeMarketQuery(sealed)),sealed);
 const products=parseSealedProducts(await json("../public/data/sealed-pokemon.json"));
 const sealedResult=querySealedCatalog(products,{...sealed,productTypes:sealed.productTypes});
 assert.ok(sealedResult.total>=1);
 assert.ok(sealedResult.items.every(product=>product.category==="Booster Boxes"));
});
