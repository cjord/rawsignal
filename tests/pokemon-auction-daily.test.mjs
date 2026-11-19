import test from 'node:test';
import assert from 'node:assert/strict';
import {pokemonAuctionDailyCards as cards,pokemonAuctionDailyFixture as fixture} from './helpers/pokemon-auction-daily-fixture.ts';
import {createPokemonDailyAuction,validPokemonDailyAuction} from '../core/domain/pokemon-auction-daily.ts';
import {createGameCatalogSnapshot} from '../core/domain/game-catalog-snapshot.ts';
import {initialAuctionSave} from '../core/domain/auction-types.ts';
import {startDailyAuction,updateDailyAuction} from '../core/domain/auction-daily.ts';
import {beginAuction,lockBid,tickAuction,finishAuction,leaveAuction} from '../core/domain/auction-engine.ts';
import {parseAuctionSave,validDailyManifest} from '../core/domain/auction-save.ts';
import {auctionRunShare,encodeGameShare,decodeGameShare,auctionShareText} from '../core/domain/game-sharing.ts';
import {dailyAuctionResults} from '../core/domain/auction-daily-results.ts';
import {validAccountValue} from '../core/domain/account-data.ts';
import {loadPokemonDailyAuction} from '../db/pokemon-auction-daily.ts';
import {gameTestDb} from './helpers/game-db.mjs';
import {startIngestion,upsertCard,completeIngestion} from '../db/repository.ts';
const date='2026-11-19',now=Date.parse(date+'T12:00:00Z');
async function database(){const f=gameTestDb();await startIngestion(f.db,'daily-source','test',date,{sourceUpdatedAt:date});for(const card of cards)await upsertCard(f.db,card,date,'daily-source');await completeIngestion(f.db,'daily-source','daily-market',date,cards.length,cards.length);return f}

test('Pokémon daily auction freezes deterministic category-scoped lots and a 3-free/2-paid progression without Vintage',async()=>{
 const value=await fixture();assert.equal(validPokemonDailyAuction(value),true);assert.deepEqual(await fixture(),value);
 const reversed=await createGameCatalogSnapshot([...cards].reverse(),{market:'pokemon',eras:['swsh','sv','me','bw','xy','sm'],sets:[]},'database',date,date+'T00:00:00Z');assert.deepEqual(await createPokemonDailyAuction(reversed,date),value);
 assert.deepEqual(value.auctions.map(row=>row.category),['modern','modern','legacy','modern','legacy']);assert.deepEqual(value.auctions.map(row=>row.kind),['free','free','free','paid','paid']);
 for(const row of value.auctions){assert.equal(new Set(row.rivals).size,3);assert.ok(row.lot.every(card=>card.market==='pokemon'&&card.year===(row.category==='legacy'?2014:2023)));assert.match(row.catalogVersion,/^[a-f0-9]{64}$/)}
 assert.notDeepEqual((await fixture('2026-11-20')).auctions,value.auctions);
 for(const change of [{market:undefined},{version:1},{catalogVersion:'bad'},{date:'2026-02-31'}])assert.equal(validDailyManifest({...value,...change}),false);
 const bad=structuredClone(value);Object.assign(bad.auctions[0].lot[0],{set:'Base Set',year:1999});assert.equal(validDailyManifest(bad),false);
});

