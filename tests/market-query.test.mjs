import assert from "node:assert/strict";
import test from "node:test";
import {parseMarketQuery,serializeMarketQuery} from "../app/state/market-query.ts";

test("round-trips a complex Singles URL",()=>{
 const state=parseMarketQuery("?mode=singles&market=riftbound&rarity=overnumbered%7Csignatures&view=full&sort=change30&direction=asc&page=3&perPage=40&signal=buy&strictness=conservative&q=teemo&minPrice=12&maxPrice=90&sets=Origins%7CSpiritforged&up7=1&down30=1");
 assert.deepEqual(parseMarketQuery(serializeMarketQuery(state)),state);
});

test("round-trips a complex Sealed URL",()=>{
 const state=parseMarketQuery("?mode=sealed&market=onepiece&type=Booster+Boxes%7CCases&view=text&sort=profit&direction=asc&page=2&perPage=30&signal=sell&strictness=aggressive&q=display&sets=OP-01%7COP-02&marketMin=50&marketMax=500&msrpMin=30&profitMin=-10&profitPctMax=200&basis=median&keepPct=90&taxOn=1&taxRate=7.5&shipping=8&profitableOnly=1");
 assert.deepEqual(parseMarketQuery(serializeMarketQuery(state)),state);
});

test("normalizes legacy Magic and invalid values",()=>{
 const state=parseMarketQuery("?market=magic&rarity=all&view=unknown&page=-2&perPage=999");
 assert.equal(state.mode,"singles");assert.equal(state.market,"pokemon");assert.deepEqual(state.rarities,[]);assert.equal(state.view,"medium");assert.equal(state.page,1);assert.equal(state.perPage,20);
});
