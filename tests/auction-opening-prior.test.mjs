import assert from 'node:assert/strict';
import test from 'node:test';
import {auctionMarketPrior} from '../core/domain/auction-market-prior.ts';
import {npcKnowledgeValue} from '../core/domain/auction-npc-valuation.ts';
import {beginAuction,npcBid,tickAuction} from '../core/domain/auction-engine.ts';
import {initialAuctionSave} from '../core/domain/auction-types.ts';
import {parseAuctionSave} from '../core/domain/auction-save.ts';
const pool=['commons','epics','alt-arts','signatures'].flatMap((section,band)=>Array.from({length:50},(_,i)=>({productId:band*50+i+1,printing:'Normal',name:`Card ${band}-${i}`,image:`https://images.example/${band}-${i}`,rarity:band?'Epic':'Common',section,set:'Origins',cents:band?5000*band:20})));

test('catalog prior depends on auction kind, public theme and catalog, never generated hidden contents',()=>{
 const low=beginAuction(initialAuctionSave(),pool,1000,pool.slice(0,50),42,'paid'),high=beginAuction(initialAuctionSave(),pool,1000,pool.slice(50,100),42,'paid');
 assert.deepEqual(low.auction.marketPrior,high.auction.marketPrior);assert.deepEqual(parseAuctionSave(JSON.stringify(low)),low);
 assert.notEqual(low.auction.marketPrior.mean,auctionMarketPrior(pool,42,'free').mean);
 for(const value of [NaN,Infinity,-1]){const invalid=structuredClone(low);invalid.auction.marketPrior.mean=value;assert.throws(()=>parseAuctionSave(JSON.stringify(invalid)));}
});

test('cheap opening samples retain a meaningful type expectation, with stronger evidence replacing it later',()=>{
 const observed=pool.slice(0,8),knowledge={count:90,observed,random:observed,clues:[]},prior=auctionMarketPrior(pool,42,'paid');
 const old=npcKnowledgeValue(knowledge),opening=npcKnowledgeValue({...knowledge,prior,round:1}),last=npcKnowledgeValue({...knowledge,prior,round:4});
 assert.ok(opening.estimate>old.estimate*3);assert.ok(opening.estimate>last.estimate);
 const census=npcKnowledgeValue({...knowledge,prior,round:1,clues:[{id:'rarities-v2',label:'Rarity Census',text:'Common: 90'}]});assert.ok(census.estimate<opening.estimate*.1);
 const marked=npcKnowledgeValue({...knowledge,prior,round:1,markedBands:['signature']});assert.ok(marked.estimate>opening.estimate);
 const finalMarked=npcKnowledgeValue({...knowledge,prior,round:4,markedBands:['signature']});assert.ok(finalMarked.estimate>last.estimate);
 // Exact counts replace speculation and may lower it: this lot has only one
 // Signature, rather than the hidden premium population the prior allows for.
 const finalCensus=npcKnowledgeValue({...knowledge,prior,round:4,clues:[{id:'rarities-v2',label:'Rarity Census',text:'Common: 89 · Signature: 1'}]});
 assert.equal(finalCensus.estimate,Math.round(8*20+81*prior.bands.find(row=>row.band==='common').typical+prior.bands.find(row=>row.band==='signature').typical));
});

test('NPCs have no financial ceiling and large winning bids survive persistence and loss settlement',()=>{
 const bid=npcBid([],[90,90],[],0,()=>.5,1000,1,0,10000000,.8);assert.ok(bid>250000);assert.ok(Number.isSafeInteger(bid));
 let save=beginAuction(initialAuctionSave(),pool,1000,undefined,42);
 save.auction.npcs=save.auction.npcs.map((npc,i)=>({...npc,bid:i===0?10000000:100,locked:true}));save.auction.selected=0;
 assert.deepEqual(parseAuctionSave(JSON.stringify(save)),save);save=tickAuction(save,1100);assert.equal(save.auction.result.bid,10000000);assert.deepEqual(parseAuctionSave(JSON.stringify(save)),save);
 for(const value of [-1,Infinity,Number.MAX_SAFE_INTEGER+1]){const invalid=structuredClone(save);invalid.auction.npcs[0].bid=value;assert.throws(()=>parseAuctionSave(JSON.stringify(invalid)));}
});

test('threshold counts and concentration reports retain their disclosed lower bounds in the final round',()=>{
 const observed=pool.slice(0,3),knowledge={count:90,observed,random:observed,round:4,clues:[]};
 const counted=npcKnowledgeValue({...knowledge,clues:[{id:'over20-mark',label:'$20 Price Check',text:'10 copies above $20.'}]});assert.ok(counted.estimate>=20010+60);
 const concentrated=npcKnowledgeValue({...knowledge,clues:[{id:'concentration',label:'Concentration Report',text:'Low concentration: the top three copies hold under 30% of collection value.'}]});assert.ok(concentrated.estimate>200);
});