test('five Pokémon auctions auto-sell once, preserve normal holdings/statistics and award profit exactly once',async()=>{
 const manifest=await fixture(),normal=initialAuctionSave('pokemon');normal.wallet.inventory=[{productId:cards[0].productId,printing:'Normal',quantity:3}];normal.showcase=[{productId:cards[1].productId,printing:'Normal',quantity:1}];
 let root=startDailyAuction(normal,manifest,now);const action=fn=>{root=updateDailyAuction(root,fn,now)};
 for(const draft of manifest.auctions){
  action(save=>beginAuction(save,[],now,draft.lot,draft.seed,draft.kind));assert.equal(root.daily.save.auction.entryFee,draft.kind==='paid'?5000:0);
  action(save=>({...save,auction:{...save.auction,npcs:save.auction.npcs.map(npc=>({...npc,bid:100,locked:true}))}}));action(save=>lockBid(save,1000,now+1));action(save=>tickAuction(save,now+2));
  assert.equal(root.daily.receipts.length,root.daily.index+1);assert.deepEqual(root.daily.save.wallet.inventory,[]);const cash=root.daily.save.wallet.cash;action(save=>tickAuction(save,now+3));assert.equal(root.daily.save.wallet.cash,cash);
  action(finishAuction);root=parseAuctionSave(JSON.stringify(root),'pokemon');assert.equal(validAccountValue('raw-signal-pokemon-auction-v1',JSON.stringify(root)),true);
 }
 const result=dailyAuctionResults(manifest,root.daily.receipts);assert.equal(root.daily.status,'completed');assert.equal(result.entries,10000);assert.equal(result.cash,root.daily.save.wallet.cash);assert.equal(result.reward,root.daily.reward);assert.ok(root.daily.reward>25000);assert.equal(root.wallet.cash,250000+root.daily.reward);
 assert.deepEqual(root.wallet.inventory,normal.wallet.inventory);assert.deepEqual(root.showcase,normal.showcase);assert.equal(root.statistics,undefined);assert.equal(updateDailyAuction(root,finishAuction,now),root);assert.equal(startDailyAuction(root,manifest,now),root);assert.ok(Buffer.byteLength(JSON.stringify(root))<1_000_000);
 const share=auctionRunShare(manifest,root.daily.receipts);assert.equal(share.v,2);assert.equal(share.c,manifest.catalogVersion);assert.deepEqual(decodeGameShare(encodeGameShare(share)),share);assert.match(auctionShareText(manifest,share.r,'url'),/Pokémon Daily Auction/);assert.throws(()=>parseAuctionSave(JSON.stringify(root)));
});

test('wrong-market starts, expired runs, leaving and insufficient paid-entry cash cannot award a bonus',async()=>{
 const manifest=await fixture(),normal=initialAuctionSave('pokemon');assert.equal(startDailyAuction(initialAuctionSave(),manifest,now).daily,undefined);
 let root=startDailyAuction(normal,manifest,now),draft=manifest.auctions[0];root=updateDailyAuction(root,save=>beginAuction(save,[],now,draft.lot,draft.seed,draft.kind),now);
 assert.equal(updateDailyAuction(root,finishAuction,now+86400000),root);const left=updateDailyAuction(root,save=>leaveAuction(save,draft.seed),now);assert.equal(left.daily.status,'failed');assert.equal(left.wallet.cash,normal.wallet.cash);
 const poor={...root,daily:{...root.daily,index:2,save:{...root.daily.save,wallet:{...root.daily.save.wallet,cash:4900},auction:{...root.daily.save.auction,stage:'result',result:{winner:null,bid:0,value:0,fee:0,net:0,playerExpenses:0,buyout:false}}}}};
 const ended=updateDailyAuction(poor,finishAuction,now);assert.equal(ended.daily.status,'failed');assert.equal(ended.wallet.cash,normal.wallet.cash);assert.equal(startDailyAuction(normal,manifest,now+86400000),normal);
});

test('concurrent Pokémon auction initialization stores one immutable archive and historical reads require no catalog',async()=>{
 const f=await database();try{let checks=0;const options={clock:()=>now,check:async()=>{checks++;return true}};const all=await Promise.all(Array.from({length:8},()=>loadPokemonDailyAuction(f.db,options)));for(const row of all)assert.deepEqual(row,all[0]);assert.ok(checks<=192);assert.equal(f.sqlite.prepare('SELECT count(*) n FROM shared_game_manifests').get().n,1);
 f.sqlite.exec('DELETE FROM refresh_state');assert.deepEqual(await loadPokemonDailyAuction(f.db,{...options,date,clock:()=>now+86400000,check:async()=>{throw Error('must not check')}}),all[0]);assert.equal(await loadPokemonDailyAuction(f.db,{...options,date:'2026-11-18'}),null);
 }finally{f.sqlite.close()}
});

test('Pokémon artwork replacement stays in each draft category; failures and midnight changes publish nothing',async()=>{
 const f=await database();try{const first=await fixture(),bad=first.auctions[0].lot[0].image;const value=await loadPokemonDailyAuction(f.db,{clock:()=>now,check:async image=>image!==bad});assert.equal(validPokemonDailyAuction(value),true);assert.ok(value.auctions.every(draft=>draft.lot.every(card=>card.image!==bad&&card.year===(draft.category==='modern'?2023:2014))));}finally{f.sqlite.close()}
 for(const midnight of [false,true]){const f=await database();try{let clock=now;await assert.rejects(()=>loadPokemonDailyAuction(f.db,{clock:()=>clock,check:async()=>{if(midnight){clock=now+86400000;return true}throw Error('temporary artwork outage')}}),midnight?/date changed/:/temporary/);assert.equal(f.sqlite.prepare('SELECT count(*) n FROM shared_game_manifests').get().n,0)}finally{f.sqlite.close()}}
});
