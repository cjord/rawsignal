import assert from 'node:assert/strict';
import test from 'node:test';
import {npcBid,beginAuction,nextAuctionRound,lockBid} from '../core/domain/auction-engine.ts';
import {AUCTION_NPCS,auctionNpcSampleTarget} from '../core/domain/auction-npcs.ts';
import {auctionRandom,initialAuctionSave} from '../core/domain/auction-types.ts';

test('rivals usually bid, with occasional personality-specific passes rather than forced participation',()=>{
 let passes=0,total=0;
 for(let personality=0;personality<AUCTION_NPCS.length;personality++){
  let skipped=0;
  for(let seed=0;seed<1000;seed++)skipped+=Number(npcBid([],[50,50],[],personality,auctionRandom(seed),1000,1,0,10000,.3)===0);
  assert.ok(skipped>0&&skipped<130,`${AUCTION_NPCS[personality].name}: ${skipped}/1000 passes`);passes+=skipped;total+=1000;
 }
 assert.ok(passes/total<.06);
});

test('prior public interest sometimes nudges bids in either direction, stays bounded and ignores passes',()=>{
 for(let personality=0;personality<AUCTION_NPCS.length;personality++){
  let influenced=0,unchanged=0;
  for(let seed=0;seed<200;seed++){
   const bid=prior=>npcBid([],[50,50],prior,personality,auctionRandom(seed),1000,1,0,10000);
   const personal=bid([]),high=bid([250000,240000,1]),low=bid([1,2,250000]);
   assert.equal(bid([0,0]),personal);assert.equal(bid([NaN,-1,Infinity]),personal);
   if(!personal){assert.equal(high,0);continue}
   const limit=AUCTION_NPCS[personality].name==='The Follower'?.18:.12;
   assert.ok(high>=personal&&high<=Math.round(personal*(1+limit))+1);assert.ok(low<=personal&&low>=Math.round(personal*(1-limit))-1);
   if(high>personal)influenced++;else unchanged++;
  }
  assert.ok(influenced>15&&unchanged>15);
 }
});

test('weaker profiles receive broader private samples with extra paid-auction coverage',()=>{
 const weaker=['The Dealer','The Collector','The Opportunist','The Bargain Hunter','The Follower','The Skeptic'];
 for(const npc of AUCTION_NPCS)for(const kind of ['free','paid']){
  const expected=weaker.includes(npc.name)?kind==='paid'?[5,8,11,14]:[4,6,8,10]:[4,5,6,7];
  assert.deepEqual([1,2,3,4].map(round=>auctionNpcSampleTarget(npc.name,kind,round)),expected);
 }
});

test('social input comes from completed rival bids only, never current locked bids or private clues',()=>{
 const pool=Array.from({length:60},(_,i)=>({productId:i+1,printing:'Normal',name:`Card ${i}`,image:`https://images.example/${i}`,set:'Origins',rarity:'Common',section:'commons',cents:100}));
 let changed=0;
 for(let seed=0;seed<60;seed++){
  const save=beginAuction(initialAuctionSave(),pool,1000,pool,seed),auction=save.auction;
  assert.deepEqual(lockBid(save,1,1100).auction.npcs.map(n=>n.bid),lockBid(save,200000,1100).auction.npcs.map(n=>n.bid));
  const next=history=>nextAuctionRound({...save,auction:{...auction,stage:'reveal',bidHistory:[history]}},2000).auction.npcs.map(n=>n.bid);
  const history=['You',...auction.npcs.map(n=>n.name)].map(name=>({name,cents:1000}));
  assert.deepEqual(next(history),next(history.map(b=>({...b,notes:[{id:'top5',label:'Secret',text:'$999999'}]}))));
  const high=next(history.map(b=>({...b,cents:200000}))),low=next(history);
  changed+=Number(high.some((bid,i)=>bid!==low[i]));
 }
 assert.ok(changed>20);
});
