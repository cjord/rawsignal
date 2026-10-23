import assert from 'node:assert/strict';
import test from 'node:test';
import {createPublicPayloadCache,timedPayload} from '../db/public-payload-cache.ts';

test('published payload cache coalesces work, separates DB/config/version and expires',async()=>{
 let signature='a',now=1,builds=0;const db={},other={},load=createPublicPayloadCache({clock:()=>now,version:async()=>({signature,busy:false}),ttlMs:10,maxEntries:2}),build=async()=>({n:++builds});
 const [first,second]=await Promise.all([load(db,'x',build),load(db,'x',build)]);assert.equal(first,second);assert.equal(builds,1);
 assert.equal(await load(db,'x',build),first);await load(other,'x',build);await load(db,'y',build);assert.equal(builds,3);
 signature='b';await load(db,'x',build);assert.equal(builds,4);now=20;await load(db,'x',build);assert.equal(builds,5);
 await load(db,'z',build);await load(db,'q',build);await load(db,'x',build);assert.equal(builds,8);
});
test('failed/null results retry and version changes cannot pin a mixed payload',async()=>{
 let signature='a',builds=0;const db={},load=createPublicPayloadCache({version:async()=>({signature,busy:false})});
 await assert.rejects(load(db,'x',async()=>{throw Error('failed')}),/failed/);assert.equal(await load(db,'x',async()=>++builds),1);
 assert.equal(await load(db,'null',async()=>null),null);assert.equal(await load(db,'null',async()=>++builds),2);
 await assert.rejects(load(db,'race',async()=>{signature='b';return 4}),/changed/);assert.equal(await load(db,'race',async()=>5),5);
});
test('active ingestion, missing metadata and metadata failure bypass reuse without poisoning fallback',async()=>{
 for(const state of [{signature:'a',busy:true},{signature:'',busy:false},null]){
  let n=0;const load=createPublicPayloadCache({version:async()=>{if(state===null)throw Error('offline');return state}}),db={};
  assert.equal(await load(db,'x',async()=>++n),1);assert.equal(await load(db,'x',async()=>++n),2);
 }
 assert.throws(()=>createPublicPayloadCache({maxEntries:0}),/limits/);
});
test('timing collection is caller-owned and records failed stages too',async()=>{
 const timings={stages:{}};assert.equal(await timedPayload(timings,'read',async()=>5),5);await assert.rejects(timedPayload(timings,'failed',async()=>{throw Error('offline')}));assert.ok(timings.stages.read>=0);assert.ok(timings.stages.failed>=0);
});
