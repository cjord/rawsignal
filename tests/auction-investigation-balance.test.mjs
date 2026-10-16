import assert from 'node:assert/strict';
import test from 'node:test';
import {beginAuction,buyInformation} from '../core/domain/auction-engine.ts';
import {initialAuctionSave} from '../core/domain/auction-types.ts';
import {INVESTIGATIONS,RETIRED_INVESTIGATION_IDS,PRE_BALANCE_INVESTIGATION_COSTS,informationOffers,informationUseful,investigate,knownValue} from '../core/domain/auction-information.ts';
import {auctionValueBand} from '../core/domain/auction-value-band.ts';
import {parseAuctionSave} from '../core/domain/auction-save.ts';
import {npcKnowledgeValue} from '../core/domain/auction-npc-valuation.ts';
import {npcRoundInformation} from '../core/domain/auction-npc-information.ts';

const bands=[['Common','commons'],['Uncommon','uncommons'],['Rare','rares'],['Epic','epics'],['Epic','alt-arts'],['Epic','signatures']];
const pool=bands.flatMap(([rarity,section],tier)=>Array.from({length:15},(_,i)=>({productId:tier*15+i+1,printing:'Normal',name:`Secret ${tier}-${i}`,image:`https://images.example/${tier}-${i}`,set:'Origins',rarity,section,cents:100+tier*100+i})));
const option=id=>INVESTIGATIONS.find(option=>option.id===id);
const fresh=()=>beginAuction(initialAuctionSave(),pool,1000,pool,42);

test('approved investigation prices, enlarged scans and marker limits match the balance',()=>{
 for(const [id,cost] of [['rarity-peek8',400],['rare-mark8',600],['epic-mark5',1000],['alt-mark3',1200],['highest-rarity',800],['common-count',200],['uncommon-count',300],['rare8',1500],['epic5',2000],['alt3',3000],['over5',1500],['over20',2500],['rares',1500],['rarities',1200],['value-band4',3000],['chase1',6500]])assert.equal(option(id).cost,cost,id);
 const auction={...fresh().auction,known:[],priced:[]};
 for(const [id,count] of [['rarity-peek8',8],['rare-mark8',8],['epic-mark5',5],['alt-mark3',3]]){
  const result=investigate(auction,option(id));assert.equal(result.rarityKnown.length,count);assert.deepEqual(result.known,[]);assert.deepEqual(result.priced,[]);assert.ok(!result.clue.text.includes('Secret'));
 }
 for(const [id,count] of [['rare8',8],['epic5',5],['alt3',3],['rare-identity5',5],['epic-identity3',3]]){
  const result=investigate(auction,option(id));assert.equal(result.known.length,count,id);assert.equal(result.priced.length,id.includes('identity')?0:count,id);
 }
});

test('count-only clues count every copy including known cards, reveal zero identities/prices and are redundant after census',()=>{
 const auction=fresh().auction,before=knownValue(auction);
 for(const id of ['common-count','uncommon-count']){
  const result=investigate(auction,option(id));assert.match(result.clue.text,/^15 /);assert.deepEqual(result.known,auction.known);assert.deepEqual(result.priced,auction.priced);assert.equal(knownValue({...auction,...result}),before);
  const counted={...auction,clues:[{id:'rarities',label:'Rarity Census',text:'Common: 15'}]};assert.equal(informationUseful(counted,id),false);
 }
 const empty={...auction,lot:auction.lot.filter(card=>card.rarity!=='Common')};assert.match(investigate(empty,option('common-count')).clue.text,/^0 common/);assert.equal(informationUseful(empty,'common-count'),false);
});

test('top-card rarity marks its precise location without revealing identity/artwork/price and persists safely',()=>{
 const save=fresh(),slot=save.auction.lot.findIndex((_,i)=>!save.auction.known.includes(i));save.auction.lot[slot].cents=99999;save.auction.offers=[option('highest-rarity')];
 const bought=buyInformation(save,'highest-rarity',1100),result=bought.auction;
 assert.equal(result.topCardSlot,slot);assert.ok(result.rarityKnown.includes(slot));assert.deepEqual(result.known,save.auction.known);assert.deepEqual(result.priced,save.auction.priced);assert.equal(knownValue(result),knownValue(save.auction));assert.equal(bought.wallet.cash,249200);
 assert.ok(!JSON.stringify(result.clues).includes('Secret'));assert.ok(!JSON.stringify(result.clues).includes('999'));assert.deepEqual(parseAuctionSave(JSON.stringify(bought)),bought);
 const invalid=structuredClone(bought);invalid.auction.topCardSlot=999;assert.throws(()=>parseAuctionSave(JSON.stringify(invalid)));
 const unmarked=structuredClone(bought);unmarked.auction.rarityKnown=[];assert.throws(()=>parseAuctionSave(JSON.stringify(unmarked)));
});

