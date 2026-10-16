import assert from 'node:assert/strict';
import test from 'node:test';
import {beginAuction,buyInformation,nextAuctionRound,tickAuction,sellInventory} from '../core/domain/auction-engine.ts';
import {initialAuctionSave,holdingKey} from '../core/domain/auction-types.ts';
import {INVESTIGATIONS,informationOffers} from '../core/domain/auction-information.ts';
import {matureDelayedInformation} from '../core/domain/auction-delayed.ts';
import {moveShowcaseCard,reorderShowcase,ownedAuctionCards} from '../core/domain/auction-showcase.ts';
import {auctionProfileSnapshot,encodeProfileSnapshot,decodeProfileSnapshot} from '../core/domain/auction-profile-share.ts';
import {parseAuctionSave} from '../core/domain/auction-save.ts';
import {npcRoundInformation} from '../core/domain/auction-npc-information.ts';
import {auctionRoundBid,auctionKnownSaleValue} from '../core/domain/auction-display.ts';
import {auctionSoundState,auctionSoundEvents} from '../app/games/auction-sound-events.ts';

const catalog=Array.from({length:60},(_,i)=>({productId:i+1,printing:'Normal',name:`Card ${i}`,image:`https://images.example/${i}`,set:'Origins',rarity:'Rare',section:'rares',cents:(i+1)*100}));
const option=INVESTIGATIONS.find(row=>row.id==='delayed-gratification');
const fresh=()=>beginAuction(initialAuctionSave(),catalog,1000,catalog,42);
test('delayed investigation charges $15 now and reveals two of the top five remaining cards exactly two rounds later',()=>{
 for(const boughtRound of [1,2]){
  let save=fresh();if(boughtRound===2)save=nextAuctionRound({...save,auction:{...save.auction,stage:'reveal'}},62000);
  save.auction.offers=[option];const before=[...save.auction.priced];save=buyInformation(save,option.id,save.auction.deadline-1);
  assert.equal(save.wallet.cash,248500);assert.deepEqual(save.auction.priced,before);assert.equal(save.auction.clues.at(-1).dueRound,boughtRound+2);assert.deepEqual(parseAuctionSave(JSON.stringify(save)),save);
  save=nextAuctionRound({...save,auction:{...save.auction,stage:'reveal'}},save.auction.deadline+1);assert.equal(save.auction.clues.at(-1).resolvedRound,undefined);
  save=nextAuctionRound({...save,auction:{...save.auction,stage:'reveal'}},save.auction.deadline+1);const clue=save.auction.clues[0];assert.equal(clue.resolvedRound,boughtRound+2);assert.equal(clue.reveals.length,2);assert.ok(clue.reveals.every(reveal=>reveal.visibility==='price'&&save.auction.priced.includes(reveal.slot)));
  const unpriced=save.auction.lot.map((_,slot)=>slot).filter(slot=>!save.auction.priced.includes(slot)||clue.reveals.some(reveal=>reveal.slot===slot)).sort((a,b)=>catalog[b].cents-catalog[a].cents).slice(0,5);assert.ok(clue.reveals.every(reveal=>unpriced.includes(reveal.slot)));assert.equal(matureDelayedInformation(save.auction),save.auction);assert.deepEqual(parseAuctionSave(JSON.stringify(save)),save);
 }
});
test('delayed offers use half weight, are unavailable after round two and have no early-ending refund',()=>{
 const auction=fresh().auction;let delayed=0,ordinary=0;
 for(let seed=0;seed<10000;seed++){for(const row of informationOffers({...auction,seed,round:1})){if(row.id===option.id)delayed++;if(row.id==='price-small4')ordinary++;}}
 assert.ok(delayed/ordinary>.4&&delayed/ordinary<.7);
 for(const round of [3,4]){assert.ok(!informationOffers({...auction,round}).some(row=>row.id===option.id));const save={...fresh(),auction:{...auction,round,offers:[option]}};assert.equal(buyInformation(save,option.id,1100),save);}
 let save=fresh();save.auction.offers=[option];save=buyInformation(save,option.id,1100);save=tickAuction({...save,auction:{...save.auction,selected:10000,npcs:save.auction.npcs.map(npc=>({...npc,bid:1,locked:true}))}},1200);assert.equal(save.auction.stage,'result');assert.equal(save.auction.spent,1500);assert.equal(save.auction.clues[0].resolvedRound,undefined);assert.deepEqual(save.auction.clues[0].reveals,[]);
});
test('NPC delayed findings mature only when due, retain purchase-round history, and cannot provide earlier prices',()=>{
 const base={...fresh().auction,known:[],priced:[],publicReveals:[],round:2},finding={id:option.id,label:option.label,text:'Pending',round:1,dueRound:3,reveals:[]};
 const previous={name:'The Collector',bid:1,locked:false,lockAt:0,sample:[],investigations:[option.id],findings:[finding]};
 const early=npcRoundInformation(base,0,[],previous,'The Collector');assert.equal(early.findings[0].reveals.length,0);
 const due=npcRoundInformation({...base,round:3},0,[],previous,'The Collector');assert.equal(due.findings[0].reveals.length,2);assert.equal(due.findings[0].resolvedRound,3);
 const auction={...base,stage:'result',clues:due.findings,npcs:[{...previous,findings:due.findings}]};const bid={name:'The Collector',cents:1,notes:[finding]};assert.equal(auctionRoundBid(auction,bid,1).notes[0].resolvedRound,3);assert.deepEqual(bid.notes[0],finding);
});
test('showcase reserves physical copies, enforces distinct 20-card limit and prevents selling displayed copies',()=>{
 let save={...initialAuctionSave(),wallet:{...initialAuctionSave().wallet,inventory:catalog.slice(0,25).map(card=>({productId:card.productId,printing:card.printing,quantity:2}))}};const key=holdingKey(catalog[0]);save=moveShowcaseCard(save,key,'showcase');assert.equal(save.showcase[0].quantity,1);assert.equal(save.wallet.inventory[0].quantity,1);assert.equal(ownedAuctionCards(save)[0].quantity,2);assert.equal(moveShowcaseCard(save,key,'showcase'),save);
 const sold=sellInventory(save,catalog);assert.equal(sold.wallet.inventory.length,0);assert.deepEqual(sold.showcase,save.showcase);const back=moveShowcaseCard(sold,key,'inventory');assert.equal(back.showcase.length,0);assert.equal(back.wallet.inventory[0].quantity,1);assert.equal(sellInventory(back,catalog).wallet.inventory.length,0);
 for(const card of catalog.slice(1,20))save=moveShowcaseCard(save,holdingKey(card),'showcase');assert.equal(save.showcase.length,20);assert.equal(moveShowcaseCard(save,holdingKey(catalog[20]),'showcase'),save);assert.deepEqual(parseAuctionSave(JSON.stringify(save)),save);
 const reordered=reorderShowcase(save,holdingKey(catalog[0]),holdingKey(catalog[1]));assert.equal(reordered.showcase[1].productId,1);assert.equal(ownedAuctionCards(reordered).reduce((s,row)=>s+row.quantity,0),50);
 const active={...save,auction:fresh().auction};assert.equal(moveShowcaseCard(active,key,'inventory'),active);
});
test('showcase shares are frozen, Unicode-safe and omit wallets, unselected holdings and arbitrary extra fields',()=>{
 let save={...initialAuctionSave(),profileName:'Zoë 🃏',showcase:[{productId:1,printing:'Normal',quantity:1}],statistics:{started:2,settled:1,won:1,abandoned:0,investigations:1500,entryFees:0,profit:123,rebates:0,bestProfit:123,buyouts:1,privateCash:999}};
 const snapshot=auctionProfileSnapshot(save,catalog,'2026-10-16T12:00:00Z'),encoded=encodeProfileSnapshot({...snapshot,wallet:{cash:888}}),decoded=decodeProfileSnapshot(encoded);assert.deepEqual(decoded,snapshot);assert.equal(decoded.name,'Zoë 🃏');assert.ok(!JSON.stringify(decoded).includes('wallet'));assert.ok(!JSON.stringify(decoded).includes('privateCash'));assert.equal(decoded.cards.length,1);assert.equal(decoded.cards[0][6],100);
 save={...save,showcase:[]};assert.equal(decoded.cards.length,1);assert.equal(auctionProfileSnapshot(save,catalog).cards.length,0);assert.throws(()=>decodeProfileSnapshot('!bad'));assert.throws(()=>decodeProfileSnapshot('a'.repeat(24001)));
 assert.throws(()=>parseAuctionSave(JSON.stringify({...initialAuctionSave(),showcase:[{productId:1,printing:'Normal',quantity:2}]})));
});
test('new auctions and sales use fixed 10% even with a historical wallet setting; frozen active auctions retain their fee',()=>{
 const legacy={...initialAuctionSave(),wallet:{...initialAuctionSave().wallet,feeBps:500,inventory:[{productId:1,printing:'Normal',quantity:1}]}};assert.equal(beginAuction(legacy,catalog,1000,catalog,42).auction.feeBps,1000);assert.equal(sellInventory(legacy,catalog).wallet.cash,250090);const frozen={...fresh(),auction:{...fresh().auction,feeBps:500}};assert.equal(parseAuctionSave(JSON.stringify(frozen)).auction.feeBps,500);
});
test('bling sounds follow newly revealed prices above $1000, not hidden values or repeated state',()=>{
 const auction={...fresh().auction,known:[],priced:[],publicReveals:[],lot:catalog.map((card,i)=>({...card,cents:i===0?100001:i===1?100000:card.cents}))};const before=auctionSoundState(auction,0),hidden=auctionSoundState({...auction,lot:auction.lot.map(card=>({...card,cents:999999}))},0);assert.deepEqual(auctionSoundEvents(before,hidden),[]);
 const shown=auctionSoundState({...auction,known:[0],priced:[0]},1);assert.ok(auctionSoundEvents(before,shown).includes('bling'));assert.ok(!auctionSoundEvents(shown,shown).includes('bling'));const boundary=auctionSoundState({...auction,known:[1],priced:[1]},1);assert.ok(!auctionSoundEvents(before,boundary).includes('bling'));
});
test('known sale value never consults prices of hidden copies of the same printing',()=>{
 const auction={...fresh().auction,lot:[{...catalog[0],cents:120001},{...catalog[0],cents:1}],known:[0],priced:[0]};assert.equal(auctionKnownSaleValue(auction),108001);assert.equal(auctionKnownSaleValue({...auction,lot:[auction.lot[0],{...auction.lot[1],cents:99999999}]}),108001);assert.equal(auctionKnownSaleValue({...auction,stage:'result'},[]),0);assert.equal(auctionKnownSaleValue({...auction,stage:'result'},[0]),108001);
});
