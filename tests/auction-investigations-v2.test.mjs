import assert from 'node:assert/strict';
import test from 'node:test';
import {beginAuction,buyInformation,nextAuctionRound} from '../core/domain/auction-engine.ts';
import {initialAuctionSave} from '../core/domain/auction-types.ts';
import {INVESTIGATIONS,informationOffers,informationUseful,investigate,knownValue} from '../core/domain/auction-information.ts';
import {followUpSlots,rebalancedCost,REBALANCED_INVESTIGATIONS,valuationClues} from '../core/domain/auction-investigations-v2.ts';
import {auctionRarityBand} from '../core/domain/auction-copy-policy.ts';
import {parseAuctionSave} from '../core/domain/auction-save.ts';

const groups=[['Common','commons'],['Uncommon','uncommons'],['Rare','rares'],['Epic','epics'],['Epic','alt-arts'],['Epic','signatures']];
const pool=groups.flatMap(([rarity,section],group)=>Array.from({length:15},(_,i)=>({productId:group*15+i+1,printing:'Normal',name:`Card ${group}-${i}`,set:'Origins',image:`https://images.example/${group}-${i}`,rarity,section,cents:100+group*100+i})));
const option=id=>INVESTIGATIONS.find(row=>row.id===id);
const fresh=()=>beginAuction(initialAuctionSave(),pool,1000,pool,42);

test('versioned scans and identities use approved quantities/costs without rewriting legacy effects',()=>{
 const auction={...fresh().auction,known:[],priced:[]};
 for(const [id,count,cost] of [['reveal5',5,600],['rare12',12,600],['epic6',6,1000],['alt4',4,1200],['chase-scan-v2',1,4500]]){
  const result=investigate(auction,option(id));assert.equal(option(id).cost,cost);assert.equal(result.priced.length,count);assert.equal(result.known.length,count);
 }
 for(const [id,count,cost] of [['identity5',5,300],['rare-identity8',8,400],['epic-identity5',5,600],['identity12',12,1000],['chase-identity-v2',1,2500]]){
  const result=investigate(auction,option(id));assert.equal(option(id).cost,cost);assert.equal(result.known.length,count);assert.deepEqual(result.priced,[]);
 }
 assert.equal(investigate(auction,option('reveal3')).priced.length,3);assert.equal(option('reveal3').cost,1200);
});

test('larger cheaper markers disclose only matching rarities, including chase treatment',()=>{
 const auction={...fresh().auction,known:[],priced:[]};
 for(const [id,count,band,cost] of [['rarity-peek12',12,null,400],['rare-mark12',12,'rare',300],['epic-mark8',8,'epic',400],['alt-mark5',5,'alt',500],['chase-mark-v2',1,'signature',1000]]){
  const result=investigate(auction,option(id));assert.equal(result.rarityKnown.length,count);assert.equal(option(id).cost,cost);assert.deepEqual(result.known,[]);assert.deepEqual(result.priced,[]);assert.ok(!result.clue.text.includes('Card '));
  if(band)assert.ok(result.rarityKnown.every(slot=>auctionRarityBand(pool[slot])===band));
 }
});

test('Lot Audit combines disclosed counts and a marker; census separates treatments without prices',()=>{
 const auction={...fresh().auction,known:[],priced:[]},audit=investigate(auction,option('lot-audit'));
 assert.equal(option('lot-audit').cost,400);assert.match(audit.clue.text,/Common copies: 15/);assert.match(audit.clue.text,/Uncommon copies: 15/);assert.match(audit.clue.text,/Duplicate copies: 0/);assert.match(audit.clue.text,/Origins: 90/);assert.equal(audit.rarityKnown.length,1);assert.deepEqual(audit.priced,[]);
 const census=investigate(auction,option('rarities-v2'));assert.match(census.clue.text,/Epic: 15/);assert.match(census.clue.text,/Alt Art: 15/);assert.match(census.clue.text,/Signature: 15/);assert.deepEqual(census.known,[]);
 assert.deepEqual(valuationClues([audit.clue]).map(clue=>clue.text),['15 copies.','15 copies.','0 copies.']);
});

