import assert from 'node:assert/strict';
import test from 'node:test';
import {INVESTIGATIONS,informationOffers,investigate,RETIRED_INVESTIGATION_IDS} from '../core/domain/auction-information.ts';
import {beginAuction,buyInformation} from '../core/domain/auction-engine.ts';
import {initialAuctionSave} from '../core/domain/auction-types.ts';
import {parseAuctionSave} from '../core/domain/auction-save.ts';
import {npcKnowledgeValue} from '../core/domain/auction-npc-valuation.ts';
import {auctionRarity} from '../core/domain/auction-display.ts';
import {playAuctionSound} from '../app/games/auction-sound.ts';

test('Top-Two replaces new Top-Five offers without rewriting old purchased results or exposing identities',()=>{
 const pool=Array.from({length:50},(_,i)=>({productId:i+1,printing:'Normal',name:`Card ${i}`,image:`https://images.example/${i}`,set:'Origins',rarity:'Common',section:'commons',cents:i+1}));
 const save=beginAuction(initialAuctionSave(),pool,1000,pool,42),top2=INVESTIGATIONS.find(o=>o.id==='top2'),top5=INVESTIGATIONS.find(o=>o.id==='top5');
 const result=investigate(save.auction,top2);assert.equal(result.clue.text,'$0.99');assert.deepEqual(result.known,save.auction.known);assert.deepEqual(result.priced,save.auction.priced);assert.equal(top2.cost,3500);
 assert.equal(investigate(save.auction,top5).clue.text,'$2.40');assert.ok(RETIRED_INVESTIGATION_IDS.includes('top5'));
 for(let seed=0;seed<100;seed++)for(let round=1;round<=4;round++)assert.ok(informationOffers({...save.auction,seed,round}).every(o=>o.id!=='top5'));
 save.auction.offers=[top5];assert.equal(buyInformation(save,'top5',1100),save);assert.equal(parseAuctionSave(JSON.stringify(save)).auction.offers.length,0);
 save.auction.offers=[];save.auction.clues=[{id:'top5',label:'Top-Five Valuation',text:'$2.40'}];assert.deepEqual(parseAuctionSave(JSON.stringify(save)),save);
 const observed=pool.slice(0,3),valuation=npcKnowledgeValue({count:50,observed,random:observed,clues:[result.clue]});assert.ok(valuation.estimate>=99&&valuation.estimate<300);
});

test('promo rarity and promo sections share red-border classification without leaking hidden metadata',()=>{
 for(const card of [{rarity:'Promo',section:'rares'},{rarity:'Epic',section:'riftbound-promos'},{rarity:'Rare',section:'riftbound-foreign-promos'},{rarity:'Promo',section:'metal-promos'}])assert.equal(auctionRarity(card),'promo');
 assert.equal(auctionRarity({rarity:'Promo',section:'signatures'}),'premium');assert.equal(auctionRarity({rarity:'Epic',section:'alt-arts'}),'epic');assert.equal(auctionRarity(null),'unknown');
});

test('flip and investigation sounds are distinct, quiet, optional and suppressed while muted or hidden',()=>{
 const previous=globalThis.document,frequencies=[],volumes=[];
 globalThis.document={hidden:false};
 const audio={state:'running',currentTime:0,destination:{},createOscillator:()=>({frequency:{setValueAtTime:value=>frequencies.push(value),exponentialRampToValueAtTime(){}},connect(){},start(){},stop(){},disconnect(){}}),createGain:()=>({gain:{setValueAtTime:value=>volumes.push(value),exponentialRampToValueAtTime(){}},connect(){},disconnect(){}})};
 try{
  for(const cue of ['flip','investigation','tick','round'])playAuctionSound(audio,true,cue);
  assert.deepEqual(frequencies,[700,660,520,780]);assert.ok(volumes[0]<volumes[1]);
  playAuctionSound(audio,false,'flip');audio.state='suspended';playAuctionSound(audio,true,'investigation');audio.state='running';globalThis.document.hidden=true;playAuctionSound(audio,true,'round');assert.equal(frequencies.length,4);
  assert.doesNotThrow(()=>playAuctionSound(null,true,'flip'));
 }finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous}
});
