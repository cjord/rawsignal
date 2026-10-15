import assert from 'node:assert/strict';
import test from 'node:test';
import {beginAuction,lockBid,tickAuction,nextAuctionRound} from '../core/domain/auction-engine.ts';
import {initialAuctionSave} from '../core/domain/auction-types.ts';
import {parseAuctionSave} from '../core/domain/auction-save.ts';
import {publicAuctionSlots,auctionSampleValue} from '../core/domain/auction-public.ts';
import {INVESTIGATIONS,informationOffers,investigate,PREVIOUS_INVESTIGATION_COSTS} from '../core/domain/auction-information.ts';
import {orderedAuctionSlots} from '../core/domain/auction-display.ts';

const pool=['Common','Uncommon','Rare','Epic'].flatMap((rarity,tier)=>Array.from({length:20},(_,i)=>({productId:tier*20+i+1,printing:'Normal',name:`${rarity} ${i}`,image:`https://images.example/${tier}-${i}`,set:'Origins',rarity,section:tier===3?'epics':'rares',cents:100+50*i})));
test('each round shares 1–3 unique priced cards, carries them forward and persists without charging',()=>{
 let save=beginAuction(initialAuctionSave(),pool,1000,undefined,42);
 for(let round=1;round<=4;round++){
  const auction=save.auction,shared=auction.publicReveals.at(-1);assert.equal(shared.round,round);assert.ok(shared.slots.length>=1&&shared.slots.length<=3);
  assert.ok(publicAuctionSlots(auction).every(slot=>auction.known.includes(slot)&&auction.priced.includes(slot)));
  assert.equal(new Set(auction.publicReveals.flatMap(reveal=>reveal.slots)).size,auction.publicReveals.flatMap(reveal=>reveal.slots).length);
  assert.equal(save.wallet.cash,250000);assert.deepEqual(parseAuctionSave(JSON.stringify(save)),save);
  if(round===4)break;
  save=lockBid(save,0,auction.deadline-1);save={...save,auction:{...save.auction,npcs:save.auction.npcs.map(npc=>({...npc,bid:0,locked:true}))}};save=tickAuction(save,auction.deadline);save=nextAuctionRound(save,auction.deadline+1);
 }
 const invalid=structuredClone(save);invalid.auction.publicReveals[0].slots=[9999];assert.throws(()=>parseAuctionSave(JSON.stringify(invalid)));
});
test('rarity scans reveal only matching unpriced copies, and unavailable rarities are never offered',()=>{
 const auction=beginAuction(initialAuctionSave(),pool,1000,pool.slice(0,50),42).auction;
 for(const [id,rarity,max] of [['common3','Common',3],['uncommon3','Uncommon',3],['rare2','Rare',2]]){
  const option=INVESTIGATIONS.find(option=>option.id===id),result=investigate(auction,option),added=result.priced.filter(slot=>!auction.priced.includes(slot));
  assert.ok(added.length>0&&added.length<=max);assert.ok(added.every(slot=>auction.lot[slot].rarity===rarity));
  const exhausted={...auction,priced:auction.lot.map((_,i)=>i),known:auction.lot.map((_,i)=>i)};
  assert.ok(informationOffers(exhausted).every(offer=>offer.id!==id));
 }
 assert.ok(informationOffers(auction).every(offer=>!['epic2','alt1','chase1'].includes(offer.id)));
});
test('outliers are bounded by observed median, legacy prices load and final sorting preserves frozen indices',()=>{
 assert.ok(auctionSampleValue([100,100,100,100000])<10000);assert.ok(auctionSampleValue([100,100,100,100000])>100);assert.equal(auctionSampleValue([]),0);
 const save=beginAuction(initialAuctionSave(),pool,1000,undefined,42);save.auction.offers=INVESTIGATIONS.filter(option=>['appraisal','sets'].includes(option.id)).map(option=>({...option,cost:PREVIOUS_INVESTIGATION_COSTS[option.id]}));assert.deepEqual(parseAuctionSave(JSON.stringify(save)),save);
 const auction={...save.auction,stage:'result'},visible=auction.lot.map((_,i)=>i),ordered=orderedAuctionSlots(auction,visible);
 assert.ok(ordered.every((slot,i)=>i===0||auction.lot[ordered[i-1]].cents>=auction.lot[slot].cents));assert.deepEqual(visible,auction.lot.map((_,i)=>i));
});
