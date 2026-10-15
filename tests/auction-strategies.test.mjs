import assert from 'node:assert/strict';
import test from 'node:test';
import {AUCTION_NPCS} from '../core/domain/auction-npcs.ts';
import {INVESTIGATIONS} from '../core/domain/auction-information.ts';
import {chooseNpcInvestigation,npcRoundInformation,NPC_INVESTIGATION_IDS} from '../core/domain/auction-npc-information.ts';
import {AUCTION_LOT_THEMES,auctionLotTheme,auctionThemeSet} from '../core/domain/auction-lot-themes.ts';
import {generateAuctionLot} from '../core/domain/auction-lots.ts';
import {auctionRarityBand} from '../core/domain/auction-copy-policy.ts';
import {beginAuction} from '../core/domain/auction-engine.ts';
import {initialAuctionSave} from '../core/domain/auction-types.ts';
import {parseAuctionSave} from '../core/domain/auction-save.ts';
import {publicAuctionSlots} from '../core/domain/auction-public.ts';

const tiers=[['Common','commons'],['Uncommon','uncommons'],['Rare','rares'],['Epic','epics'],['Epic','alt-arts'],['Epic','overnumbered'],['Epic','signatures']];
const pool=['Origins','Spiritforged','Unleashed'].flatMap((set,s)=>tiers.flatMap(([rarity,section],t)=>Array.from({length:30},(_,i)=>({productId:1+s*210+t*30+i,printing:'Normal',name:`Card ${s}-${t}-${i}`,image:`https://image.example/${s}-${t}-${i}`,set,rarity,section,cents:100}))));

test('every NPC weights its own strategy, keeps seeded variety and safely falls back',()=>{
 const choices=INVESTIGATIONS.filter(option=>NPC_INVESTIGATION_IDS.includes(option.id));
 assert.equal(new Set(AUCTION_NPCS.map(npc=>npc.strategy)).size,AUCTION_NPCS.length);
 for(const npc of AUCTION_NPCS){
  const counts=new Map();
  for(let seed=0;seed<2000;seed++){
   const chosen=chooseNpcInvestigation(choices,npc.name,seed);
   assert.deepEqual(chosen,chooseNpcInvestigation(choices,npc.name,seed));counts.set(chosen.id,(counts.get(chosen.id)??0)+1);
  }
  assert.ok(counts.get(npc.cluePriority[0])>800,npc.name);
  const preferred=npc.cluePriority.reduce((sum,id)=>sum+(counts.get(id)??0),0);assert.ok(preferred>1700,npc.name);
  assert.ok(counts.size>4);assert.equal(chooseNpcInvestigation([],npc.name,1),undefined);
  assert.equal(chooseNpcInvestigation([choices[0]],npc.name,1),choices[0]);
 }
});

test('NPC rarity scans learn only inspected prices and do not extrapolate a targeted hit across the lot',()=>{
 const auction=beginAuction(initialAuctionSave(),pool,1000,pool.slice(0,90),42).auction;
 let matched;
 for(let seed=0;seed<100;seed++){
  const next={...auction,seed},info=npcRoundInformation(next,0,[1,3,4,5],undefined,'The Opportunist');
  if(info.investigations.at(-1)==='rare8'){matched={next,info};break}
 }
 assert.ok(matched);const {next,info}=matched;
 const observed=new Set([...publicAuctionSlots(next),1,3,4,5]),scanned=info.inspected.find(slot=>!observed.has(slot));assert.ok(scanned!==undefined);
 const changed={...next,lot:next.lot.map((card,index)=>index===scanned?{...card,cents:card.cents+10000}:card)};
 const increased=npcRoundInformation(changed,0,[1,3,4,5],undefined,'The Opportunist');
 assert.equal(increased.estimate-info.estimate,10000);
 const unknown=next.lot.findIndex((_,index)=>!info.inspected.includes(index));assert.ok(unknown>=0);
 assert.equal(npcRoundInformation({...next,lot:next.lot.map((card,index)=>index===unknown?{...card,cents:999999}:card)},0,[1,3,4,5],undefined,'The Opportunist').estimate,info.estimate);
});

test('five themes yield distinct mixes and expansion focus in both modes without breaking budgets',()=>{
 const stats=new Map();
 for(const kind of ['free','paid'])for(let seed=0;seed<300;seed++){
  const lot=generateAuctionLot(pool,seed,kind),theme=auctionLotTheme(seed),key=`${kind}:${theme.id}`;
  const stat=stats.get(key)??{total:0,bulk:0,premium:0,focus:0,rares:0};stats.set(key,stat);
  assert.ok(lot.length>=(kind==='free'?25:50)&&lot.length<=(kind==='free'?90:130));assert.ok(lot.reduce((sum,card)=>sum+card.cents,0)<=200000);
  for(const card of lot){const band=auctionRarityBand(card);stat.total++;if(['common','uncommon'].includes(band))stat.bulk++;else if(band==='rare')stat.rares++;else stat.premium++;if(card.set===auctionThemeSet(pool,seed))stat.focus++}
 }
 for(const kind of ['free','paid']){
  const get=id=>stats.get(`${kind}:${id}`),share=(id,key)=>get(id)[key]/get(id).total;
  assert.ok(share('bulk-seller','bulk')>share('chase-collector','bulk')+.3);
  assert.ok(share('chase-collector','premium')>share('bulk-seller','premium')+.2);
  assert.ok(share('deck-builder','rares')>share('bulk-seller','rares')+.15);
  assert.ok(share('set-collector','focus')>share('trade-binder','focus')+.35);
 }
 for(const theme of AUCTION_LOT_THEMES){assert.ok(stats.has(`free:${theme.id}`));assert.ok(stats.has(`paid:${theme.id}`));assert.ok(stats.get(`paid:${theme.id}`).premium/stats.get(`paid:${theme.id}`).total>stats.get(`free:${theme.id}`).premium/stats.get(`free:${theme.id}`).total)}
});

test('theme identity persists, invalid IDs are rejected and unthemed legacy auctions stay unthemed',()=>{
 const save=beginAuction(initialAuctionSave(),pool,1000,undefined,42);
 assert.equal(save.auction.lotTheme,auctionLotTheme(42).id);assert.deepEqual(parseAuctionSave(JSON.stringify(save)),save);
 const legacy=structuredClone(save);delete legacy.auction.lotTheme;assert.equal(parseAuctionSave(JSON.stringify(legacy)).auction.lotTheme,undefined);
 save.auction.lotTheme='unknown';assert.throws(()=>parseAuctionSave(JSON.stringify(save)));
});