test('price checks retain exact whole-lot counts but mark only one hidden qualifying rarity',()=>{
 const auction={...fresh().auction,known:[],priced:[]};
 const result=investigate(auction,option('over5-mark'));assert.equal(option('over5-mark').cost,1500);assert.match(result.clue.text,/29 copies above \$5/);assert.equal(result.rarityKnown.length,1);assert.ok(pool[result.rarityKnown[0]].cents>500);assert.deepEqual(result.priced,[]);
 const empty=investigate(auction,option('over20-mark'));assert.match(empty.clue.text,/0 copies/);assert.equal(empty.rarityKnown.length,0);
});

test('follow-up requires an earlier private rarity marker, a selected eligible slot and one purchase per round',()=>{
 let save=fresh();save.auction.offers=[option('rare-mark12')];save=buyInformation(save,'rare-mark12',1100);
 assert.equal(followUpSlots(save.auction).length,0);
 save=nextAuctionRound({...save,auction:{...save.auction,stage:'reveal'}},2000);save.auction.offers=[option('follow-up')];
 const targets=followUpSlots(save.auction),before=knownValue(save.auction);assert.ok(targets.length>0);
 assert.equal(buyInformation(save,'follow-up',2100),save);assert.equal(buyInformation(save,'follow-up',2100,999),save);
 const corrupt={...save,auction:{...save.auction,clues:[...save.auction.clues,{id:'rare-mark12',label:'Legacy Marker',text:'',round:1,reveals:[{slot:349,visibility:'rarity'}]}]}};
 assert.ok(!followUpSlots(corrupt.auction).includes(349));assert.equal(buyInformation(corrupt,'follow-up',2100,349),corrupt);
 const target=targets.at(-1),bought=buyInformation(save,'follow-up',2100,target);
 assert.equal(bought.wallet.cash,save.wallet.cash-800);assert.ok(bought.auction.priced.includes(target));assert.equal(knownValue(bought.auction),before+pool[target].cents);assert.deepEqual(bought.auction.clues.at(-1).reveals,[{slot:target,visibility:'price'}]);assert.deepEqual(parseAuctionSave(JSON.stringify(bought)),bought);
 assert.equal(buyInformation(bought,'follow-up',2200,targets[0]),bought);
});

test('round-four Top-Two uses explicit free/paid prices, suppresses already known results, and saves correctly',()=>{
 for(const kind of ['free','paid']){
  const auction={...fresh().auction,kind,entryFee:kind==='paid'?5000:0},row=option('top2-final'),cost=kind==='paid'?12500:7500;
  assert.equal(rebalancedCost(row,auction),cost);
  for(const round of [1,2,3])assert.equal(informationUseful({...auction,round},row.id),false);
  assert.equal(informationUseful({...auction,round:4},row.id),true);
  const save={...fresh(),auction:{...auction,round:4,offers:[{...row,cost}]}};
  const bought=buyInformation(save,row.id,1100);assert.equal(bought.wallet.cash,250000-cost);assert.deepEqual(parseAuctionSave(JSON.stringify(bought)),bought);
  assert.equal(informationUseful({...auction,round:4,priced:[88,89]},row.id),false);
 }
});

test('new menus exclude retired definitions but allow zero-information choices while historic offers remain buyable',()=>{
 const ids=new Set(REBALANCED_INVESTIGATIONS.map(row=>row.id));
 for(let seed=0;seed<100;seed++)for(let round=1;round<=4;round++){
  const offers=informationOffers({...fresh().auction,seed,round});assert.equal(new Set(offers.map(row=>row.id)).size,offers.length);assert.ok(offers.every(row=>ids.has(row.id)));
  assert.ok(offers.filter(row=>row.id==='top2-final').every(()=>round===4));
 }
 const save=fresh();save.auction.offers=[option('rare8')];assert.deepEqual(parseAuctionSave(JSON.stringify(save)),save);assert.equal(buyInformation(save,'rare8',1100).wallet.cash,248500);
 const full={...save.auction,known:pool.map((_,i)=>i),priced:pool.map((_,i)=>i)};assert.deepEqual(informationOffers(full),informationOffers(save.auction));
});

test('concentration is a broad share band, not an exact percentage or a collection-value appraisal',()=>{
 const auction=fresh().auction,result=investigate(auction,option('concentration'));
 assert.match(result.clue.text,/Low concentration/);assert.ok(!result.clue.text.includes('$'));assert.deepEqual(result.known,auction.known);assert.deepEqual(result.priced,auction.priced);
});
