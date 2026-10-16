import assert from 'node:assert/strict';
import test from 'node:test';
import {beginAuction,buyInformation,lockBid,tickAuction,finishAuction,leaveAuction} from '../core/domain/auction-engine.ts';
import {initialAuctionSave} from '../core/domain/auction-types.ts';
import {parseAuctionSave,validDailyManifest} from '../core/domain/auction-save.ts';
import {informationOffers,INVESTIGATIONS} from '../core/domain/auction-information.ts';
import {npcInvestigationRounds} from '../core/domain/auction-npc-schedule.ts';
import {AUCTION_NPCS} from '../core/domain/auction-npcs.ts';
import {createDailyAuctionManifest,startDailyAuction,updateDailyAuction} from '../core/domain/auction-daily.ts';

const catalog=Array.from({length:200},(_,index)=>({productId:index+1,printing:'Normal',name:`Card ${index}`,image:`https://images.example/${index}`,set:'Origins',rarity:['Common','Uncommon','Rare','Epic'][index%4],section:['commons','uncommons','rares','epics'][index%4],cents:5000}));
const now=Date.parse('2026-10-16T12:00:00Z');
test('statistics count settlement once, distinguish abandonment and survive reload; legacy data is not invented',()=>{
 let save=beginAuction(initialAuctionSave(),catalog,now);
 const offer=save.auction.offers[0];save=buyInformation(save,offer.id,now+1);
 save={...save,auction:{...save.auction,npcs:save.auction.npcs.map(npc=>({...npc,bid:100,locked:true}))}};
 save=lockBid(save,1000,now+2);save=tickAuction(save,now+3);
 assert.equal(save.statistics.won,1);assert.equal(save.statistics.settled,1);assert.equal(save.statistics.investigations,offer.cost);assert.equal(save.statistics.profit,save.auction.result.net);
 assert.equal(tickAuction(save,now+100000),save);assert.deepEqual(parseAuctionSave(JSON.stringify(save)),save);
 save=beginAuction(finishAuction(save),catalog,now,undefined,42,'paid');save=leaveAuction(save,42);
 assert.equal(save.statistics.started,2);assert.equal(save.statistics.abandoned,1);assert.equal(save.statistics.entryFees,5000);assert.equal(save.statistics.profit,save.statistics.bestProfit-5000);
 assert.equal(parseAuctionSave(JSON.stringify(initialAuctionSave())).statistics,undefined);
});
test('offers never reveal hidden card composition; basic options rotate and follow-up is guaranteed when eligible',()=>{
 const auction=beginAuction(initialAuctionSave(),catalog,now).auction;
 assert.deepEqual(informationOffers(auction),informationOffers({...auction,lot:auction.lot.map(card=>({...card,rarity:'Signature',section:'signatures',cents:999999}))}));
 const seen=new Set();for(let seed=0;seed<300;seed++)for(let round=1;round<=4;round++)for(const option of informationOffers({...auction,seed,round}))seen.add(option.id);
 assert.ok(INVESTIGATIONS.filter(option=>!['follow-up'].includes(option.id)&&option.id.endsWith('-final')).every(option=>seen.has(option.id)));
 const candidate={...auction,round:2,clues:[{id:'rare-mark12',label:'Rare Markers',text:'',round:1,reveals:[{slot:auction.lot.findIndex((_,slot)=>!auction.priced.includes(slot)),visibility:'rarity'}]}]};
 assert.equal(informationOffers(candidate).length,4);assert.ok(informationOffers(candidate).some(option=>option.id==='follow-up'));assert.deepEqual(parseAuctionSave(JSON.stringify({...beginAuction(initialAuctionSave(),catalog,now),auction:candidate})).auction.clues,candidate.clues);
});
test('NPC schedules are seeded, half allow all four rounds and the Closer saves choices for late rounds',()=>{
 let full=0;for(let seed=0;seed<10000;seed++){
  const rounds=npcInvestigationRounds(seed,'The Collector');assert.ok(rounds.length===3||rounds.length===4);if(rounds.length===4)full++;
  for(const npc of AUCTION_NPCS)assert.equal(npcInvestigationRounds(seed,npc.name).length,rounds.length);
  if(rounds.length===3)assert.deepEqual(npcInvestigationRounds(seed,'The Closer'),[2,3,4]);
 }
 assert.ok(full>4800&&full<5200);
});
test('daily lineup is fixed, browser attempt and cash are separate, all five auto-sell and reward is credited exactly once',()=>{
 const manifest=createDailyAuctionManifest(catalog,'2026-10-16','test-run');assert.ok(validDailyManifest(manifest));assert.deepEqual(createDailyAuctionManifest([...catalog].reverse(),'2026-10-16','test-run'),manifest);
 let root=startDailyAuction(initialAuctionSave(),manifest,now);assert.equal(startDailyAuction(root,manifest,now),root);assert.equal(root.wallet.cash,250000);
 const action=update=>{root=updateDailyAuction(root,update,now)};
 for(let index=0;index<5;index++){
  const draft=manifest.auctions[index];action(save=>beginAuction(save,catalog,now,draft.lot,draft.seed,draft.kind));
  action(save=>({...save,auction:{...save.auction,npcs:save.auction.npcs.map(npc=>({...npc,bid:100,locked:true}))}}));
  action(save=>lockBid(save,1000,now+1));action(save=>tickAuction(save,now+2));
  assert.equal(root.daily.save.auction.result.winner,'You');assert.equal(root.daily.save.wallet.inventory.length,0);
  const cash=root.daily.save.wallet.cash;action(save=>tickAuction(save,now+3));assert.equal(root.daily.save.wallet.cash,cash);
  action(finishAuction);assert.deepEqual(parseAuctionSave(JSON.stringify(root)),root);
 }
 assert.equal(root.daily.status,'completed');const reward=Math.floor((root.daily.save.wallet.cash-250000)*.25);assert.ok(reward>25000);assert.equal(root.wallet.cash,250000+reward);assert.equal(root.daily.reward,reward);assert.equal(updateDailyAuction(root,finishAuction,now),root);
 assert.equal(updateDailyAuction(root,save=>({...save,wallet:{...save.wallet,cash:0}}),now+86400000),root);
});
test('daily abandonment fails without affecting normal wallet and malformed nested saves fail closed',()=>{
 const manifest=createDailyAuctionManifest(catalog,'2026-10-16','test-run');let root=startDailyAuction(initialAuctionSave(),manifest,now);const draft=manifest.auctions[0];
 root=updateDailyAuction(root,save=>beginAuction(save,catalog,now,draft.lot,draft.seed,draft.kind),now);
 root=updateDailyAuction(root,save=>leaveAuction(save,draft.seed),now);assert.equal(root.daily.status,'failed');assert.equal(root.wallet.cash,250000);assert.equal(root.daily.reward,0);
 const bad=structuredClone(root);bad.daily.save.daily={};assert.throws(()=>parseAuctionSave(JSON.stringify(bad)));
});
test('daily runs end if the next required paid entry is unaffordable; expired runs never credit a bonus',()=>{
 const manifest=createDailyAuctionManifest(catalog,'2026-10-16','test-run');let root=startDailyAuction(initialAuctionSave(),manifest,now);
 for(let index=0;index<3;index++){
  const draft=manifest.auctions[index];root=updateDailyAuction(root,save=>beginAuction(save,catalog,now,draft.lot,draft.seed,draft.kind),now);
  root=updateDailyAuction(root,save=>({...save,auction:{...save.auction,npcs:save.auction.npcs.map((npc,index)=>({...npc,bid:index===0?200:100,locked:true})),selected:0}}),now);
  root=updateDailyAuction(root,save=>tickAuction(save,now+1),now);
  if(index===2){const expired=updateDailyAuction(root,finishAuction,Date.parse('2026-10-17T00:00:00Z'));assert.equal(expired,root);root={...root,daily:{...root.daily,save:{...root.daily.save,wallet:{...root.daily.save.wallet,cash:4999}}}};}
  root=updateDailyAuction(root,finishAuction,now);
 }
 assert.equal(root.daily.index,3);assert.equal(root.daily.status,'failed');assert.equal(root.wallet.cash,250000);assert.equal(root.daily.reward,0);
});
