import assert from 'node:assert/strict';
import test from 'node:test';
import {AUCTION_RARITY_TARGETS,auctionRarityWeights} from '../core/domain/auction-composition.ts';
import {generateAuctionLot} from '../core/domain/auction-lots.ts';
import {auctionRarityBand} from '../core/domain/auction-copy-policy.ts';
import {auctionLotTheme,AUCTION_LOT_THEMES} from '../core/domain/auction-lot-themes.ts';
import {initialAuctionSave} from '../core/domain/auction-types.ts';
import {beginAuction,tickAuction,finishAuction,sellInventory} from '../core/domain/auction-engine.ts';
import {parseAuctionSave} from '../core/domain/auction-save.ts';

const groups=[['Common','commons'],['Uncommon','uncommons'],['Rare','rares'],['Epic','epics'],['Epic','alt-arts'],['Epic','overnumbered'],['Epic','signatures'],['Legend','legends']];
const pool=groups.flatMap(([rarity,section],group)=>Array.from({length:60},(_,index)=>({productId:group*60+index+1,printing:'Normal',name:`Card ${group}-${index}`,image:`https://images.example/${group}-${index}`,set:'Origins',rarity,section,cents:100})));

test('theme weights sum to one and average to explicit aggregate rarity targets',()=>{
 const seeds=new Map();for(let seed=0;seeds.size<AUCTION_LOT_THEMES.length;seed++)seeds.set(auctionLotTheme(seed).id,seed);
 for(const kind of ['free','paid']){
  const profiles=[...seeds.values()].map(seed=>auctionRarityWeights(seed,kind));
  for(const weights of profiles){assert.ok(Object.values(weights).every(value=>value>=0));assert.ok(Math.abs(Object.values(weights).reduce((sum,value)=>sum+value,0)-1)<1e-12);}
  for(const [band,target] of Object.entries(AUCTION_RARITY_TARGETS[kind]))assert.ok(Math.abs(profiles.reduce((sum,weights)=>sum+weights[band],0)/profiles.length-target)<1e-12,`${kind} ${band}`);
 }
});

test('seeded composition approaches requested epic, alt-art and signature shares by replacing commons',()=>{
 for(const kind of ['free','paid']){
  const counts={};let total=0;
  for(let seed=0;seed<2000;seed++)for(const card of generateAuctionLot(pool,seed,kind)){const band=auctionRarityBand(card);counts[band]=(counts[band]??0)+1;total++;}
  for(const band of ['epic','alt','signature']){
   const actual=(counts[band]??0)/total,target=AUCTION_RARITY_TARGETS[kind][band];
   assert.ok(Math.abs(actual-target)<(band==='signature'?.001:.01),`${kind} ${band}: ${actual}`);
  }
  assert.ok(counts.common/total<.24);
 }
});

test('ordinary-card prices do not limit or bias selection, even for collections far above $2,000',()=>{
 for(const kind of ['free','paid'])for(let seed=0;seed<20;seed++){
  const costly=pool.map(card=>({...card,cents:100000+card.productId})),lot=generateAuctionLot(costly,seed,kind);
  assert.deepEqual(lot.map(card=>card.productId),generateAuctionLot(pool,seed,kind).map(card=>card.productId));
  assert.ok(lot.reduce((sum,card)=>sum+card.cents,0)>200000);
  assert.ok(lot.every(card=>card.cents===costly[card.productId-1].cents));
 }
});

test('uncapped lots survive saves, settlement, inventory and sale with exact source values',()=>{
 const costly=pool.map(card=>({...card,cents:100000}));
 let save=beginAuction(initialAuctionSave(),costly,1000,undefined,42,'paid');
 save={...save,auction:{...save.auction,selected:100,npcs:save.auction.npcs.map(npc=>({...npc,bid:1,locked:true}))}};
 save=tickAuction(save,1100);assert.ok(save.auction.result.value>200000);
 assert.deepEqual(parseAuctionSave(JSON.stringify(save)),save);
 const cash=save.wallet.cash,proceeds=save.auction.result.value-save.auction.result.fee;
 save=sellInventory(finishAuction(save),costly);assert.equal(save.wallet.cash,cash+proceeds);assert.equal(save.wallet.inventory.length,0);
});

test('scarce catalogs fill only available copy-limited stock and never invent a missing rarity',()=>{
 const tiny=pool.slice(0,6);assert.deepEqual(generateAuctionLot(tiny,1),[]);
 const limited=pool.filter(card=>card.section==='signatures');
 for(const kind of ['free','paid'])for(let seed=0;seed<20;seed++){const lot=generateAuctionLot(limited,seed,kind);assert.ok(lot.length>=(kind==='free'?25:50));assert.ok(lot.every(card=>card.section==='signatures'));}
});
