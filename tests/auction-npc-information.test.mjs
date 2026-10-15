import assert from 'node:assert/strict';
import test from 'node:test';
import {beginAuction,tickAuction,nextAuctionRound,lockBid} from '../core/domain/auction-engine.ts';
import {initialAuctionSave} from '../core/domain/auction-types.ts';
import {npcRoundInformation,npcInvestigationName,NPC_INVESTIGATION_IDS} from '../core/domain/auction-npc-information.ts';
import {publicAuctionBidNotes} from '../core/domain/auction-display.ts';
import {parseAuctionSave} from '../core/domain/auction-save.ts';
import {publicAuctionSlots} from '../core/domain/auction-public.ts';
const pool=Array.from({length:60},(_,i)=>({productId:i+1,printing:'Normal',name:`Secret Card ${i}`,image:`https://images.example/${i}`,set:'Origins',rarity:i<30?'Common':'Rare',section:'rares',cents:100+i*10}));
test('NPCs choose named investigations, preserve memory and snapshot only their investigation names',()=>{
 let save=beginAuction(initialAuctionSave(),pool,1000,undefined,42);
 for(let round=1;round<=4;round++){
  for(const npc of save.auction.npcs){assert.equal(npc.investigations.length,round);assert.ok(NPC_INVESTIGATION_IDS.includes(npc.investigations.at(-1)));assert.notEqual(npcInvestigationName(npc),'Private Inspection')}
  save={...save,auction:{...save.auction,npcs:save.auction.npcs.map(npc=>({...npc,bid:1,locked:true}))}};save=lockBid(save,1,save.auction.deadline-1000);save=tickAuction(save,save.auction.deadline-500);
  save.auction.npcs.forEach((npc,index)=>{const notes=publicAuctionBidNotes(save.auction.bids[index+1]);assert.equal(notes.length,1);assert.equal(notes[0].label,npcInvestigationName(npc));assert.ok(!JSON.stringify(notes).includes('Secret Card'));assert.ok(!JSON.stringify(notes).includes('$'))});
  assert.deepEqual(parseAuctionSave(JSON.stringify(save)),save);
  if(round<4)save=nextAuctionRound(save,save.auction.deadline+1);
 }
});
test('unseen prices outside the chosen aggregate and personal samples do not influence NPC estimates',()=>{
 const auction=beginAuction(initialAuctionSave(),pool,1000,undefined,42).auction,sample=[1,3,4,5],previous={name:'The Dealer',investigations:['reveal3'],inspected:[]};
 const info=npcRoundInformation(auction,0,sample,previous);assert.equal(info.investigations.at(-1),'bulk');
 const known=new Set([...publicAuctionSlots(auction),...sample]),hidden=auction.lot.findIndex((card,index)=>!known.has(index)&&card.rarity==='Rare');assert.ok(hidden>=0);
 const changed={...auction,lot:auction.lot.map((card,index)=>index===hidden?{...card,cents:999999}:card)};
 assert.equal(npcRoundInformation(changed,0,sample,previous).estimate,info.estimate);
});
test('future opponents and legacy notes expose safe names without revealing results or invalid saved knowledge',()=>{
 const note={id:'top5',label:'Secret Card $900',text:'$900 and Secret Card'};
 assert.equal(publicAuctionBidNotes({name:'Another Player',cents:1,notes:[note]})[0].label,'Top-Five Valuation');
 assert.ok(!JSON.stringify(publicAuctionBidNotes({name:'Another Player',cents:1,notes:[note]})).includes('$900'));
 assert.equal(publicAuctionBidNotes({name:'The Dealer',cents:1,notes:[{id:'identity3',label:'Private Inspection',text:'secret'}]})[0].label,'Card Inspection (Legacy)');
 const save=beginAuction(initialAuctionSave(),pool,1000);save.auction.npcs[0].inspected=[999999];assert.throws(()=>parseAuctionSave(JSON.stringify(save)));
});
