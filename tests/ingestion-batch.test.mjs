import assert from "node:assert/strict";
import test from "node:test";
import {clampBatchSize,markIngestionFailed,parseStatsJson,resumeCheckpoint} from "../db/ingestion-batch.ts";

// Shared plumbing for every checkpointed batch runner: size clamping, stats parsing, the
// resume-only-your-own-run rule, and the uniform failure tail.

test("clampBatchSize floors, bounds, and falls back for missing or non-finite requests",()=>{
 assert.equal(clampBatchSize(undefined,50,100),50);
 assert.equal(clampBatchSize(7.9,50,100),7);
 assert.equal(clampBatchSize(500,50,100),100);
 assert.equal(clampBatchSize(0,50,100),1);
 assert.equal(clampBatchSize(-3,50,100,5),5);
 assert.equal(clampBatchSize(Number.NaN,50,100),50);
 assert.equal(clampBatchSize(Number.POSITIVE_INFINITY,50,100),50);
});

test("parseStatsJson tolerates empty and malformed stats",()=>{
 assert.deepEqual(parseStatsJson('{"observationsWritten":3}'),{observationsWritten:3});
 assert.deepEqual(parseStatsJson(null),{});
 assert.deepEqual(parseStatsJson(undefined),{});
 assert.deepEqual(parseStatsJson(""),{});
 assert.deepEqual(parseStatsJson("{not json"),{});
});

const dbWithCheckpoint=row=>({prepare:()=>({bind:()=>({first:async()=>row})})});

test("resumeCheckpoint only resumes a cursor left by the same run",async()=>{
 assert.deepEqual(await resumeCheckpoint(dbWithCheckpoint({cursor:"12",ingestionRunId:"live-daily:2026-09-03",statsJson:'{"a":1}'}),"live-progress","live-daily:2026-09-03"),{resumed:true,cursor:"12",statsJson:'{"a":1}'});
 assert.deepEqual(await resumeCheckpoint(dbWithCheckpoint({cursor:"12",ingestionRunId:"live-daily:2026-09-02",statsJson:'{"a":1}'}),"live-progress","live-daily:2026-09-03"),{resumed:false,cursor:null,statsJson:null});
 assert.deepEqual(await resumeCheckpoint(dbWithCheckpoint(null),"live-progress","live-daily:2026-09-03"),{resumed:false,cursor:null,statsJson:null});
});

test("markIngestionFailed records the error message, or the fallback for non-Error throws",async()=>{
 const calls=[];
 const db={prepare:sql=>({bind:(...args)=>({run:async()=>{calls.push({sql,args})}})})};
 await markIngestionFailed(db,"run-1",new Error("boom"),"Unknown failure");
 await markIngestionFailed(db,"run-2","not an error","Unknown failure");
 assert.equal(calls.length,2);
 assert.match(calls[0].sql,/status='failed'/);
 assert.equal(calls[0].args[1],"boom");
 assert.equal(calls[0].args[2],"run-1");
 assert.equal(calls[1].args[1],"Unknown failure");
 assert.equal(calls[1].args[2],"run-2");
});
