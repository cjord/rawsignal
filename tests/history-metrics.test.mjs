import assert from "node:assert/strict";
import test from "node:test";
import {deriveHistoryMetrics,normalizePricePoints} from "../app/domain/history-metrics.ts";
import {loadPriceHistoryBatch} from "../app/data/usePriceHistoryBatch.ts";

const points=[
 {date:"2026-08-25",price:80},
 {date:"2026-05-01",price:30},
 {date:"2026-07-26",price:50},
 {date:"2026-05-27",price:40},
 {date:"2026-08-18",price:100},
];

test("derives exact cutoff changes and extrema from normalized dated history",()=>{
 assert.deepEqual(normalizePricePoints(points).map(point=>point.date),["2026-05-01","2026-05-27","2026-07-26","2026-08-18","2026-08-25"]);
 assert.deepEqual(deriveHistoryMetrics(points),{change7:-20,change30:60,change90:100,low30:50,high30:100,historyLow:30,historyHigh:100});
});

test("reports unavailable changes when no observation reaches a cutoff",()=>{
 assert.deepEqual(deriveHistoryMetrics([{date:"2026-08-24",price:9},{date:"2026-08-25",price:10}]),{change7:null,change30:null,change90:null,low30:9,high30:10,historyLow:9,historyHigh:10});
});

test("aborting an obsolete history batch prevents it from completing",async()=>{
 const controller=new AbortController(),fetcher=async(_url,init)=>new Promise((_resolve,reject)=>init.signal.addEventListener("abort",()=>reject(new DOMException("Request aborted","AbortError")),{once:true}));
 const pending=loadPriceHistoryBatch([{productId:1,printing:"Holofoil"}],controller.signal,fetcher);
 controller.abort();
 await assert.rejects(pending,error=>error?.name==="AbortError");
});
