import assert from "node:assert/strict";
import test from "node:test";
import {addFavorites,buylistTotals,favoriteKey,parseBuyStates,parseFavorites,toggleFavorite} from "../app/state/favorites.ts";

const entry=(productId,overrides={})=>({key:favoriteKey("single",productId),kind:"single",game:"pokemon",productId,name:`Card ${productId}`,set:"Fixture Set",number:`${productId}/100`,section:"illustration-rares",image:null,price:productId*10,addedAt:"2026-08-28T00:00:00Z",...overrides});

test("favorites toggle adds, removes, and bulk-adds without duplicates",()=>{
 const one=toggleFavorite([],entry(1));
 assert.equal(one.length,1);
 assert.equal(toggleFavorite(one,entry(1)).length,0);
 const bulk=addFavorites(one,[entry(1),entry(2),entry(2),entry(3)]);
 assert.deepEqual(bulk.map(item=>item.productId),[1,2,3]);
});

test("stored state parses tolerantly: bad JSON, wrong shapes, and junk rows drop out",()=>{
 assert.deepEqual(parseFavorites(null),[]);
 assert.deepEqual(parseFavorites("not json"),[]);
 assert.deepEqual(parseFavorites(JSON.stringify({a:1})),[]);
 assert.equal(parseFavorites(JSON.stringify([entry(1),{key:"x"},null,42])).length,1);
 assert.deepEqual(parseBuyStates("nope"),{});
 assert.deepEqual(parseBuyStates(JSON.stringify({a:null})),{});
 const states=parseBuyStates(JSON.stringify({"single:1":{acquired:1,paid:"12"},"single:2":{acquired:true,paid:9.5}}));
 assert.deepEqual(states["single:2"],{acquired:true,paid:9.5});
 assert.equal(states["single:1"].acquired,true);
 assert.equal(states["single:1"].paid,null);
});

test("the buy-list scoreboard totals market value, acquisitions, and money paid",()=>{
 const entries=[entry(1,{price:100}),entry(2,{price:50}),entry(3,{price:null})];
 const states={"single:1":{acquired:true,paid:80},"single:3":{acquired:true,paid:5}};
 assert.deepEqual(buylistTotals(entries,states),{count:3,acquired:2,marketTotal:150,acquiredMarket:100,paidTotal:85});
});
