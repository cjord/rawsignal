import assert from "node:assert/strict";
import test from "node:test";
import {buildCatalogDerived,nextSortDirection,signalAwareSorts} from "../app/leaderboard/mode-adapter.ts";

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
