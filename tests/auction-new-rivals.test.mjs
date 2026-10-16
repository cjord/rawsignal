import assert from 'node:assert/strict';
import test from 'node:test';
import {AUCTION_NPCS,AUCTION_RARE_GUEST_CHANCE,auctionNpcRoster,auctionNpcAmbition} from '../core/domain/auction-npcs.ts';
import {npcBid,beginAuction,nextAuctionRound,lockBid} from '../core/domain/auction-engine.ts';
import {auctionRandom,initialAuctionSave} from '../core/domain/auction-types.ts';
import {auctionGuideTargets} from '../core/domain/auction-guide.ts';
import {AUCTION_PROMO_TARGETS} from '../core/domain/auction-composition.ts';

test('the rare wealthy guest appears about 8% of auctions, alongside two distinct ordinary rivals',()=>{
 let appearances=0;const counts=new Map();
 for(let seed=0;seed<10000;seed++){
  const roster=auctionNpcRoster(seed),names=roster.map(n=>n.name);
  assert.equal(new Set(names).size,3);assert.deepEqual(roster,auctionNpcRoster(seed));
  appearances+=Number(names.includes('The Trust Fund Kid'));
  for(const name of names)counts.set(name,(counts.get(name)??0)+1);
 }
 assert.ok(Math.abs(appearances/10000-AUCTION_RARE_GUEST_CHANCE)<.015);
 for(const npc of AUCTION_NPCS)if(npc.name!=='The Trust Fund Kid')assert.ok(counts.get(npc.name)>2200);
});
test('new rivals have distinct round behavior, still use fee-adjusted estimates and have no dollar ceiling',()=>{
 assert.equal(auctionNpcAmbition('The Trust Fund Kid',1,()=>0),1.35);
 assert.equal(auctionNpcAmbition('The Trust Fund Kid',4,()=>1),1.8);
 assert.ok(auctionNpcAmbition('The Closer',1,()=>.5)<auctionNpcAmbition('The Closer',4,()=>.5));
 const index=name=>AUCTION_NPCS.findIndex(npc=>npc.name===name);
 const bid=(name,round,fee=1000)=>npcBid([],[50,50],[],index(name),()=>.5,fee,1,0,100000,1,round);
 assert.ok(bid('The Trust Fund Kid',1)>90000);assert.ok(bid('The Closer',1)<90000);assert.ok(bid('The Closer',4)>90000);
 assert.ok(bid('The Trust Fund Kid',1,2000)<bid('The Trust Fund Kid',1));
 assert.ok(npcBid([],[50,50],[],index('The Trust Fund Kid'),()=>.5,1000,1,0,10000000,1,1)>10000000);
});
test('new profiles never read current sealed bids and preserve their roster into subsequent rounds',()=>{
 const pool=Array.from({length:60},(_,i)=>({productId:i+1,printing:'Normal',name:`Card ${i}`,image:'https://images.example/1',set:'Origins',section:'commons',rarity:'Common',cents:100}));
 for(const name of ['The Closer','The Trust Fund Kid']){
  let save;for(let seed=0;seed<300;seed++){const candidate=beginAuction(initialAuctionSave(),pool,1000,pool,seed);if(candidate.auction.npcs.some(n=>n.name===name)){save=candidate;break}}
  assert.ok(save);const bids=save.auction.npcs.map(n=>n.bid);
  assert.deepEqual(lockBid(save,1,1100).auction.npcs.map(n=>n.bid),bids);assert.deepEqual(lockBid(save,200000,1100).auction.npcs.map(n=>n.bid),bids);
  const next=nextAuctionRound({...save,auction:{...save.auction,stage:'reveal'}},2000);
  assert.deepEqual(next.auction.npcs.map(n=>n.name),save.auction.npcs.map(n=>n.name));
  assert.ok(Number.isSafeInteger(npcBid([],[50,50],[],indexOf(name),auctionRandom(42),1000,1,0,50000,1,4)));
 }
});
const indexOf=name=>AUCTION_NPCS.findIndex(n=>n.name===name);
test('guide admission rates are disjoint, sum to 100%, and use the same promo budgets',()=>{
 for(const kind of ['free','paid']){
  const targets=auctionGuideTargets(kind);assert.ok(Math.abs(Object.values(targets).reduce((s,n)=>s+n,0)-1)<1e-12);
  assert.ok(Object.values(targets).every(n=>n>=0));assert.equal(targets.metal,AUCTION_PROMO_TARGETS[kind].metal);assert.equal(targets['ultra-promo'],AUCTION_PROMO_TARGETS[kind]['ultra-promo']);
 }
});
