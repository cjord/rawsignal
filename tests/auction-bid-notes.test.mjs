import assert from 'node:assert/strict';
import test from 'node:test';
import {initialAuctionSave} from '../core/domain/auction-types.ts';
import {beginAuction,buyInformation,lockBid,tickAuction,nextAuctionRound} from '../core/domain/auction-engine.ts';
import {parseAuctionSave} from '../core/domain/auction-save.ts';
const pool=Array.from({length:30},(_,index)=>({productId:index+1,printing:'Normal',name:`Card ${index+1}`,image:`https://images.example/${index}`,set:'Origins',rarity:'Common',section:'commons',cents:100+index*10}));
test('bid notes capture actual clue knowledge only after reveal and remain immutable across rounds',()=>{
 let save=beginAuction(initialAuctionSave(),pool,1000,undefined,42);save=buyInformation(save,save.auction.offers[0].id,1100);
 save={...save,auction:{...save.auction,npcs:save.auction.npcs.map(npc=>({...npc,bid:100,locked:true}))}};save=lockBid(save,100,1200);
 assert.equal(save.auction.bidHistory.length,0);save=tickAuction(save,1500);assert.equal(save.auction.stage,'reveal');
 const bids=save.auction.bidHistory[0];assert.deepEqual(bids[0].notes,save.auction.clues);assert.notEqual(bids[0].notes[0],save.auction.clues[0]);
 for(let index=1;index<4;index++){const notes=bids[index].notes;assert.equal(notes.length,2);assert.equal(notes[1].label,'Private Inspection');assert.ok(!notes.some(note=>/Card \d|\$/.test(note.text)))}
 const snapshot=JSON.stringify(bids);save=nextAuctionRound(save,2000);save=buyInformation(save,save.auction.offers[0].id,2100);assert.equal(JSON.stringify(save.auction.bidHistory[0]),snapshot);assert.deepEqual(parseAuctionSave(JSON.stringify(save)),save);
});
test('legacy notes stay unavailable and malformed new notes are rejected without dropping the save',()=>{
 let save=beginAuction(initialAuctionSave(),pool,1000,undefined,42);save=tickAuction(save,61001);
 const legacy=structuredClone(save);for(const bid of legacy.auction.bids)delete bid.notes;for(const round of legacy.auction.bidHistory)for(const bid of round)delete bid.notes;
 assert.deepEqual(parseAuctionSave(JSON.stringify(legacy)),legacy);
 const bad=structuredClone(save);bad.auction.bidHistory[0][0].notes=[{id:'test',label:'Bad',text:123}];assert.throws(()=>parseAuctionSave(JSON.stringify(bad)));
});
