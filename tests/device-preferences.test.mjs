import assert from "node:assert/strict";
import test from "node:test";
import {readStoredMarket,storeMarket} from "../app/state/market-memory.ts";
import {parseStrictness} from "../app/state/usePreference.ts";

// Device preferences live in localStorage, never the URL; every read and write must survive
// a missing or throwing storage (private mode, server render).
const withStorage=async(storage,run)=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,"localStorage");
 Object.defineProperty(globalThis,"localStorage",{value:storage,configurable:true,writable:true});
 try{await run()}finally{if(descriptor)Object.defineProperty(globalThis,"localStorage",descriptor);else delete globalThis.localStorage}
};
const memoryStorage=()=>{const store=new Map();return {store,getItem:key=>store.has(key)?store.get(key):null,setItem:(key,value)=>{store.set(key,String(value))}}};

test("readStoredMarket returns only known markets and never the scalping mode artifact",async()=>{
 const storage=memoryStorage();
 await withStorage(storage,async()=>{
  assert.equal(readStoredMarket(),null);
  storage.setItem("raw-signal-market","riftbound");
  assert.equal(readStoredMarket(),"riftbound");
  storage.setItem("raw-signal-market","scalping");
  assert.equal(readStoredMarket(),null);
 });
});

test("storeMarket writes known values, ignores unknown ones, and swallows storage failures",async()=>{
 const storage=memoryStorage();
 await withStorage(storage,async()=>{
  storeMarket("onepiece");
  assert.equal(storage.store.get("raw-signal-market"),"onepiece");
  storeMarket("scalping");
  assert.equal(storage.store.get("raw-signal-market"),"onepiece");
 });
 await withStorage({getItem(){throw new Error("denied")},setItem(){throw new Error("denied")}},async()=>{
  assert.doesNotThrow(()=>storeMarket("pokemon"));
  assert.equal(readStoredMarket(),null);
 });
});

test("parseStrictness only recognizes the two non-default presets",()=>{
 assert.equal(parseStrictness("conservative"),"conservative");
 assert.equal(parseStrictness("aggressive"),"aggressive");
 assert.equal(parseStrictness("balanced"),null);
 assert.equal(parseStrictness("anything"),null);
});
