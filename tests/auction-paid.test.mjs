import assert from 'node:assert/strict';
import test from 'node:test';
import {generateAuctionLot} from '../core/domain/auction-lots.ts';
import {beginAuction,tickAuction,lockBid} from '../core/domain/auction-engine.ts';
import {initialAuctionSave} from '../core/domain/auction-types.ts';
import {parseAuctionSave} from '../core/domain/auction-save.ts';
import {INVESTIGATIONS,LEGACY_INVESTIGATION_COSTS} from '../core/domain/auction-information.ts';
import {auctionRevealQuote} from '../core/domain/auction-display.ts';
import {readFileSync} from 'node:fs';
import {allowedRarities} from '../core/market-state.ts';
import {parseCards} from '../core/domain/contracts.ts';
import {auctionCatalog} from '../core/domain/auction-market.ts';
const pool=Array.from({length:150},(_,i)=>({productId:i+1,printing:'Normal',name:`Card ${i}`,image:`https://image.example/${i}`,set:'Origins',rarity:i<100?'Common':i<130?'Rare':'Epic',section:'rares',cents:100+i}));

test('new lot sizes cover inclusive bounds, reject out-of-range preparation and preserve legacy frozen sizes',()=>{
 for(const [kind,min,max] of [['free',25,90],['paid',50,130]]){
  const counts=new Set();for(let seed=0;seed<2000;seed++)counts.add(generateAuctionLot(pool,seed,kind).length);
  assert.equal(Math.min(...counts),min);assert.equal(Math.max(...counts),max);assert.equal(counts.size,max-min+1);
  for(const length of [min-1,max+1]){const save=initialAuctionSave();assert.equal(beginAuction(save,pool,1000,Array.from({length},(_,i)=>pool[i%pool.length]),42,kind),save)}
 }
 const legacy=beginAuction(initialAuctionSave(),pool,1000,undefined,42,'paid');legacy.auction.lot=Array.from({length:160},(_,i)=>({...pool[i%pool.length]}));legacy.auction.range=[160,160];
 assert.deepEqual(parseAuctionSave(JSON.stringify(legacy)),legacy);
});
test('real bundled catalog lots reach the promised size without a market-value ceiling',()=>{
 const catalog=auctionCatalog(allowedRarities.riftbound.flatMap(section=>parseCards(JSON.parse(readFileSync(new URL(`../public/data/${section}.json`,import.meta.url),'utf8')))));
 for(let seed=0;seed<100;seed++)for(const [kind,min,max] of [['free',25,90],['paid',50,130]]){const lot=generateAuctionLot(catalog,seed,kind);assert.ok(lot.length>=min&&lot.length<=max,`${kind} seed ${seed}: ${lot.length}`)}
});
test('paid lots are larger and favor higher rarity across seeds without changing source prices or free lots',()=>{
 let freePremium=0,paidPremium=0,freeCount=0,paidCount=0;
 for(let seed=0;seed<100;seed++){const free=generateAuctionLot(pool,seed),paid=generateAuctionLot(pool,seed,'paid');assert.ok(free.length>=25&&free.length<=90);assert.ok(paid.length>=50&&paid.length<=130);assert.ok(paid.length>=free.length);assert.deepEqual(paid,generateAuctionLot([...pool].reverse(),seed,'paid'));freeCount+=free.length;paidCount+=paid.length;freePremium+=free.filter(card=>card.rarity==='Epic').length;paidPremium+=paid.filter(card=>card.rarity==='Epic').length;assert.ok(paid.every(card=>card.cents===pool[card.productId-1].cents))}
 assert.ok(paidPremium/paidCount>freePremium/freeCount);
});
test('paid entry is affordable, charged once at successful entry, persisted, and included in player outcome',()=>{
 const initial=initialAuctionSave(),poor={...initial,wallet:{...initial.wallet,cash:4999}};assert.equal(beginAuction(poor,pool,1000,undefined,42,'paid'),poor);assert.equal(beginAuction(initial,pool,1000,[],42,'paid'),initial);
 let save=beginAuction(initial,pool,1000,undefined,42,'paid');assert.equal(save.wallet.cash,245000);assert.equal(save.auction.entryFee,5000);assert.deepEqual(parseAuctionSave(JSON.stringify(save)),save);assert.equal(beginAuction(save,pool,1100,undefined,42,'paid'),save);
 save={...save,auction:{...save.auction,selected:100000,npcs:save.auction.npcs.map(npc=>({...npc,bid:1,locked:true}))}};save=tickAuction(save,1100);assert.equal(save.wallet.cash,145000);const result=save.auction.result;assert.equal(result.net,result.value-result.fee-result.bid-result.playerExpenses-5000);assert.equal(auctionRevealQuote(save.auction,save.auction.lot.map((_,i)=>i)).net,result.net);assert.equal(tickAuction(parseAuctionSave(JSON.stringify(save)),999999).wallet.cash,145000);
});
test('paid NPC competition still uses private samples and never changes with the sealed player bid',()=>{
 const lot=generateAuctionLot(pool,42,'paid').slice(0,50),free=beginAuction(initialAuctionSave(),pool,1000,lot,42),paid=beginAuction(initialAuctionSave(),pool,1000,lot,42,'paid');
 paid.auction.npcs.forEach((npc,index)=>{assert.deepEqual(npc.sample,[]);assert.deepEqual(free.auction.npcs[index].sample,[]);assert.ok(Number.isSafeInteger(npc.bid)&&npc.bid>=0)});
 assert.deepEqual(lockBid(paid,1,1100).auction.npcs.map(npc=>npc.bid),lockBid(paid,200000,1100).auction.npcs.map(npc=>npc.bid));
});
test('new investigation prices reflect power while existing version-one offers retain old prices',()=>{
 const cost=id=>INVESTIGATIONS.find(option=>option.id===id).cost;assert.ok(cost('identity3')<cost('reveal3'));assert.ok(cost('identity10')<cost('top5'));assert.ok(cost('sets')<cost('appraisal'));assert.equal(cost('appraisal'),6000);
 const legacy=beginAuction(initialAuctionSave(),pool,1000);delete legacy.auction.kind;delete legacy.auction.entryFee;legacy.auction.offers=INVESTIGATIONS.filter(offer=>['sets','reveal3','rares'].includes(offer.id)).map(offer=>({...offer,cost:LEGACY_INVESTIGATION_COSTS[offer.id]}));assert.deepEqual(parseAuctionSave(JSON.stringify(legacy)),legacy);
 const invalid=structuredClone(legacy);invalid.auction.offers[0].cost=123456;assert.throws(()=>parseAuctionSave(JSON.stringify(invalid)));
});
