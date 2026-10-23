import assert from 'node:assert/strict';
import test from 'node:test';
import {configureAccountStorage,setSavedItem,getSavedItem,cloudStatus,retryCloud,discardCloudPending} from '../app/account/storage.ts';
const idle=async()=>{for(let i=0;i<30&&cloudStatus().working;i++)await new Promise(resolve=>setImmediate(resolve));assert.equal(cloudStatus().working,false)};
test('tab recovery isolates owners, preserves revisions and never overwrites a conflicting cloud save',async()=>{
 const values=new Map(),original=globalThis.fetch;globalThis.sessionStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
 try{
  globalThis.fetch=async()=>{throw new Error('offline')};configureAccountStorage('account','a');setSavedItem('raw-signal-theme','light');await idle();assert.equal(cloudStatus().failure,'transient');assert.equal(values.size,1);
  configureAccountStorage('loading');configureAccountStorage('account','b');assert.equal(getSavedItem('raw-signal-theme'),null);assert.equal(cloudStatus().pending,0);
  configureAccountStorage('loading');configureAccountStorage('account','a');assert.equal(getSavedItem('raw-signal-theme'),'light');assert.equal(cloudStatus().failure,'recovered');
  let calls=0;globalThis.fetch=async()=>{calls++;return Response.json({document:{key:'raw-signal-theme',value:'light',revision:1,updatedAt:new Date().toISOString()}})};retryCloud();await idle();assert.equal(calls,1);assert.equal(values.size,0);
  globalThis.fetch=async()=>new Response('{}',{status:409});setSavedItem('raw-signal-theme','dark');await idle();assert.equal(cloudStatus().failure,'conflict');
  configureAccountStorage('loading');configureAccountStorage('account','a',[{key:'raw-signal-theme',value:'light',revision:2,updatedAt:new Date().toISOString()}]);assert.equal(cloudStatus().failure,'conflict');
  globalThis.fetch=async()=>{calls++;throw new Error('Must not retry')};retryCloud();await idle();assert.equal(calls,1);assert.equal(getSavedItem('raw-signal-theme'),'dark');discardCloudPending();assert.equal(values.size,0);
 }finally{configureAccountStorage('legacy');globalThis.fetch=original;delete globalThis.sessionStorage}
});
