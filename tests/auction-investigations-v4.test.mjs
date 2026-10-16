import assert from 'node:assert/strict';
import test from 'node:test';
import {beginAuction,buyInformation,nextAuctionRound,tickAuction} from '../core/domain/auction-engine.ts';
import {initialAuctionSave} from '../core/domain/auction-types.ts';
import {INVESTIGATIONS,CURRENT_INVESTIGATIONS,informationOffers,informationUseful,investigate} from '../core/domain/auction-information.ts';
import {RETIRED_V3_INVESTIGATIONS,topThreeSlots,investigationDescription} from '../core/domain/auction-investigations-v4.ts';
import {selectFollowUp} from '../core/domain/auction-follow-up.ts';
import {followUpSlots} from '../core/domain/auction-investigations-v2.ts';
import {parseAuctionSave} from '../core/domain/auction-save.ts';
import {valuationClues} from '../core/domain/auction-investigations-v2.ts';
import {npcKnowledgeValue} from '../core/domain/auction-npc-valuation.ts';

const pool=Array.from({length:60},(_,i)=>({productId:i+1,name:`Card ${i}`,printing:'Normal',image:`https://images.example/${i}.jpg`,set:'Origins',section:i<40?'rares':'signatures',rarity:i<40?'Rare':'Showcase',cents:(i+1)*100}));
const option=id=>INVESTIGATIONS.find(row=>row.id===id);
const fresh=()=>beginAuction(initialAuctionSave(),pool,1000,pool,42);
const hidden=()=>({...fresh().auction,known:[],priced:[],publicReveals:[]});
function readyInspection(){
 let save=fresh();save.auction.offers=[option('core-mark10')];save=buyInformation(save,'core-mark10',1100);
 save=nextAuctionRound({...save,auction:{...save.auction,stage:'reveal'}},62000);save.auction.offers=[option('follow-up-v4')];return save;
}
test('new scans reveal four/seven unpriced cards and approved discounts keep legacy offers intact',()=>{
 for(const [id,count,cost] of [['price-small4',4,500],['price-large7',7,800],['chase-scan-v4',1,2000]]){
  const auction=hidden(),result=investigate(auction,option(id));assert.equal(result.priced.length,count);assert.equal(result.known.length,count);assert.equal(option(id).cost,cost);
  assert.deepEqual(result,investigate(auction,option(id)));assert.equal(investigate({...auction,known:[59],priced:[59]},option(id)).priced.filter(slot=>slot!==59).length,count);
 }
 const identity=investigate(hidden(),option('chase-identity-v4'));assert.equal(identity.known.length,1);assert.deepEqual(identity.priced,[]);assert.equal(option('chase-identity-v4').cost,1500);assert.equal(option('rarities-v4').cost,1000);
 for(const id of RETIRED_V3_INVESTIGATIONS){assert.ok(!CURRENT_INVESTIGATIONS.some(row=>row.id===id));const save=fresh();save.auction.offers=[option(id)];assert.deepEqual(parseAuctionSave(JSON.stringify(save)),save);}
 assert.equal(investigate(hidden(),option('reveal5')).priced.length,5);assert.equal(option('reveal5').cost,600);assert.equal(option('chase-scan-v2').cost,4500);
 for(let seed=0;seed<100;seed++)for(const round of [1,2,3,4]){const offers=informationOffers({...hidden(),seed,round});assert.ok(offers.every(row=>!RETIRED_V3_INVESTIGATIONS.includes(row.id)));assert.ok(offers.filter(row=>row.id==='top-three-peek').every(()=>round===4));}
});
test('top-three peek selects one unpriced top-three card, not a subtotal, for $40 in both types',()=>{
 const row=option('top-three-peek');assert.equal(row.cost,4000);
 for(const kind of ['free','paid']){
  const auction={...hidden(),round:4,kind};assert.deepEqual(topThreeSlots(auction),[59,58,57]);
  const result=investigate(auction,row);assert.equal(result.priced.length,1);assert.ok([57,58,59].includes(result.priced[0]));assert.equal(result.known.length,1);assert.ok(!result.clue.text.includes('$'));
  const save={...fresh(),auction:{...auction,entryFee:kind==='paid'?5000:0,offers:[row]}};assert.equal(buyInformation(save,row.id,1100).wallet.cash,246000);
  assert.equal(informationUseful({...auction,round:3},row.id),false);
  assert.deepEqual(investigate({...auction,known:[57,58,59],priced:[57,58,59]},row).priced,[57,58,59]);
 }
});
test('follow-up charges once, persists a pending choice and reveals only the clicked eligible card',()=>{
 const save=readyInspection(),slots=followUpSlots(save.auction),pending=buyInformation(save,'follow-up-v4',62100);assert.ok(slots.length>0);
 assert.equal(pending.wallet.cash,save.wallet.cash-500);assert.equal(pending.auction.pendingFollowUp,true);assert.deepEqual(pending.auction.priced,save.auction.priced);assert.deepEqual(parseAuctionSave(JSON.stringify(pending)),pending);
 assert.equal(buyInformation(pending,'follow-up-v4',62200),pending);assert.equal(selectFollowUp(pending,999,62200),pending);
 const selected=selectFollowUp(pending,slots.at(-1),62200);assert.equal(selected.auction.pendingFollowUp,undefined);assert.equal(selected.wallet.cash,pending.wallet.cash);assert.deepEqual(selected.auction.clues.at(-1).reveals,[{slot:slots.at(-1),visibility:'price'}]);assert.deepEqual(parseAuctionSave(JSON.stringify(selected)),selected);assert.equal(selectFollowUp(selected,slots[0],62300),selected);
 assert.equal(selectFollowUp(pending,slots[0],pending.auction.deadline),pending);
 assert.throws(()=>parseAuctionSave(JSON.stringify({...pending,auction:{...pending.auction,pendingFollowUp:false}})),/invalid/);
});
test('unused inspection auto-picks deterministically on deadline or early round resolution with correct history',()=>{
 const pending=buyInformation(readyInspection(),'follow-up-v4',62100);
 for(const expired of [false,true]){
  const save={...pending,auction:{...pending.auction,selected:expired?null:1,npcs:pending.auction.npcs.map(npc=>({...npc,bid:1,locked:true}))}};
  const finish=tickAuction(save,expired?save.auction.deadline:62300),again=tickAuction(save,expired?save.auction.deadline:62300);
  assert.equal(finish.auction.pendingFollowUp,undefined);const clue=finish.auction.clues.at(-1);assert.equal(clue.reveals.length,1);assert.ok(followUpSlots(pending.auction).includes(clue.reveals[0].slot));assert.deepEqual(again,finish);assert.equal(finish.auction.spent,pending.auction.spent);
  assert.deepEqual(finish.auction.bidHistory.at(-1)[0].notes,[clue]);assert.deepEqual(parseAuctionSave(JSON.stringify(finish)),finish);
 }
 const none=readyInspection();none.auction.clues=[];assert.equal(buyInformation(none,'follow-up-v4',62100),none);
});
test('discounted census retains grouped-only information and NPC interpretation',()=>{
 const auction=hidden(),before=investigate(auction,option('rarities-v3')),after=investigate(auction,option('rarities-v4'));assert.equal(before.clue.text,after.clue.text);assert.ok(!/Signature:/.test(after.clue.text));
 const input={count:auction.lot.length,observed:[],random:[],prior:auction.marketPrior,round:4};assert.equal(npcKnowledgeValue({...input,clues:valuationClues([after.clue])}).estimate,npcKnowledgeValue({...input,clues:[before.clue]}).estimate);
 assert.equal(investigationDescription('12 copies, $40.00 and $5.25'),'12 cards, $40 and $5.25');assert.ok(CURRENT_INVESTIGATIONS.every(row=>!row.description.includes('copies')));
});
