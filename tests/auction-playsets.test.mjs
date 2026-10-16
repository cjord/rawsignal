import assert from 'node:assert/strict';
import test from 'node:test';
import {auctionCopyLimit,auctionRarityLabel} from '../core/domain/auction-copy-policy.ts';
import {generateAuctionLot} from '../core/domain/auction-lots.ts';
import {beginAuction,buyInformation} from '../core/domain/auction-engine.ts';
import {initialAuctionSave,holdingKey} from '../core/domain/auction-types.ts';
import {INVESTIGATIONS,investigate,informationOffers} from '../core/domain/auction-information.ts';
import {parseAuctionSave} from '../core/domain/auction-save.ts';
import {publicAuctionBidNotes,orderedAuctionSlots} from '../core/domain/auction-display.ts';
const base={productId:1,printing:'Normal',name:'Card',image:'https://images.example/card.jpg',set:'Origins',rarity:'Common',section:'commons',cents:100};
const cards=[['Common','commons'],['Uncommon','uncommons'],['Rare','rares'],['Epic','epics'],['Epic','alt-arts'],['Epic','overnumbered'],['Epic','signatures']].map(([rarity,section])=>({...base,rarity,section}));
test('fourth copies are uncommon and progressively rarer by treatment; further copies are rarer again',()=>{
 const extra=cards.map(()=>0),fifth=cards.map(()=>0);
 for(let seed=0;seed<20000;seed++){
  const caps=cards.map((card,index)=>{const cap=auctionCopyLimit(card,seed);if(cap>3)extra[index]++;if(cap>4)fifth[index]++;assert.ok(cap>=3&&cap<=8);assert.equal(auctionCopyLimit(card,seed,3),3);return cap});
  assert.ok(caps.every((cap,index)=>index===0||caps[index-1]>=cap));
 }
 assert.ok(extra[0]>1500&&extra[0]<3000);assert.ok(extra.every((count,index)=>index===0||extra[index-1]>count));assert.ok(extra.at(-1)<20);assert.ok(fifth.every((count,index)=>count<extra[index]*.1));
});
test('lot stock uses the actual seeded copy limits, preserving printing identity and source order independence',()=>{
 const pool=Array.from({length:80},(_,i)=>({...cards[i%cards.length],productId:i+1}));
 for(const kind of ['free','paid'])for(let seed=0;seed<40;seed++){
  const lot=generateAuctionLot(pool,seed,kind),copies=new Map();assert.ok(lot.length>=(kind==='free'?25:50));
  for(const card of lot)copies.set(holdingKey(card),(copies.get(holdingKey(card))??0)+1);
  for(const card of lot)assert.ok(copies.get(holdingKey(card))<=auctionCopyLimit(card,seed));
  assert.deepEqual(lot,generateAuctionLot([...pool].reverse(),seed,kind));
 }
 assert.equal(auctionRarityLabel({...base,rarity:'Legend'}),'Legend');
});
test('rarity markers expose no identities or prices; targeted identity peeks expose no price',()=>{
 const pool=Array.from({length:50},(_,i)=>({...base,productId:i+1,rarity:i<25?'Rare':'Epic',section:i<25?'rares':'epics'}));
 const save=beginAuction(initialAuctionSave(),pool,1000,pool,42),auction=save.auction;
 for(const id of ['rarity-peek3','rare-mark2','epic-mark2','rare-identity2','epic-identity2']){
  const option=INVESTIGATIONS.find(option=>option.id===id),result=investigate(auction,option);assert.deepEqual(result.priced,auction.priced);
  if(id.includes('identity'))assert.ok(result.known.length>auction.known.length);
  else{assert.deepEqual(result.known,auction.known);assert.ok(result.rarityKnown.length>0);assert.ok(!result.clue.text.includes('Card'));}
 }
 const option=INVESTIGATIONS.find(option=>option.id==='rarity-peek3');const bought=buyInformation({...save,auction:{...auction,offers:[option]}},option.id,1100);
 assert.deepEqual(parseAuctionSave(JSON.stringify(bought)),bought);assert.equal(bought.wallet.cash,250000-option.cost);assert.deepEqual(orderedAuctionSlots(bought.auction,bought.auction.known).slice(bought.auction.known.length,bought.auction.known.length+3),[...bought.auction.rarityKnown].sort((a,b)=>a-b));
 const invalid=structuredClone(bought);invalid.auction.rarityKnown=[99999];assert.throws(()=>parseAuctionSave(JSON.stringify(invalid)));
 assert.ok(informationOffers({...auction,known:pool.map((_,i)=>i)}).every(offer=>!offer.id.startsWith('rare-mark')&&!offer.id.startsWith('epic-mark')&&!offer.id.startsWith('alt-mark')&&!offer.id.includes('identity')&&!offer.id.startsWith('rarity-peek')));
});
test('NPC public notes and icons exclude current and legacy shared clues without changing player notes or stored history',()=>{
 const notes=[{id:'public-start',label:'Shared Public Reveals',text:'public'},{id:'reveal3',label:'Public Starting Cards',text:'public old'},{id:'bulk',label:'private',text:'secret'}],bid={name:'The Dealer',cents:100,notes};
 const result=publicAuctionBidNotes(bid);assert.equal(result.length,1);assert.equal(result[0].id,'bulk');assert.equal(notes.length,3);assert.deepEqual(publicAuctionBidNotes({...bid,name:'You'}),notes);
});
