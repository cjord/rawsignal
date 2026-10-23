import assert from 'node:assert/strict';
import test from 'node:test';
import {createBackdropArtwork,loadBackdropImage} from '../app/data/auction-backdrop-artwork.ts';

const flush=()=>new Promise(resolve=>setImmediate(resolve));
const pool=Array.from({length:40},(_,i)=>`https://art.example/${i}.jpg`);
function controlled(){const calls=[];return {calls,loader:(source,signal)=>new Promise(resolve=>calls.push({source,signal,resolve}))}}

test('shared artwork decodes at most four sources concurrently and publishes only resolved sources',async()=>{
 const fake=controlled(),store=createBackdropArtwork(pool,fake.loader);store.activate(Array.from({length:18},(_,i)=>i));store.start();await flush();
 assert.equal(fake.calls.length,4);assert.ok(store.getSnapshot().every(src=>src===null));
 fake.calls[0].resolve('decoded:0');await flush();assert.equal(fake.calls.length,5);assert.equal(store.getSnapshot()[0],'decoded:0');assert.equal(store.getSnapshot()[1],null);store.stop();
 assert.ok(fake.calls.every(call=>call.signal.aborted));
});

test('a failed source replaces only its fixed logical slots, not healthy cards',async()=>{
 const calls=[],store=createBackdropArtwork(pool,async source=>{calls.push(source);return source});store.activate(Array.from({length:18},(_,i)=>i));store.start();await flush();
 const original=[...store.getSnapshot()];assert.equal(calls.length,18);assert.deepEqual(original,pool.slice(0,18));
 store.reject(0,original[0]);store.reject(0,original[0]);await flush();
 assert.equal(store.getSnapshot()[0],pool[18]);assert.deepEqual(store.getSnapshot().slice(1),original.slice(1));assert.equal(calls.length,19);store.stop();
});

test('duplicate slots share one fallback and small catalogs reuse healthy artwork',async()=>{
 const fake=controlled(),store=createBackdropArtwork(pool.slice(0,2),fake.loader);store.activate([0,1,2,3]);store.start();await flush();assert.equal(fake.calls.length,2);
 fake.calls[0].resolve(null);fake.calls[1].resolve('decoded:1');await flush();assert.ok(store.getSnapshot().every(src=>src==='decoded:1'));assert.equal(fake.calls.length,2);store.stop();
});

test('only visible logical slots load; stop ignores stale results and supports StrictMode restart',async()=>{
 const fake=controlled(),store=createBackdropArtwork(pool,fake.loader);store.activate([2,2,-1,18]);store.start();await flush();assert.deepEqual(fake.calls.map(call=>call.source),[pool[2]]);
 store.stop();store.start();await flush();assert.equal(fake.calls.length,2);assert.equal(fake.calls[0].signal.aborted,true);assert.equal(fake.calls[1].signal.aborted,false);
 fake.calls[0].resolve('stale');await flush();assert.equal(store.getSnapshot()[2],null);fake.calls[1].resolve('fresh');await flush();assert.equal(store.getSnapshot()[2],'fresh');store.stop();
});

test('complete failure is bounded to the reserve pool and empty catalogs stay empty',async()=>{
 let count=0;const store=createBackdropArtwork(pool,async()=>{count++;return null});store.activate([0,1,2]);store.start();await flush();assert.ok(count<=36);assert.ok(store.getSnapshot().every(src=>src===null));store.stop();
 const empty=createBackdropArtwork([],async()=>{throw Error('must not load')});empty.activate([0]);empty.start();await flush();assert.ok(empty.getSnapshot().every(src=>src===null));empty.stop();
});

test('shared image loader decodes a thumbnail before publishing and tries the original after failure',async t=>{
 const original=globalThis.Image,calls=[];let release;
 globalThis.Image=class {
  naturalWidth=200;naturalHeight=280;fetchPriority='';decoding='';
  set src(value){this.source=value;calls.push(value);queueMicrotask(()=>value.endsWith('_200w.jpg')?this.onerror?.():this.onload?.())}
  get src(){return this.source}
  decode(){return new Promise(resolve=>release=resolve)}removeAttribute(){}
 };
 t.after(()=>{globalThis.Image=original});
 const source='https://tcgplayer-cdn.tcgplayer.com/product/42_in_1000x1000.jpg',pending=loadBackdropImage(source,new AbortController().signal);let settled=false;void pending.then(()=>settled=true);await flush();
 assert.equal(settled,false);assert.deepEqual(calls,['https://tcgplayer-cdn.tcgplayer.com/product/42_200w.jpg',source]);release();assert.equal(await pending,source);
});

test('the legacy non-CDN missing-art sentinel is still rejected',async t=>{
 const original=globalThis.Image;
 globalThis.Image=class {
  naturalWidth=400;naturalHeight=570;
  set src(value){this.source=value;queueMicrotask(()=>this.onload?.())}get src(){return this.source}
  async decode(){}removeAttribute(){}
 };
 t.after(()=>{globalThis.Image=original});assert.equal(await loadBackdropImage('https://art.example/missing.jpg',new AbortController().signal),null);
});
