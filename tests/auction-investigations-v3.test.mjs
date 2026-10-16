import assert from 'node:assert/strict';
import test from 'node:test';
import {beginAuction,buyInformation,nextAuctionRound,tickAuction} from '../core/domain/auction-engine.ts';
import {initialAuctionSave} from '../core/domain/auction-types.ts';
import {INVESTIGATIONS,CURRENT_INVESTIGATIONS,informationOffers,investigate} from '../core/domain/auction-information.ts';
import {coreInvestigationCard,combinedMarkerCard,combinedIdentityCard,RETIRED_V2_INVESTIGATIONS} from '../core/domain/auction-investigations-v3.ts';
import {npcRoundInformation} from '../core/domain/auction-npc-information.ts';
import {npcInvestigationRounds} from '../core/domain/auction-npc-schedule.ts';
import {auctionClueReveals} from '../core/domain/auction-clue-reveals.ts';
import {auctionRoundBid} from '../core/domain/auction-display.ts';
import {npcKnowledgeValue} from '../core/domain/auction-npc-valuation.ts';
import {parseAuctionSave} from '../core/domain/auction-save.ts';

const pool=[['Common','commons'],['Uncommon','uncommons'],['Rare','rares'],['Epic','epics'],['Epic','alt-arts'],['Showcase','overnumbered'],['Showcase','signatures'],['Promo','metal-promos']].flatMap(([rarity,section],group)=>Array.from({length:10},(_,i)=>({productId:group*10+i+1,printing:'Normal',name:section==='metal-promos'?`Card ${i} (Metal)`:`Card ${group}-${i}`,set:'Origins',rarity,section,image:`https://images.example/${group}-${i}`,cents:100+group*100+i})));
const option=id=>INVESTIGATIONS.find(row=>row.id===id);
const fresh=()=>beginAuction(initialAuctionSave(),pool,1000,pool,42);
const hidden=()=>({...fresh().auction,known:[],priced:[],rarityKnown:[],publicReveals:[]});

test('new census discloses one combined premium/special count, not its hidden composition',()=>{
 const auction=hidden(),result=investigate(auction,option('rarities-v3'));
 assert.match(result.clue.text,/Chase \/ Special: 30/);assert.ok(!/Signature:|Overnumbered:|Metal:/.test(result.clue.text));
 assert.deepEqual(result.known,[]);assert.deepEqual(result.priced,[]);assert.deepEqual(result.rarityKnown,[]);
 const changed={...auction,lot:auction.lot.map(card=>card.section==='signatures'?{...card,section:'overnumbered',cents:999999}:card)};
 assert.equal(investigate(changed,option('rarities-v3')).clue.text,result.clue.text);
 const old=investigate(auction,option('rarities-v2'));assert.match(old.clue.text,/Signature: 10/);assert.match(old.clue.text,/Overnumbered: 10/);
 const knowledge={count:auction.lot.length,observed:[],random:[],prior:auction.marketPrior,round:4};
 assert.equal(npcKnowledgeValue({...knowledge,clues:[old.clue,result.clue]}).estimate,npcKnowledgeValue({...knowledge,clues:[old.clue]}).estimate);
});

test('combined markers and identities enforce counts, rarity/treatment exclusions and visibility',()=>{
 for(const [id,matches,field] of [['core-mark10',combinedMarkerCard,'rarityKnown'],['core-identity10',combinedIdentityCard,'known']]){
  const auction=hidden(),result=investigate(auction,option(id));assert.equal(result[field].length,10);assert.ok(result[field].every(slot=>matches(auction.lot[slot])));assert.deepEqual(result.priced,[]);
  assert.deepEqual(result[id==='core-mark10'?'known':'rarityKnown'],[]);
  assert.ok(auctionClueReveals(auction,result).every(reveal=>reveal.visibility===(id==='core-mark10'?'rarity':'identity')));
  const empty={...auction,lot:pool.filter(card=>!matches(card))};assert.deepEqual(investigate(empty,option(id))[field],[]);
 }
 const t1={...pool[20],set:'T1 2025 Worlds Champion Bundle'},metal={...pool[20],name:'Card (Metal)'};
 for(const card of [t1,metal,pool[50],pool[60],pool[70]])assert.equal(combinedMarkerCard(card),false);
});

test('expanded bulk and alt valuations have exact disjoint scopes, approved prices and legacy meanings',()=>{
 const auction=hidden(),bulk=investigate(auction,option('bulk-core-v3')),alt=investigate(auction,option('alt-value-v3'));
 assert.equal(option('bulk-core-v3').cost,800);assert.equal(option('alt-value-v3').cost,1000);
 assert.equal(bulk.clue.text,`$${(pool.filter(coreInvestigationCard).reduce((s,c)=>s+c.cents,0)/100).toFixed(2)}`);
 assert.equal(alt.clue.text,`$${(pool.slice(40,50).reduce((s,c)=>s+c.cents,0)/100).toFixed(2)}`);
 assert.deepEqual(bulk.known,[]);assert.deepEqual(alt.priced,[]);
 assert.equal(option('bulk-v2').cost,500);assert.equal(investigate(auction,option('bulk-v2')).clue.text,`$${(pool.slice(0,20).reduce((s,c)=>s+c.cents,0)/100).toFixed(2)}`);
 const observed=[pool[0],pool[40]],total=pool.slice(0,40).reduce((s,c)=>s+c.cents,0)+pool[40].cents;
 assert.ok(npcKnowledgeValue({count:80,observed,random:[],clues:[bulk.clue],prior:auction.marketPrior,round:4,kind:'paid'}).estimate>=total);
});

