import assert from 'node:assert/strict';
import test from 'node:test';
import {prepareAuctionLot} from '../app/data/auction-images.ts';
const pool=Array.from({length:100},(_,i)=>({productId:i+1,printing:'Normal',name:`Card ${i}`,image:`https://images.example/${i}`,set:'Origins',rarity:i<70?'Common':'Rare',section:'rares',cents:100+i}));
test('artwork failures beyond four draws are excluded automatically until a valid collection is built',async()=>{
 const failed=new Set(),valid=new Set();let active=0,peak=0,draws=0,loaded=false,rejected=false;
 const loader={failed:src=>{if(loaded){draws++;loaded=false;rejected=false}return failed.has(src)},exclude:src=>failed.add(src),load:async src=>{loaded=true;active++;peak=Math.max(peak,active);const reject=!rejected&&draws<6;if(reject)rejected=true;await new Promise(resolve=>setTimeout(resolve,1));active--;if(reject)return false;valid.add(src);return true}};
 const lot=await prepareAuctionLot(pool,loader,42);assert.ok(lot.length>=6);assert.ok(draws>=6);assert.ok(lot.every(card=>valid.has(card.image)&&!failed.has(card.image)));assert.ok(peak<=6);
});
test('artwork exhaustion and cancellation terminate safely instead of looping forever',async()=>{
 let calls=0;const excluded=new Set(),loader={failed:src=>excluded.has(src),exclude:src=>excluded.add(src),load:async()=>{calls++;return false}};
 assert.deepEqual(await prepareAuctionLot(pool,loader,42),[]);assert.ok(calls<=pool.length);
 const abort=new AbortController();abort.abort();const before=calls;assert.deepEqual(await prepareAuctionLot(pool,loader,42,'paid',abort.signal),[]);assert.equal(calls,before);
});
test('paid preparation rerolls failed URLs and retains its minimum, and free lots handle a small healthy pool',async()=>{
 const excluded=new Set(),loader={failed:src=>excluded.has(src),exclude:src=>excluded.add(src),load:async src=>{if(/\/(1|3|5)$/.test(src))return false;return true}};
 const lot=await prepareAuctionLot(pool,loader,42,'paid');assert.ok(lot.length>=128&&lot.length<=160);assert.ok(lot.every(card=>!excluded.has(card.image)));
 const small=await prepareAuctionLot(pool.slice(0,6),loader,42);assert.equal(small.length,0); // three failed sources cannot supply six distinct eligible cards
 const healthy={failed:()=>false,exclude:()=>{},load:async()=>true};assert.ok((await prepareAuctionLot(pool.slice(0,6),healthy,42)).length>=6);
});