test('retired value bands preserve historical boundaries but cannot be offered or purchased',()=>{
 for(const [value,low,high] of [[0,0,250],[24999,0,250],[25000,250,1000],[99999,250,1000],[100000,1000,2000],[200000,1000,2000]]){
  const text=auctionValueBand(value);assert.ok(text.includes(`$${low.toFixed(2)}`)&&text.includes(`$${high.toFixed(2)}`));assert.match(text,/before fees/);
 }
 assert.equal(auctionValueBand(30000),auctionValueBand(45000));assert.match(auctionValueBand(200001),/\$2000.00\+/);
 for(let round=1;round<=4;round++)assert.equal(informationUseful({...fresh().auction,round},'value-band4'),false);
 const observed=pool.slice(0,2),clues=[{id:'value-band4',label:'Collection Value Band',text:auctionValueBand(30000)}];
 const valuation=npcKnowledgeValue({count:50,observed,random:observed,clues});assert.equal(valuation.estimate,25000);assert.equal(valuation.certainty,.5);
 const old=fresh();old.auction.offers=[option('value-band')];assert.equal(parseAuctionSave(JSON.stringify(old)).auction.offers.length,0);assert.equal(buyInformation(old,'value-band',1100),old);
 for(const round of [1,2,3,4]){const early=fresh();early.auction.round=round;early.auction.offers=[option('value-band4')];assert.equal(buyInformation(early,'value-band4',1100),early);assert.equal(parseAuctionSave(JSON.stringify(early)).auction.offers.length,0)}
 const legacy=investigate(fresh().auction,option('value-band'));assert.match(legacy.clue.text,/\$250.00–under \$500.00/);
 assert.ok(Number.isFinite(npcKnowledgeValue({count:350,observed:[],random:[],clues:[{...clues[0],text:auctionValueBand(250000)}]}).estimate));
});

test('new offers retire obsolete clues, exclude exhausted scans and avoid redundant census counts',()=>{
 for(let seed=0;seed<80;seed++)for(let round=1;round<=4;round++){
  const auction={...fresh().auction,seed,round};for(const offer of informationOffers(auction)){assert.ok(!RETIRED_INVESTIGATION_IDS.includes(offer.id));if(offer.id==='value-band4')assert.equal(round,4)}
 }
 const exhausted={...fresh().auction,known:pool.map((_,i)=>i),priced:pool.map((_,i)=>i)};
 for(const id of ['rare8','epic5','alt3','chase1','rare-mark8'])assert.equal(informationUseful(exhausted,id),false);
});

test('legacy offered effects and prices survive reload without silently changing their meaning',()=>{
 const save=fresh();
 for(const id of ['common3','rare2','rare-mark2','highest','appraisal']){
  save.auction.offers=[option(id)];assert.deepEqual(parseAuctionSave(JSON.stringify(save)),save);
  const base={...save.auction,known:[],priced:[]},result=investigate(base,option(id));
  if(id==='common3')assert.equal(result.priced.length,3);
  if(id==='rare2')assert.equal(result.priced.length,2);
  if(id==='rare-mark2')assert.equal(result.rarityKnown.length,2);
  if(id==='highest')assert.equal(result.known.length,1);
  if(id==='appraisal')assert.match(result.clue.text,/game appraisal estimate/);
 }
 for(const [id,cost] of Object.entries(PRE_BALANCE_INVESTIGATION_COSTS)){save.auction.offers=[{...option(id),cost}];assert.deepEqual(parseAuctionSave(JSON.stringify(save)),save)}
});

test('NPC count investigations do not learn unseen prices or reuse the player’s private census',()=>{
 let matched;
 for(let seed=0;seed<100;seed++){
  const auction={...fresh().auction,seed,clues:[{id:'rarities',label:'Player secret',text:'Secret'}]},info=npcRoundInformation(auction,0,[],undefined,'The Bargain Hunter');
  if(info.investigations.at(-1)==='lot-audit'){matched={auction,info};break}
 }
 assert.ok(matched);const {auction,info}=matched,hidden=auction.lot.findIndex((card,i)=>!info.inspected.includes(i)&&card.rarity==='Rare');assert.ok(hidden>=0);
 const changed={...auction,lot:auction.lot.map((card,i)=>i===hidden?{...card,cents:999999}:card)};
 assert.equal(npcRoundInformation(changed,0,[],undefined,'The Bargain Hunter').estimate,info.estimate);
});

test('private findings persist their purchase round, reject invalid round tags and preserve legacy purchased bands',()=>{
 const save=fresh();save.auction.offers=[option('common-count')];
 const bought=buyInformation(save,'common-count',1100);assert.equal(bought.auction.clues[0].round,1);assert.deepEqual(parseAuctionSave(JSON.stringify(bought)),bought);
 for(const round of [0,2,5,'1']){const invalid=structuredClone(bought);invalid.auction.clues[0].round=round;assert.throws(()=>parseAuctionSave(JSON.stringify(invalid)))}
 const legacy=structuredClone(bought);legacy.auction.clues=[{id:'value-band4',label:'Collection Value Band',text:auctionValueBand(30000)}];assert.deepEqual(parseAuctionSave(JSON.stringify(legacy)),legacy);
});

test('finding popups persist only newly disclosed slots and the allowed knowledge level, not duplicate price values',()=>{
 for(const [id,visibility] of [['reveal3','price'],['identity3','identity'],['rare-mark8','rarity']]){
  const save=fresh();save.auction.offers=[option(id)];const bought=buyInformation(save,id,1100),reveals=bought.auction.clues[0].reveals;
  assert.ok(reveals.length>0);assert.ok(reveals.every(reveal=>reveal.visibility===visibility));assert.ok(reveals.every(reveal=>Object.keys(reveal).sort().join(',')==='slot,visibility'));
  assert.ok(reveals.every(reveal=>visibility==='price'?!save.auction.priced.includes(reveal.slot):visibility==='identity'?!save.auction.known.includes(reveal.slot):!save.auction.rarityKnown?.includes(reveal.slot)));
  assert.deepEqual(parseAuctionSave(JSON.stringify(bought)),bought);
  for(const invalidReveal of [{slot:-1,visibility},{slot:999,visibility},{slot:1,visibility:'secret'}]){const invalid=structuredClone(bought);invalid.auction.clues[0].reveals=[invalidReveal];assert.throws(()=>parseAuctionSave(JSON.stringify(invalid)))}
 }
});
