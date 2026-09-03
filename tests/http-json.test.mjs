import assert from "node:assert/strict";
import test from "node:test";
import {fetchJson,fetchText} from "../core/clients/http-json.ts";

// Characterization of the one shared HTTP retry policy (decision D8): bounded retries,
// linear backoff, optional throttle, and query-string scrubbing in the failure message.
const response=(status,body)=>({ok:status>=200&&status<300,status,statusText:status===200?"OK":"Server Error",json:async()=>body,text:async()=>String(body)});

test("returns parsed JSON on the first successful attempt without waiting",async()=>{
 const waits=[],calls=[];
 const value=await fetchJson("https://example.test/a?key=secret",{fetcher:async(url,init)=>{calls.push({url,init});return response(200,{ok:1})},wait:async ms=>{waits.push(ms)}});
 assert.deepEqual(value,{ok:1});
 assert.equal(calls.length,1);
 assert.equal(calls[0].url,"https://example.test/a?key=secret");
 assert.deepEqual(waits,[]);
});

test("retries with linear backoff and returns the first success",async()=>{
 let attempt=0;const waits=[];
 const value=await fetchJson("https://example.test/a",{retries:3,retryDelayMs:100,fetcher:async()=>{attempt++;return attempt<3?response(503,null):response(200,{attempt})},wait:async ms=>{waits.push(ms)}});
 assert.deepEqual(value,{attempt:3});
 assert.deepEqual(waits,[100,200]);
});

test("gives up after the retry budget and scrubs the query string from the error",async()=>{
 const waits=[];
 await assert.rejects(
  fetchJson("https://example.test/a?apikey=secret",{retries:2,retryDelayMs:50,fetcher:async()=>response(500,null),wait:async ms=>{waits.push(ms)}}),
  error=>{assert.equal(error.message,"Failed https://example.test/a: 500 Server Error");assert.doesNotMatch(error.message,/secret/);return true},
 );
 assert.deepEqual(waits,[50]);
});

test("throttles after each successful read and passes headers through",async()=>{
 const waits=[];let seen;
 const text=await fetchText("https://example.test/t",{throttleMs:250,headers:{"User-Agent":"test"},fetcher:async(_url,init)=>{seen=init.headers;return response(200,"hello")},wait:async ms=>{waits.push(ms)}});
 assert.equal(text,"hello");
 assert.deepEqual(seen,{"User-Agent":"test"});
 assert.deepEqual(waits,[250]);
});

test("a thrown fetch counts as a failed attempt and is retried",async()=>{
 let attempt=0;
 const value=await fetchJson("https://example.test/a",{retries:2,retryDelayMs:1,fetcher:async()=>{attempt++;if(attempt===1)throw new Error("socket hang up");return response(200,"ok")},wait:async()=>{}});
 assert.equal(value,"ok");
 assert.equal(attempt,2);
});
