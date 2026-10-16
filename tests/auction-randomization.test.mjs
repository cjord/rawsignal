import assert from 'node:assert/strict';
import test from 'node:test';
import {generateAuctionLot,auctionLotProfile,AUCTION_LOT_PROFILES} from '../core/domain/auction-lots.ts';
import {AUCTION_NPCS,auctionNpcRoster} from '../core/domain/auction-npcs.ts';
import {beginAuction,npcBid,tickAuction,nextAuctionRound,lockBid} from '../core/domain/auction-engine.ts';
import {initialAuctionSave,holdingKey} from '../core/domain/auction-types.ts';
import {parseAuctionSave} from '../core/domain/auction-save.ts';
const pool=Array.from({length:150},(_,i)=>({productId:i+1,printing:i%2?'Normal':'Foil',name:`Card ${i}`,image:`https://image.example/${i}`,set:'Origins',rarity:i<100?'Common':i<130?'Rare':'Epic',section:'rares',cents:(i+1)*10}));
test('seeded lots vary profiles, counts, contents and copies but stay reproducible and source-faithful',()=>{
 const profiles=new Set(),contents=new Set(),counts=new Set();
 for(let seed=0;seed<100;seed++){
  const lot=generateAuctionLot(pool,seed),profile=auctionLotProfile(seed);profiles.add(profile.name);counts.add(lot.length);contents.add(lot.map(holdingKey).join(','));
  assert.deepEqual(lot,generateAuctionLot([...pool].reverse(),seed));assert.ok(lot.length>=profile.min&&lot.length<=profile.max);
  const copies=new Map();for(const card of lot){assert.deepEqual(card,pool.find(source=>holdingKey(source)===holdingKey(card)));copies.set(holdingKey(card),(copies.get(holdingKey(card))??0)+1)}
  assert.ok([...copies.values()].every(count=>count<=profile.copyCap));
 }
 assert.equal(profiles.size,AUCTION_LOT_PROFILES.length);assert.ok(counts.size>10);assert.equal(contents.size,100);
 assert.deepEqual(generateAuctionLot(pool.slice(0,5),1),[]);assert.ok(generateAuctionLot([...pool,{...pool[0],productId:999,image:''}],1).every(card=>card.productId!==999));
});
test('rosters choose three distinct personalities and remain stable across rounds and saves',()=>{
 const seen=new Set();for(let seed=0;seed<100;seed++){const roster=auctionNpcRoster(seed);assert.equal(new Set(roster.map(npc=>npc.name)).size,3);roster.forEach(npc=>seen.add(npc.name));assert.deepEqual(roster,auctionNpcRoster(seed))}
 assert.equal(seen.size,AUCTION_NPCS.length);
 let save=beginAuction(initialAuctionSave(),pool,1000,undefined,23);const roster=save.auction.npcs.map(npc=>npc.name);
 save={...save,auction:{...save.auction,npcs:save.auction.npcs.map(npc=>({...npc,bid:0}))}};save=tickAuction(save,save.auction.deadline+1);save=nextAuctionRound(save,100000);
 assert.deepEqual(save.auction.npcs.map(npc=>npc.name),roster);assert.deepEqual(parseAuctionSave(JSON.stringify(save)),save);
});
test('NPCs use fee-aware samples, never respond to the current sealed player bid, and legacy saves survive',()=>{
 assert.equal(npcBid([1000,2000],[40,40],[],0,()=>.5,10000),0);
 assert.ok(npcBid([1000,2000],[40,40],[],0,()=>.5,2000)<npcBid([1000,2000],[40,40],[],0,()=>.5,0));
 const save=beginAuction(initialAuctionSave(),pool,1000,undefined,42),bids=save.auction.npcs.map(npc=>npc.bid);
 assert.deepEqual(lockBid(save,1,1100).auction.npcs.map(npc=>npc.bid),bids);assert.deepEqual(lockBid(save,250000,1100).auction.npcs.map(npc=>npc.bid),bids);
 const legacy={...save,auction:{...save.auction,npcs:save.auction.npcs.map((npc,index)=>({...npc,name:AUCTION_NPCS[index].name}))}};assert.deepEqual(parseAuctionSave(JSON.stringify(legacy)),legacy);
});
