import assert from 'node:assert/strict';
import test from 'node:test';
import {createDailyShowdownManifest,initialDailyShowdown,answerDailyShowdown,advanceDailyShowdown,parseDailyShowdown,dailyShowdownHistory,showdownScore} from '../core/domain/showdown-daily.ts';
import {encodeGameShare,decodeGameShare,gameSharePath,showdownShareText,auctionShareText} from '../core/domain/game-sharing.ts';
import {createDailyAuctionManifest,startDailyAuction,updateDailyAuction} from '../core/domain/auction-daily.ts';
import {dailyAuctionResults} from '../core/domain/auction-daily-results.ts';
import {initialAuctionSave} from '../core/domain/auction-types.ts';
import {beginAuction,lockBid,tickAuction,finishAuction} from '../core/domain/auction-engine.ts';
import {parseAuctionSave} from '../core/domain/auction-save.ts';
const catalog=Array.from({length:240},(_,index)=>({productId:index+1,printing:'Normal',name:`Secret Card ${index}`,image:`https://images.example/${index}.jpg`,set:'Origins',rarity:['Common','Uncommon','Rare','Epic'][index%4],section:['commons','uncommons','rares','epics'][index%4],cents:1000+index*17}));
const now=Date.parse('2026-10-16T12:00:00Z'),manifest=createDailyShowdownManifest(catalog,'2026-10-16','test');
test('daily Showdown freezes two deterministic ten-round modes and avoids repeated cards when stock allows',()=>{
 assert.deepEqual(createDailyShowdownManifest([...catalog].reverse(),'2026-10-16','test'),manifest);
 for(const mode of ['normal','hard']){assert.equal(manifest[mode].length,10);assert.equal(new Set(manifest[mode].flat().map(card=>card.productId)).size,mode==='hard'?30:20);for(const round of manifest[mode]){assert.equal(round.length,mode==='hard'?3:2);assert.equal(new Set(round.map(card=>card.marketPrice)).size,round.length)}}
 assert.notDeepEqual(createDailyShowdownManifest(catalog,'2026-10-17','test').normal,manifest.normal);
});
test('Showdown answers persist once per round, modes stay separate, and midnight/completion block replay',()=>{
 let save=initialDailyShowdown(manifest);
 for(let index=0;index<10;index++){
  const round=manifest.normal[index],pick=round.findIndex(card=>card.marketPrice===Math.max(...round.map(card=>card.marketPrice)));
  save=answerDailyShowdown(save,'normal',pick,now);assert.equal(answerDailyShowdown(save,'normal',1-pick,now),save);save=parseDailyShowdown(JSON.stringify(save));
  assert.deepEqual(save.hard,{picks:[],cursor:0});if(index<9)save=advanceDailyShowdown(save,'normal',now);
 }
 assert.equal(showdownScore(dailyShowdownHistory(manifest,'normal',save.normal.picks)).correct,10);assert.equal(advanceDailyShowdown(save,'normal',now),save);
 assert.equal(answerDailyShowdown(save,'hard',0,now+86400000),save);
 for(const bad of [{...save,normal:{picks:[2],cursor:0}},{...save,hard:{picks:[],cursor:9}},{...save,revision:-1}])assert.throws(()=>parseDailyShowdown(JSON.stringify(bad)));
});
test('share links are short, validated and reveal no wallet/profile; text shows ten non-spoiler emoji results',()=>{
 const picks=Array(10).fill(0),share={v:1,g:'showdown',d:manifest.date,m:'hard',p:picks};
 assert.deepEqual(decodeGameShare(encodeGameShare(share)),share);assert.ok(gameSharePath(share).length<600);
 const text=showdownShareText(manifest,'hard',picks,'https://example.com/results');assert.equal([...text].filter(char=>char==='🟩'||char==='🟥').length,10);assert.ok(!text.includes('Secret Card'));assert.ok(!text.includes('$'));
 for(const raw of ['','a'.repeat(3001),'%broken',encodeGameShare({...share,p:[0]}),encodeGameShare({...share,m:'invalid'}),encodeGameShare({...share,d:'2026-02-31'})])assert.throws(()=>decodeGameShare(raw));
});
test('five auction receipts survive reload and reconstruct exact cash, fees, rewards and the highest-value cards won',()=>{
 const daily=createDailyAuctionManifest(catalog,'2026-10-16','test');let root=startDailyAuction(initialAuctionSave(),daily,now);
 const action=update=>{root=updateDailyAuction(root,update,now)};
 for(const draft of daily.auctions){
  action(save=>beginAuction(save,catalog,now,draft.lot,draft.seed,draft.kind));action(save=>({...save,auction:{...save.auction,npcs:save.auction.npcs.map(npc=>({...npc,bid:100,locked:true}))}}));action(save=>lockBid(save,1000,now+1));action(save=>tickAuction(save,now+2));
  assert.equal(root.daily.receipts.length,root.daily.index+1);action(save=>tickAuction(save,now+3));assert.equal(root.daily.receipts.length,root.daily.index+1);action(finishAuction);root=parseAuctionSave(JSON.stringify(root));
 }
 const result=dailyAuctionResults(daily,root.daily.receipts);assert.equal(result.cash,root.daily.save.wallet.cash);assert.equal(result.reward,root.daily.reward);assert.equal(result.won,5);assert.equal(result.entries,10000);assert.ok(result.top.length<=5);assert.ok(result.top.every((row,index)=>index===0||result.top[index-1].card.cents>=row.card.cents));
 const share={v:1,g:'auction',d:daily.date,r:root.daily.receipts};assert.deepEqual(decodeGameShare(encodeGameShare(share)),share);assert.ok(gameSharePath(share).length<900);assert.ok(!encodeGameShare(share).includes('wallet'));assert.match(auctionShareText(daily,root.daily.receipts,'url'),/5\/5 won/);
 assert.throws(()=>decodeGameShare(encodeGameShare({...share,r:[[0,100,0,99,1,1],...root.daily.receipts.slice(1)]})));
});
test('frozen rival names drive entry and archived winner labels independently of future seeded roster selection',()=>{
 const daily=createDailyAuctionManifest(catalog,'2026-10-16','test'),draft=daily.auctions[0];draft.rivals=['The Collector','The Dealer','The Skeptic'];
 const root=startDailyAuction(initialAuctionSave(),daily,now),entered=beginAuction(root.daily.save,catalog,now,draft.lot,draft.seed,draft.kind);
 assert.deepEqual(entered.auction.npcs.map(profile=>profile.name),draft.rivals);assert.deepEqual(parseAuctionSave(JSON.stringify(entered)),entered);
 assert.equal(dailyAuctionResults(daily,[[1,100,0,0,1,1]]).rows[0].winnerName,'The Collector');
});