test('Lot Audit reports repeated printing counts with identity-only representatives and three rarity markers',()=>{
 const auction={...hidden(),lot:[...pool.slice(0,60),pool[20],pool[20],pool[21],pool[21],pool[30],pool[30],pool[60],pool[60]]},result=investigate(auction,option('lot-audit-v3'));
 assert.equal(result.known.length,3);assert.ok(result.known.every(slot=>coreInvestigationCard(auction.lot[slot])));assert.equal(result.rarityKnown.length,3);assert.deepEqual(result.priced,[]);
 assert.match(result.clue.text,/Card 2-0 \(Normal\): 3 copies/);assert.ok(!result.clue.text.includes('Card 6-0'));assert.ok(!result.clue.text.includes('$'));
 assert.ok(auctionClueReveals(auction,result).every(reveal=>reveal.visibility!=='price'));
});

test('new menus retire superseded options, name scan rarities explicitly, and preserve saved offered rules',()=>{
 assert.equal(CURRENT_INVESTIGATIONS.length,23);
 for(let seed=0;seed<50;seed++)assert.ok(informationOffers({...hidden(),seed}).every(row=>!RETIRED_V2_INVESTIGATIONS.includes(row.id)));
 for(const [id,word] of [['rare12','12 RARE'],['epic6','6 EPIC'],['alt4','4 ALT-ART']])assert.ok(option(id).description.includes(word));
 for(const id of [...RETIRED_V2_INVESTIGATIONS,...CURRENT_INVESTIGATIONS.map(row=>row.id)]){const save=fresh();save.auction.offers=[option(id)];assert.deepEqual(parseAuctionSave(JSON.stringify(save)),save);}
});

test('NPCs receive no automatic private samples or legacy array knowledge outside recorded clues',()=>{
 for(const kind of ['free','paid'])for(let seed=0;seed<20;seed++)assert.ok(beginAuction(initialAuctionSave(),pool,1000,pool,seed,kind).auction.npcs.every(npc=>npc.sample.length===0));
 const auction=hidden(),seed=Array.from({length:100},(_,i)=>i).find(seed=>!npcInvestigationRounds(seed,'The Closer').includes(1)),base={...auction,seed,round:1};
 const previous={name:'The Closer',sample:[30],inspected:[30],identified:[30],investigations:[],findings:[]};
 const first=npcRoundInformation(base,0,[30],previous,'The Closer'),changed={...base,lot:base.lot.map((card,slot)=>slot===30?{...card,cents:999999}:card)};
 assert.deepEqual(first.prices,[]);assert.equal(npcRoundInformation(changed,0,[30],previous,'The Closer').estimate,first.estimate);
 const publicSlot=30,publicAuction={...base,publicReveals:[{round:1,slots:[publicSlot]}],known:[30],priced:[30]};
 assert.deepEqual(npcRoundInformation(publicAuction,0,[],undefined,'The Closer').prices,[base.lot[30].cents]);
 const retained={...previous,findings:[{id:'reveal5',label:'Scan',text:'1 copy.',round:1,reveals:[{slot:31,visibility:'price'}]}]};
 assert.deepEqual(npcRoundInformation(base,0,[],retained,'The Closer').prices,[base.lot[31].cents]);
});

test('player bid history records current investigation only and normalizes cumulative legacy snapshots',()=>{
 let save=fresh();
 for(const [round,id] of [[1,'core-mark10'],[2,'bulk-core-v3'],[3,null]]){
  if(id){save.auction.offers=[option(id)];save=buyInformation(save,id,save.auction.deadline-1000);}
  save=tickAuction({...save,auction:{...save.auction,selected:1,npcs:save.auction.npcs.map(npc=>({...npc,bid:1,locked:true}))}},save.auction.deadline);
  assert.deepEqual(save.auction.bidHistory.at(-1)[0].notes.map(clue=>clue.id),id?[id]:[]);
  if(round<3)save=nextAuctionRound(save,save.auction.deadline+1);
 }
 const a={id:'a',label:'A',text:'first'},b={id:'b',label:'B',text:'second'},first={name:'You',cents:1,notes:[a]},second={name:'You',cents:2,notes:[a,b]},third={name:'You',cents:3,notes:[a,b]};
 const auction={bidHistory:[[first],[second],[third]]};assert.deepEqual(auctionRoundBid(auction,second,2).notes,[b]);assert.deepEqual(auctionRoundBid(auction,third,3).notes,[]);
 assert.deepEqual(second.notes,[a,b]);assert.equal(save.auction.clues.length,2);
});

test('NPC grouped census cannot recover hidden premium composition or exact prices',()=>{
 let found;
 for(let seed=0;seed<100;seed++){const auction={...fresh().auction,seed},info=npcRoundInformation(auction,0,[],undefined,'The Archivist');if(info.investigations.at(-1)==='rarities-v4'){found={auction,info};break;}}
 assert.ok(found);const {auction,info}=found,slot=auction.lot.findIndex((card,slot)=>card.section==='signatures'&&!info.inspected.includes(slot));assert.ok(slot>=0);
 const changed={...auction,lot:auction.lot.map((card,index)=>index===slot?{...card,section:'overnumbered',cents:9999999}:card)};
 assert.equal(npcRoundInformation(changed,0,[],undefined,'The Archivist').estimate,info.estimate);
 const all=npcKnowledgeValue({count:auction.lot.length,observed:auction.lot,random:auction.lot,clues:info.findings,prior:auction.marketPrior,round:4});
 assert.equal(all.estimate,auction.lot.reduce((sum,card)=>sum+card.cents,0));
});
