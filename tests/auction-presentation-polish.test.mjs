import assert from 'node:assert/strict';
import test from 'node:test';
import {beginAuction,buyInformation,leaveAuction,lockBid,tickAuction} from '../core/domain/auction-engine.ts';
import {initialAuctionSave} from '../core/domain/auction-types.ts';
import {parseAuctionSave} from '../core/domain/auction-save.ts';
import {auctionValueEffect,auctionRarity,publicAuctionBidNotes} from '../core/domain/auction-display.ts';
import {auctionClueReveals} from '../core/domain/auction-clue-reveals.ts';
import {npcInvestigationNotes} from '../core/domain/auction-npc-information.ts';
const pool=Array.from({length:70},(_,i)=>({productId:i+1,printing:'Normal',name:`Card ${i}`,image:`https://images.example/${i}`,set:'Origins',rarity:'Common',section:'commons',cents:100+i}));

test('value effects require revealed individual prices and respect exact foil/glow boundaries',()=>{
 for(const cents of [4999,5000,24999,25000,1000000])assert.equal(auctionValueEffect(cents,false),undefined);
 assert.equal(auctionValueEffect(4999,true),undefined);assert.equal(auctionValueEffect(5000,true),'foil');assert.equal(auctionValueEffect(24999,true),'foil');assert.equal(auctionValueEffect(25000,true),'glow');
 for(const cents of [NaN,Infinity,-1,1e20])assert.equal(auctionValueEffect(cents,true),undefined);
 assert.equal(auctionRarity({rarity:'Showcase',section:'other-showcases'}),'promo');
 assert.equal(auctionRarity({rarity:'Showcase',section:'overnumbered'}),'premium');
 assert.equal(auctionRarity({rarity:'Showcase',section:'alt-arts'}),'epic');
});

test('leaving paid/free auctions keeps charged expenses and inventory, grants no payout, and survives reload',()=>{
 for(const kind of ['free','paid']){
  const initial=initialAuctionSave();initial.wallet.inventory=[{productId:999,printing:'Foil',quantity:2}];
  let save=beginAuction(initial,pool,1000,undefined,42,kind);save=buyInformation(save,save.auction.offers[0].id,1100);assert.ok(save.auction.spent>0);
  save=lockBid(save,1000,1200);const wallet=structuredClone(save.wallet),sequence=save.sequence,seed=save.auction.seed;
  assert.equal(leaveAuction(save,seed+1),save);
  const left=leaveAuction(save,seed);assert.equal(left.auction,null);assert.deepEqual(left.wallet,wallet);assert.equal(left.sequence,sequence);
  assert.equal(left.wallet.cash,initial.wallet.cash-(kind==='paid'?5000:0)-save.auction.spent);
  assert.deepEqual(parseAuctionSave(JSON.stringify(left)),left);assert.equal(leaveAuction(left,seed),left);
  const review={...save,auction:{...save.auction,stage:'reveal'}};assert.equal(leaveAuction(review,seed).auction,null);
  const result={...save,auction:{...save.auction,stage:'result'}};assert.equal(leaveAuction(result,seed),result);
 }
});

test('investigation snapshots preserve visibility upgrades, omit already known cards and copy NPC notes deeply',()=>{
 const before={known:[0,1],priced:[0],rarityKnown:[2]},after={known:[0,1,3,4],priced:[0,1,3],rarityKnown:[2,5]};
 assert.deepEqual(auctionClueReveals(before,after),[{slot:1,visibility:'price'},{slot:3,visibility:'price'},{slot:4,visibility:'identity'},{slot:5,visibility:'rarity'}]);
 const finding={id:'reveal5',label:'Random Price Scan',text:'3 copies revealed with prices.',round:1,reveals:auctionClueReveals(before,after)};
 const npc={name:'The Collector',investigations:['reveal5'],findings:[finding]},notes=npcInvestigationNotes(npc),bid={name:npc.name,cents:100,notes};
 assert.deepEqual(publicAuctionBidNotes(bid,true),[finding]);assert.ok(!JSON.stringify(publicAuctionBidNotes(bid)).includes('slot'));
 finding.reveals[0].slot=69;assert.equal(notes[1].reveals[0].slot,1);
 const legacy=npcInvestigationNotes({...npc,findings:undefined});assert.match(legacy[1].text,/unavailable/);assert.equal(legacy[1].reveals,undefined);
});

test('new NPC round notes retain actual per-investigation disclosures through settlement and persistence',()=>{
 let save=beginAuction(initialAuctionSave(),pool,1000,undefined,42);
 save={...save,auction:{...save.auction,npcs:save.auction.npcs.map(npc=>({...npc,bid:100,locked:true}))}};save=lockBid(save,200,1200);save=tickAuction(save,1500);assert.equal(save.auction.stage,'result');
 for(const npc of save.auction.npcs){const bid=save.auction.bidHistory[0].find(bid=>bid.name===npc.name),finding=npc.findings.at(-1);assert.deepEqual(bid.notes[1],finding);assert.ok(Array.isArray(finding.reveals));for(const reveal of finding.reveals){assert.ok(!npc.sample.includes(reveal.slot));assert.ok(!save.auction.publicReveals.flatMap(row=>row.slots).includes(reveal.slot));}}
 assert.deepEqual(parseAuctionSave(JSON.stringify(save)),save);
});
