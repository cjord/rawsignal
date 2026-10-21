import assert from 'node:assert/strict';
import test from 'node:test';
import {requestJson,JsonRequestTimeout} from '../app/data/request-json.ts';
import {configureAccountStorage,setSavedItem,getSavedItem,cloudStatus,retryCloud,pendingBackup} from '../app/account/storage.ts';
import {meteredReads} from '../db/read-meter.ts';
import {benchmarkOptions,benchmarkReport,summarize} from '../scripts/performance/auction-benchmark.mjs';
import {communityQuery} from '../core/domain/auction-community.ts';

test('JSON deadlines cover stalled headers and bodies without inventing successful data',async()=>{
 for(const fetcher of [()=>new Promise(()=>{}),async()=>({ok:true,json:()=>new Promise(()=>{})})])await assert.rejects(()=>requestJson('/test',{}, {fetcher,timeoutMs:5}),JsonRequestTimeout);
 const headers=new Headers({'retry-after':'30'});const {response,data}=await requestJson('/test',{}, {fetcher:async()=>new Response('not JSON',{status:429,headers}),timeoutMs:100});assert.equal(response.status,429);assert.equal(response.headers.get('retry-after'),'30');assert.equal(data,null);
 await assert.rejects(()=>requestJson('/test',{}, {fetcher:async()=>new Response('not JSON'),timeoutMs:100}),SyntaxError);
});
const turn=()=>new Promise(resolve=>setImmediate(resolve));
async function idle(){for(let i=0;i<30&&cloudStatus().working;i++)await turn();assert.equal(cloudStatus().working,false)}
function memorySession(){const map=new Map();return {getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)}}
test('a late old-owner response body never enters the next account or clears its drafts',async()=>{
 const original=globalThis.fetch;globalThis.sessionStorage=memorySession();let release,headersReady;const headers=new Promise(resolve=>headersReady=resolve),body=new Promise(resolve=>release=resolve);
 try{
  globalThis.fetch=async()=>{headersReady();return {ok:true,status:200,json:()=>body}};configureAccountStorage('account','old-owner');setSavedItem('raw-signal-theme','light');await headers;
  configureAccountStorage('account','new-owner',[{key:'raw-signal-theme',value:'dark',revision:9,updatedAt:new Date().toISOString()}]);
  release({document:{key:'raw-signal-theme',value:'light',revision:1,updatedAt:new Date().toISOString()}});for(let i=0;i<5;i++)await turn();assert.equal(getSavedItem('raw-signal-theme'),'dark');assert.equal(cloudStatus().pending,0);
 }finally{configureAccountStorage('legacy');globalThis.fetch=original;delete globalThis.sessionStorage}
});
test('invalid save acknowledgement preserves pending progress and refuses blind retries',async()=>{
 const original=globalThis.fetch;globalThis.sessionStorage=memorySession();
 try{for(const [index,patch] of [{revision:0},{revision:100},{updatedAt:'invalid'},{key:'raw-signal-auction-sound'}].entries()){
  let writes=0;globalThis.fetch=async()=>{writes++;return Response.json({document:{key:'raw-signal-theme',value:'light',revision:1,updatedAt:new Date().toISOString(),...patch}})};configureAccountStorage('account','bad-ack-'+index);setSavedItem('raw-signal-theme','light');await idle();assert.equal(cloudStatus().pending,1);assert.equal(cloudStatus().failure,'invalid');assert.match(pendingBackup(),/light/);retryCloud();await idle();assert.equal(writes,1);
 }}finally{configureAccountStorage('legacy');globalThis.fetch=original;delete globalThis.sessionStorage}
});
test('read cost measurement retains the same query count, rejects writes and marks missing metadata unknown',async()=>{
 let calls=0;const statement={bind(){return this},all:async()=>{calls++;return {results:[{n:1}],meta:{rows_read:20,rows_written:0,duration:2}}}};
 const meter=meteredReads({prepare:()=>statement});assert.deepEqual(await meter.db.prepare('select').first(),{n:1});await meter.db.prepare('select').bind(1).all();assert.equal(calls,2);assert.deepEqual(meter.summary(),{statements:2,rowsRead:40,rowsWritten:0,sqlMs:4});await assert.rejects(()=>meter.db.prepare('select').run(),/does not permit writes/);await assert.rejects(()=>meter.db.batch([]),/does not permit batches/);
 const unknown=meteredReads({prepare:()=>({all:async()=>({results:[]})})});await unknown.db.prepare('select').all();assert.equal(unknown.summary().rowsRead,null);
});
test('benchmark summaries distinguish samples, phases and unknown database costs; production targets are rejected',()=>{
 assert.deepEqual(summarize([1,5,3,7]),{samples:4,median:4,p95:null,min:1,max:7});assert.equal(summarize(Array.from({length:20},(_,i)=>i)).p95,18);assert.equal(summarize([]).median,null);assert.equal(benchmarkOptions([]).samples,3);for(const args of [['--base-url','https://rawsignal.cards'],['--samples','999'],['--base-url','https://localhost@evil.test']])assert.throws(()=>benchmarkOptions(args));
 const report=benchmarkReport([{route:'/play',phase:'cold',readyMs:10,catalogRequests:2,unexpectedLayoutShift:null,d1RowsRead:null}],{baseUrl:'http://localhost:4173',samples:1});assert.equal(report.groups[0].unexpectedLayoutShift.samples,0);assert.equal(report.samples[0].d1RowsRead,null);assert.match(report.conditions.layoutShift,/not full-session/);
});
test('community query shape and size are bounded before any catalog read',()=>{
 assert.deepEqual(communityQuery(new URLSearchParams()),{view:'leaderboard',cursor:null});for(const query of ['view=profile','view=showcases&view=leaderboard','unknown=1','cursor=','cursor='+('a'.repeat(513))])assert.equal(communityQuery(new URLSearchParams(query)),null);
});
test('save throttling keeps the draft and respects Retry-After before a manual retry',async()=>{
 const original=globalThis.fetch,realNow=Date.now;let now=realNow(),writes=0;globalThis.sessionStorage=memorySession();Date.now=()=>now;
 try{globalThis.fetch=async()=>{writes++;return writes===1?Response.json({error:'Limited'},{status:429,headers:{'Retry-After':'60'}}):Response.json({document:{key:'raw-signal-theme',value:'light',revision:1,updatedAt:new Date().toISOString()}})};configureAccountStorage('account','limited-owner');setSavedItem('raw-signal-theme','light');await idle();assert.equal(cloudStatus().pending,1);assert.match(cloudStatus().error,/Wait 60 seconds/);retryCloud();await idle();assert.equal(writes,1);now+=60001;retryCloud();await idle();assert.equal(writes,2);assert.equal(cloudStatus().pending,0);
 }finally{configureAccountStorage('legacy');globalThis.fetch=original;Date.now=realNow;delete globalThis.sessionStorage}
});
