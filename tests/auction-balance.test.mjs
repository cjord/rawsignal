import assert from 'node:assert/strict';
import test from 'node:test';
import {generateAuctionLot} from '../core/domain/auction-lots.ts';
import {beginAuction,lockBid,tickAuction,nextAuctionRound,npcBid} from '../core/domain/auction-engine.ts';
import {auctionRandom,initialAuctionSave} from '../core/domain/auction-types.ts';
import {AUCTION_NPCS,auctionNpcMood} from '../core/domain/auction-npcs.ts';
import {npcRoundInformation} from '../core/domain/auction-npc-information.ts';
import {AUCTION_RARITY_TARGETS} from '../core/domain/auction-composition.ts';

const sections=['epics','alt-arts','overnumbered','signatures'];
const pool=sections.flatMap((section,tier)=>Array.from({length:40},(_,index)=>({productId:tier*40+index+1,printing:'Normal',name:`Card ${tier}-${index}`,image:`https://images.example/${tier}-${index}`,set:'Origins',rarity:'Epic',section,cents:100})));

test('premium-only catalogs renormalize the requested mix rather than inventing bulk stock',()=>{
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
 for(const kind of ['free','paid']){
  const target=AUCTION_RARITY_TARGETS[kind],total=target.epic+target.alt+target.over+target.signature;
  for(const [section,band] of [['epics','epic'],['alt-arts','alt'],['overnumbered','over'],['signatures','signature']])assert.ok(Math.abs(shares[kind][section]-target[band]/total)<.01,`${kind} ${band}`);
 }
});

test('chase-only remaining stock still completes free lots rather than stalling or inventing cards',()=>{
 const limited=pool.filter(card=>card.section==='signatures');
 for(let seed=0;seed<50;seed++){const lot=generateAuctionLot(limited,seed);assert.ok(lot.length>=25&&lot.length<=90);assert.ok(lot.every(card=>limited.some(source=>source.productId===card.productId)))}
});

test('both modes price personal clues without blanket bid boosts, preserving seeded participation and safe cent bids',()=>{
 for(const kind of ['free','paid'])for(let seed=0;seed<20;seed++){
  let save=beginAuction(initialAuctionSave(),pool,1000,pool.slice(0,50),seed,kind),previous;
  for(let round=1;round<=3;round++){
   const auction=save.auction,random=auctionRandom(seed+round*103);
   auction.npcs.forEach((npc,index)=>{
    const knowledge=npcRoundInformation(auction,index,npc.sample,previous?.[index]),mood=auctionNpcMood(seed,npc.name),personality=AUCTION_NPCS.findIndex(profile=>profile.name===npc.name);
    assert.equal(npc.bid,npcBid(knowledge.prices,auction.range,[],personality,random,auction.feeBps,mood.confidence,mood.participation+(kind==='paid'?.04:0),knowledge.estimate,knowledge.certainty,round));
    assert.equal(npc.lockAt,auction.deadline-60000+Math.round((.3+random()*.6)*60000));
    assert.ok(Number.isSafeInteger(npc.bid)&&npc.bid>=0);
   });
   previous=auction.npcs;
   save=lockBid(save,0,auction.deadline-1);
   save={...save,auction:{...save.auction,npcs:save.auction.npcs.map(npc=>({...npc,bid:0,locked:true}))}};
   save=tickAuction(save,auction.deadline);
   if(round<3)save=nextAuctionRound(save,auction.deadline+1);
  }
 }
});
