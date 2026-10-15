import assert from 'node:assert/strict';
import test from 'node:test';
import {generateAuctionLot} from '../core/domain/auction-lots.ts';
import {beginAuction,lockBid,tickAuction,nextAuctionRound,npcBid} from '../core/domain/auction-engine.ts';
import {auctionRandom,initialAuctionSave} from '../core/domain/auction-types.ts';
import {AUCTION_NPCS,auctionNpcMood} from '../core/domain/auction-npcs.ts';
import {npcRoundInformation} from '../core/domain/auction-npc-information.ts';

const sections=['epics','alt-arts','overnumbered','signatures'];
const pool=sections.flatMap((section,tier)=>Array.from({length:40},(_,index)=>({productId:tier*40+index+1,printing:'Normal',name:`Card ${tier}-${index}`,image:`https://images.example/${tier}-${index}`,set:'Origins',rarity:'Epic',section,cents:100})));

test('free auctions modestly reduce overnumbers and more strongly reduce signatures without changing paid selection',()=>{
 const shares={};
 for(const kind of ['free','paid']){
  const counts=Object.fromEntries(sections.map(section=>[section,0]));let total=0;
  for(let seed=0;seed<500;seed++){
   const lot=generateAuctionLot(pool,seed,kind);total+=lot.length;
   for(const card of lot)counts[card.section]++;
   assert.deepEqual(lot,generateAuctionLot([...pool].reverse(),seed,kind));
  }
  shares[kind]=Object.fromEntries(sections.map(section=>[section,counts[section]/total]));
 }
 assert.ok(shares.free.overnumbered<shares.paid.overnumbered*.9);
 assert.ok(shares.free.signatures<shares.paid.signatures*.65);
 assert.ok(shares.free.overnumbered>.1&&shares.free.signatures>.05);
 for(const section of sections)assert.ok(shares.paid[section]>.22&&shares.paid[section]<.28);
});

test('chase-only remaining stock still completes affordable free lots rather than stalling or inventing cards',()=>{
 const limited=pool.filter(card=>card.section==='signatures');
 for(let seed=0;seed<50;seed++){const lot=generateAuctionLot(limited,seed);assert.ok(lot.length>=25&&lot.length<=90);assert.ok(lot.every(card=>limited.some(source=>source.productId===card.productId)))}
});

test('both modes boost personal-clue bids 15 percent only in round one, preserving random participation and cash caps',()=>{
 for(const kind of ['free','paid'])for(let seed=0;seed<20;seed++){
  let save=beginAuction(initialAuctionSave(),pool,1000,pool.slice(0,50),seed,kind),previous;
  for(let round=1;round<=3;round++){
   const auction=save.auction,random=auctionRandom(seed+round*103);
   auction.npcs.forEach((npc,index)=>{
    const knowledge=npcRoundInformation(auction,index,npc.sample,previous?.[index]),mood=auctionNpcMood(seed,npc.name),personality=AUCTION_NPCS.findIndex(profile=>profile.name===npc.name);
    const confidence=mood.confidence*(kind==='paid'?1.08:1)*(round===1?1.15:1);
    assert.equal(npc.bid,npcBid(knowledge.prices,auction.range,[],personality,random,auction.feeBps,confidence,mood.participation+(kind==='paid'?.04:0),knowledge.estimate));
    assert.equal(npc.lockAt,auction.deadline-60000+Math.round((.3+random()*.6)*60000));
    assert.ok(npc.bid>=0&&npc.bid<=250000);
   });
   previous=auction.npcs;
   save=lockBid(save,0,auction.deadline-1);
   save={...save,auction:{...save.auction,npcs:save.auction.npcs.map(npc=>({...npc,bid:0,locked:true}))}};
   save=tickAuction(save,auction.deadline);
   if(round<3)save=nextAuctionRound(save,auction.deadline+1);
  }
 }
});
