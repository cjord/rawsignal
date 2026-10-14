import assert from 'node:assert/strict';
import test from 'node:test';
import {auctionRarity,auctionMetricTone,orderedAuctionSlots,publicAuctionBidNotes,auctionRevealQuote} from '../core/domain/auction-display.ts';
import {beginAuction,npcBid,nextAuctionRound,tickAuction} from '../core/domain/auction-engine.ts';
import {initialAuctionSave} from '../core/domain/auction-types.ts';
test('reveal totals share per-printing fee rounding and charge the fixed bid and expenses only once',()=>{
 const card={productId:1,printing:'Normal',cents:15},auction={lot:[card,card,{...card,productId:2}],feeBps:1000,result:{winner:'You',bid:10,playerExpenses:2}};
 assert.deepEqual(auctionRevealQuote(auction,[]),{value:0,fee:0,net:-12});
 assert.deepEqual(auctionRevealQuote(auction,[0]),{value:15,fee:2,net:1});
 assert.deepEqual(auctionRevealQuote(auction,[0,1]),{value:30,fee:3,net:15});
 assert.deepEqual(auctionRevealQuote(auction,[0,1,2]),{value:45,fee:5,net:28});
 assert.deepEqual(auctionRevealQuote(auction,[0,0,1,2]),auctionRevealQuote(auction,[0,1,2]));
 assert.equal(auctionRevealQuote({...auction,result:{...auction.result,winner:'The Dealer'}},[0,1,2]).net,30);
});
test('zero and unavailable metrics are neutral while actual costs and losses have their own tones',()=>{
 for(const kind of ['signed','cost','info']){assert.equal(auctionMetricTone(0,kind),'');assert.equal(auctionMetricTone(null,kind),'')}
 assert.equal(auctionMetricTone(-1),'is-loss');assert.equal(auctionMetricTone(1),'is-gain');assert.equal(auctionMetricTone(1,'cost'),'is-cost');
});
test('known slots come first without modifying the lot, visibility or frozen indices',()=>{
 const auction={lot:[{name:'a'},{name:'b'},{name:'c'},{name:'d'}]},visible=[0,2];assert.deepEqual(orderedAuctionSlots(auction,visible),[0,2,1,3]);assert.deepEqual(visible,[0,2]);assert.equal(auction.lot[2].name,'c');
 assert.equal(auctionRarity({rarity:'Rare',section:'signatures'}),'premium');assert.equal(auctionRarity({rarity:'Rare',section:'alt-arts'}),'epic');assert.equal(auctionRarity({rarity:'Common'}),'common');
});
test('even legacy NPC notes redact card names and values, while your purchased clues remain exact',()=>{
 const bid={name:'The Dealer',cents:100,notes:[{id:'identity3',label:'Secret Card $123',text:'Secret Card (Foil): $123.45'}]};
 assert.ok(!JSON.stringify(publicAuctionBidNotes(bid)).includes('Secret Card'));assert.ok(!JSON.stringify(publicAuctionBidNotes(bid)).includes('$123'));
 assert.deepEqual(publicAuctionBidNotes({...bid,name:'You'}),bid.notes);assert.equal(publicAuctionBidNotes({name:'The Dealer',cents:100}),undefined);
});
test('NPC valuation ignores previous bids and personal samples persist and grow across rounds',()=>{
 assert.equal(npcBid([100,200],[40,40],[],6,()=>.5),npcBid([100,200],[40,40],[250000,1],6,()=>.5));
 const pool=Array.from({length:30},(_,index)=>({productId:index+1,printing:'Normal',name:`Card ${index}`,image:`https://images.example/${index}`,set:'Origins',rarity:'Common',section:'commons',cents:100+index}));
 let save=beginAuction(initialAuctionSave(),pool,1000,undefined,42);const samples=save.auction.npcs.map(npc=>npc.sample);
 save={...save,auction:{...save.auction,npcs:save.auction.npcs.map(npc=>({...npc,bid:0}))}};save=tickAuction(save,save.auction.deadline+1);save=nextAuctionRound(save,100000);
 save.auction.npcs.forEach((npc,index)=>{assert.ok(samples[index].every(slot=>npc.sample.includes(slot)));assert.equal(npc.sample.length,5)});
});
