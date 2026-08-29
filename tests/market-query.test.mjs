import assert from "node:assert/strict";
import test from "node:test";
import {getHistoryWriteMode,parseMarketQuery,serializeMarketQuery} from "../app/state/market-query.ts";

test("round-trips a complex Singles URL without persisting the strictness preference",()=>{
 const state=parseMarketQuery("?mode=singles&market=riftbound&rarity=overnumbered%7Csignatures&view=full&sort=change30&direction=asc&page=3&perPage=40&signal=buy&strictness=conservative&q=teemo&minPrice=12&maxPrice=90&sets=Origins%7CSpiritforged&up7=1&down30=1");
 assert.equal(state.strictness,"conservative");
 // Strictness is a device preference (settings menu); it is parsed for old links but never serialized.
 assert.doesNotMatch(serializeMarketQuery(state),/strictness=/);
 assert.deepEqual(parseMarketQuery(serializeMarketQuery(state)),{...state,strictness:"balanced"});
});

test("round-trips a complex Sealed URL without persisting the strictness preference",()=>{
 const state=parseMarketQuery("?mode=sealed&market=onepiece&type=Booster+Boxes%7CCases&view=text&sort=profit&direction=asc&page=2&perPage=30&signal=sell&strictness=aggressive&q=display&sets=OP-01%7COP-02&marketMin=50&marketMax=500&msrpMin=30&profitMin=-10&profitPctMax=200&basis=median&keepPct=90&taxOn=1&taxRate=7.5&shipping=8&profitableOnly=1");
 assert.doesNotMatch(serializeMarketQuery(state),/strictness=/);
 assert.deepEqual(parseMarketQuery(serializeMarketQuery(state)),{...state,strictness:"balanced"});
});

test("round-trips the Favorites lens as shared URL state",()=>{
 const state=parseMarketQuery("?mode=singles&market=pokemon&favorites=1");
 assert.equal(state.favorites,true);
 assert.match(serializeMarketQuery(state),/favorites=1/);
 assert.deepEqual(parseMarketQuery(serializeMarketQuery(state)),state);
 assert.equal(parseMarketQuery("?mode=singles&market=pokemon").favorites,false);
 assert.doesNotMatch(serializeMarketQuery(parseMarketQuery("?mode=singles&market=pokemon")),/favorites=/);
});

test("normalizes legacy Magic and invalid values",()=>{
 const state=parseMarketQuery("?market=magic&rarity=all&view=unknown&page=-2&perPage=999");
 assert.equal(state.mode,"singles");assert.equal(state.market,"pokemon");assert.deepEqual(state.rarities,[]);assert.equal(state.view,"medium");assert.equal(state.page,1);assert.equal(state.perPage,20);
});

test("replaces initial state and skips duplicate state",()=>{
 const state=parseMarketQuery("?mode=singles&market=pokemon");
 assert.equal(getHistoryWriteMode(null,state),"replace");
 assert.equal(getHistoryWriteMode(state,{...state}),"skip");
});

test("replaces rapid search edits, including their page reset",()=>{
 const previous=parseMarketQuery("?mode=singles&market=pokemon&page=4&q=umbre");
 const next={...previous,page:1,query:"umbreon"};
 assert.equal(getHistoryWriteMode(previous,next),"replace");
});

test("pushes meaningful navigation and control changes",()=>{
 const previous=parseMarketQuery("?mode=singles&market=pokemon");
 assert.equal(getHistoryWriteMode(previous,{...previous,page:2}),"push");
 assert.equal(getHistoryWriteMode(previous,{...previous,view:"full"}),"push");
 assert.equal(getHistoryWriteMode(previous,{...previous,up7:true}),"push");
});
