import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {buildCatalogDerived,historyFromMetrics,nextSortDirection,selectionChips,signalAwareSorts,signalResolver} from "../app/leaderboard/mode-adapter.ts";

test("feed metrics stand in for a row's history until one loads; a loaded history still wins",()=>{
 const metrics={change7:1.5,change30:-3.2,low30:35,high30:44,regime:"steady"};
 const items=[{productId:1,metrics},{productId:2,metrics},{productId:3}];
 const history={2:{points:[],change7:9,change30:9,low30:1,high30:2}};
 const derived=buildCatalogDerived(items,history,{ready:false,derived:{}},()=>null);
 assert.deepEqual(derived[1],{change7:1.5,change30:-3.2,low30:35,high30:44,regime:"steady",signal:null});
 assert.equal(derived[2].change7,9,"a loaded history is preferred over the feed metrics");
 assert.deepEqual(derived[3],{change7:null,change30:null,low30:null,high30:null,regime:null,signal:null});
 // Persisted coverage ignores both, as before.
 assert.equal(buildCatalogDerived(items,history,{ready:true,derived:{}},()=>null)[1].change7,null);
 assert.deepEqual(historyFromMetrics(items[0]),{points:[],coverage:"none",change7:1.5,change30:-3.2,change90:null,low30:35,high30:44,historyLow:null,historyHigh:null});
 assert.equal(historyFromMetrics(items[2]),undefined);
});

test("shared mode adapter derives history and honors persisted coverage",()=>{
 const items=[{productId:1},{productId:2}],history={1:{change7:1,change30:2,low30:3,high30:4}};
 const fallback=buildCatalogDerived(items,history,{ready:false,derived:{}},item=>item.productId===2?{side:"buy",score:80,confidence:"medium",reason:"Low",detail:"Near low",distance:1,cutoff:2}:null);
 assert.deepEqual(fallback[1],{change7:1,change30:2,low30:3,high30:4,regime:null,signal:null});
 assert.equal(fallback[2].signal?.side,"buy");
 const persisted={change7:-4,change30:-8,low30:10,high30:20,signal:null};
 assert.equal(buildCatalogDerived(items,{}, {ready:true,derived:{1:persisted}},()=>null)[1],persisted);
});

test("shared mode adapter inserts signal sorting and applies stable direction defaults",()=>{
 const sorts=[{label:"Card",key:"name"},{label:"Market",key:"market"}],signal={label:"Signal",key:"signal"};
 assert.deepEqual(signalAwareSorts(sorts,signal,"buy").map(item=>item.key),["name","signal","market"]);
 assert.equal(signalAwareSorts(sorts,signal,"leaderboard"),sorts);
 assert.equal(nextSortDirection("market","desc","market",new Set(["name"])),"asc");
 assert.equal(nextSortDirection("market","asc","name",new Set(["name"])),"asc");
 assert.equal(nextSortDirection("name","asc","market",new Set(["name"])),"desc");
});

test("selection chips clear one value at a time and label through the mapper",()=>{
 const updates=[];
 const chips=selectionChips("regime",["falling","steady"],next=>updates.push(next),value=>value.toUpperCase());
 assert.deepEqual(chips.map(({key,label})=>({key,label})),[{key:"regime:falling",label:"FALLING"},{key:"regime:steady",label:"STEADY"}]);
 chips[0].clear();
 assert.deepEqual(updates,[["steady"]]);
 assert.deepEqual(selectionChips("set",["Base Set"],()=>{}).map(chip=>chip.label),["Base Set"]);
 assert.deepEqual(selectionChips("set",[],()=>{}),[]);
});

test("the shared signal resolver prefers persisted signals and falls back to a live evaluation at the item's price",()=>{
 // The "bounce" characterization fixture yields a buy at balanced/aggressive when priced at its last point.
 const points=JSON.parse(readFileSync(new URL("./fixtures/signal-cases.json",import.meta.url),"utf8")).fixtures.bounce;
 const history={7:{points,change7:null,change30:null,low30:null,high30:null}};
 const persistedSignal={side:"buy",score:90,confidence:"high",reason:"Persisted",detail:"",distance:0,cutoff:1};
 // Leaderboard view: never a signal, whatever the stores hold.
 assert.equal(signalResolver("leaderboard","balanced",{ready:true,derived:{7:{signal:persistedSignal}}},history,()=>points.at(-1).price)({productId:7}),null);
 // Persisted store ready: its signal wins, missing rows are null.
 assert.equal(signalResolver("buy","balanced",{ready:true,derived:{7:{signal:persistedSignal}}},history,()=>12)({productId:7}),persistedSignal);
 assert.equal(signalResolver("buy","balanced",{ready:true,derived:{}},history,()=>12)({productId:7}),null);
 // Not ready: evaluate the fetched history at the caller-supplied price; no history → null.
 const live=signalResolver("buy","aggressive",{ready:false,derived:{}},history,item=>item.price)({productId:7,price:points.at(-1).price});
 assert.equal(live?.side,"buy");
 assert.equal(signalResolver("buy","aggressive",{ready:false,derived:{}},{},()=>12)({productId:8}),null);
});
