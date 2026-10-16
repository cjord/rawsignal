import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {AUCTION_NPCS} from '../core/domain/auction-npcs.ts';
import {npcBid,beginAuction,nextAuctionRound} from '../core/domain/auction-engine.ts';
import {npcKnowledgeValue,npcConservativeMean} from '../core/domain/auction-npc-valuation.ts';
import {npcRoundInformation} from '../core/domain/auction-npc-information.ts';
import {initialAuctionSave} from '../core/domain/auction-types.ts';
import {parseAuctionSave} from '../core/domain/auction-save.ts';
import {allowedRarities} from '../core/market-state.ts';
import {auctionCatalog} from '../core/domain/auction-market.ts';
const card=(cents=100,rarity='Common')=>({productId:1,printing:'Normal',name:'Card',image:'https://images.example/1',set:'Origins',rarity,section:'commons',cents});
const clue=(id,text)=>({id,label:id,text});

test('outliers, top-five overlap and appraisal midpoint no longer inflate the hidden remainder',()=>{
 assert.ok(npcConservativeMean([100,100,100,1000000])<200);
 const knowledge={count:100,observed:[card(50000),card(),card()],random:[card(50000),card(),card()],clues:[clue('top5','$51000.00')]};
 const top=npcKnowledgeValue(knowledge);assert.ok(top.estimate<5120000); // $51k exact subtotal, not a $51k price for every hidden card.
 const appraised=npcKnowledgeValue({...knowledge,clues:[clue('appraisal','$800.00–$1200.00 (game appraisal estimate).')]});assert.equal(appraised.estimate,90000);
 const categories=npcKnowledgeValue({count:10,observed:[card(500,'Rare')],random:[card(),card()],clues:[clue('bulk','$10.00'),clue('rares','$20.00')]});assert.equal(categories.estimate,3000); // Disjoint category totals, no double counting.
});

test('ordinary profiles keep a margin; explicit risk and skeptical uncertainty remain distinct',()=>{
 const dealer=AUCTION_NPCS.findIndex(npc=>npc.name==='The Dealer'),gambler=AUCTION_NPCS.findIndex(npc=>npc.name==='The Gambler'),skeptic=AUCTION_NPCS.findIndex(npc=>npc.name==='The Skeptic');
 assert.equal(npcBid([],[50,50],[],dealer,()=>.5,1000,1,0,10000),7560);
 let values=[.1,.5,0,.5];const stretch=npcBid([],[50,50],[],gambler,()=>values.shift(),1000,1,0,10000);assert.ok(stretch>9000);
 assert.ok(npcBid([],[50,50],[],skeptic,()=>.5,1000,1,0,10000,.1)>0);assert.ok(npcBid([],[50,50],[],skeptic,()=>.5,1000,1,0,10000,1)>0);
});

test('new profiles have distinct original assets and identity-only clues cannot expose price knowledge',()=>{
 for(const portrait of ['archivist','playset-builder','skeptic']){const bytes=readFileSync(new URL(`../public/images/games/auction-${portrait}.webp`,import.meta.url));assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP')}
 assert.equal(AUCTION_NPCS.length,10);assert.equal(new Set(AUCTION_NPCS.map(npc=>npc.name)).size,10);
 const pool=Array.from({length:60},(_,i)=>({...card(),productId:i+1}));let found;
 for(let seed=0;seed<100;seed++){
  const auction=beginAuction(initialAuctionSave(),pool,1000,pool,seed).auction,info=npcRoundInformation(auction,0,[1,3,4,5],undefined,'The Playset Builder');
  if(info.investigations.at(-1)==='identity5'){found={auction,info};break}
 }
 assert.ok(found);const {auction,info}=found,slot=info.identified.find(slot=>!info.inspected.includes(slot));assert.ok(slot!==undefined);
 const changed={...auction,lot:auction.lot.map((row,index)=>index===slot?{...row,cents:999999}:row)};
 assert.equal(npcRoundInformation(changed,0,[1,3,4,5],undefined,'The Playset Builder').estimate,info.estimate);
 const invalid=beginAuction(initialAuctionSave(),pool,1000,pool,42);invalid.auction.npcs[0].identified=[99999];assert.throws(()=>parseAuctionSave(JSON.stringify(invalid)));
 const legacy=beginAuction(initialAuctionSave(),pool,1000,pool,42);legacy.auction.npcs.forEach(npc=>delete npc.identified);assert.deepEqual(parseAuctionSave(JSON.stringify(legacy)),legacy);
});

test('legacy sample-only Collector valuation remains conservative without a monetary bid ceiling',()=>{
 const catalog=auctionCatalog(allowedRarities.riftbound.flatMap(section=>JSON.parse(readFileSync(new URL(`../public/data/${section}.json`,import.meta.url),'utf8'))));
 for(const kind of ['free','paid']){
  let bids=0,over=0,affordable=0,cappedAffordable=0;const seen=new Set();
  for(let seed=0;seed<200;seed++){
   let save=beginAuction(initialAuctionSave(),catalog,1000,undefined,seed,kind);delete save.auction.marketPrior;
   save=nextAuctionRound({...save,auction:{...save.auction,stage:'reveal',round:0,npcs:[]}},1000);
   for(let round=1;round<=4;round++){
    const auction=save.auction,net=auction.lot.reduce((sum,card)=>sum+card.cents,0)*.9;
    for(const npc of auction.npcs){seen.add(npc.name);assert.ok(Number.isSafeInteger(npc.bid));if(npc.name==='The Collector'&&npc.bid>0){bids++;over+=Number(npc.bid>net);if(net<250000){affordable++;cappedAffordable+=Number(npc.bid===250000)}}}
    assert.deepEqual(parseAuctionSave(JSON.stringify(save)),save);
    if(round<4)save=nextAuctionRound({...save,auction:{...auction,stage:'reveal'}},auction.deadline+1);
   }
  }
  // Uncapped high-value lots can legitimately reach an NPC's cash ceiling. Keep
  // the anti-inflation check on lots whose net value is below that ceiling.
  assert.equal(seen.size,10);assert.ok(bids>100);assert.ok(over/bids<.1);assert.ok(affordable>50);assert.ok(cappedAffordable/affordable<.02);
 }
});
