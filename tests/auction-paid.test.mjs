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
test('real bundled catalog paid lots reserve sufficient stock and budget to reach the promised size',()=>{
 const catalog=auctionCatalog(allowedRarities.riftbound.flatMap(section=>parseCards(JSON.parse(readFileSync(new URL(`../public/data/${section}.json`,import.meta.url),'utf8')))));
 for(let seed=0;seed<100;seed++){const lot=generateAuctionLot(catalog,seed,'paid');assert.ok(lot.length>=128&&lot.length<=160,`seed ${seed}: ${lot.length}`);assert.ok(lot.reduce((sum,card)=>sum+card.cents,0)<=200000)}
});
test('paid lots are larger and favor higher rarity across seeds without changing source prices or free lots',()=>{
 let freePremium=0,paidPremium=0,freeCount=0,paidCount=0;
 for(let seed=0;seed<100;seed++){const free=generateAuctionLot(pool,seed),paid=generateAuctionLot(pool,seed,'paid');assert.ok(paid.length>=128&&paid.length<=160);assert.ok(paid.length>free.length);assert.deepEqual(paid,generateAuctionLot([...pool].reverse(),seed,'paid'));freeCount+=free.length;paidCount+=paid.length;freePremium+=free.filter(card=>card.rarity==='Epic').length;paidPremium+=paid.filter(card=>card.rarity==='Epic').length;assert.ok(paid.every(card=>card.cents===pool[card.productId-1].cents))}
 assert.ok(paidPremium/paidCount>freePremium/freeCount*2);
});
test('paid entry is affordable, charged once at successful entry, persisted, and included in player outcome',()=>{
 const initial=initialAuctionSave(),poor={...initial,wallet:{...initial.wallet,cash:4999}};assert.equal(beginAuction(poor,pool,1000,undefined,42,'paid'),poor);assert.equal(beginAuction(initial,pool,1000,[],42,'paid'),initial);
 let save=beginAuction(initial,pool,1000,undefined,42,'paid');assert.equal(save.wallet.cash,245000);assert.equal(save.auction.entryFee,5000);assert.deepEqual(parseAuctionSave(JSON.stringify(save)),save);assert.equal(beginAuction(save,pool,1100,undefined,42,'paid'),save);
 save={...save,auction:{...save.auction,selected:100000,npcs:save.auction.npcs.map(npc=>({...npc,bid:1,locked:true}))}};save=tickAuction(save,1100);assert.equal(save.wallet.cash,145000);const result=save.auction.result;assert.equal(result.net,result.value-result.fee-result.bid-result.playerExpenses-5000);assert.equal(auctionRevealQuote(save.auction,save.auction.lot.map((_,i)=>i)).net,result.net);assert.equal(tickAuction(parseAuctionSave(JSON.stringify(save)),999999).wallet.cash,145000);
});
test('paid NPC competition still uses private samples and never changes with the sealed player bid',()=>{
 const lot=generateAuctionLot(pool,42,'paid'),free=beginAuction(initialAuctionSave(),pool,1000,lot,42),paid=beginAuction(initialAuctionSave(),pool,1000,lot,42,'paid');
 paid.auction.npcs.forEach((npc,index)=>{assert.deepEqual(npc.sample,free.auction.npcs[index].sample);assert.ok(npc.bid>=free.auction.npcs[index].bid)});
 assert.deepEqual(lockBid(paid,1,1100).auction.npcs.map(npc=>npc.bid),lockBid(paid,200000,1100).auction.npcs.map(npc=>npc.bid));
});
test('new investigation prices reflect power while existing version-one offers retain old prices',()=>{
 const cost=id=>INVESTIGATIONS.find(option=>option.id===id).cost;assert.ok(cost('identity3')<cost('reveal3'));assert.ok(cost('identity10')<cost('top5'));assert.ok(cost('sets')<cost('appraisal'));assert.equal(cost('appraisal'),10000);
 const legacy=beginAuction(initialAuctionSave(),pool,1000);delete legacy.auction.kind;delete legacy.auction.entryFee;legacy.auction.offers=legacy.auction.offers.map(offer=>({...offer,cost:LEGACY_INVESTIGATION_COSTS[offer.id]}));assert.deepEqual(parseAuctionSave(JSON.stringify(legacy)),legacy);
 const invalid=structuredClone(legacy);invalid.auction.offers[0].cost=123456;assert.throws(()=>parseAuctionSave(JSON.stringify(invalid)));
});
