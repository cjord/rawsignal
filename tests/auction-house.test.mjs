import assert from 'node:assert/strict';
import test from 'node:test';
import {initialAuctionSave,holdingKey} from '../core/domain/auction-types.ts';
import {auctionCatalog,prototypeLot,inventoryQuote} from '../core/domain/auction-market.ts';
import {beginAuction,buyInformation,lockBid,tickAuction,nextAuctionRound,finishAuction,auctionWinner,npcBid,sellInventory,changeAuctionFee} from '../core/domain/auction-engine.ts';
import {INVESTIGATIONS,investigate,knownValue,RETIRED_INVESTIGATION_IDS} from '../core/domain/auction-information.ts';
import {parseAuctionSave} from '../core/domain/auction-save.ts';
const cards=Array.from({length:24},(_,index)=>({productId:index+1,printing:'Normal',name:`Card ${index+1}`,image:`https://images.example/${index}.jpg`,game:'riftbound',set:'Origins',rarity:index<12?'Common':'Rare',section:'rares',marketPrice:index+1}));
const catalog=auctionCatalog(cards),start=()=>beginAuction(initialAuctionSave(),catalog,1000,prototypeLot(catalog));
test('new auctions expose exact copy count, exclude paid count clues and use one-minute rounds',()=>{
 const save=start();assert.equal(save.auction.deadline,61000);assert.deepEqual(save.auction.range,[48,48]);assert.ok(save.auction.offers.every(offer=>offer.id!=='count'));
 const prepared=prototypeLot(catalog),entered=beginAuction(initialAuctionSave(),catalog,1000,prepared);prepared[0].cents=1;assert.notEqual(entered.auction.lot[0].cents,1);
});
const fixedBids=(save,bids)=>({...save,auction:{...save.auction,npcs:save.auction.npcs.map((npc,index)=>({...npc,bid:bids[index],locked:false}))}});
test('auction catalog preserves printing identity, excludes unavailable prices and freezes the prototype lot',()=>{
 const rows=auctionCatalog([...cards,{...cards[0],printing:'Foil',marketPrice:20},{...cards[1],marketPrice:null},{...cards[2],game:'pokemon'},{...cards[3],marketPrice:NaN}]);
 assert.ok(rows.some(row=>row.productId===1&&row.printing==='Foil'));
 const lot=prototypeLot(catalog);assert.equal(lot.length,48);assert.deepEqual(lot,prototypeLot([...catalog].reverse()));
 assert.equal(new Set(lot.map(holdingKey)).size,24);
 const value=lot[0].cents;const changed=catalog.map(card=>({...card,cents:card.cents*2}));assert.notEqual(prototypeLot(changed)[0].cents,value);assert.equal(lot[0].cents,value);
 assert.deepEqual(prototypeLot(catalog.slice(0,5)),[]);
});
test('information is optional, charged once, retained, affordable and blocked after lock or deadline',()=>{
 let save=start(),offer=save.auction.offers[0],cash=save.wallet.cash;
 save=buyInformation(save,offer.id,1100);assert.equal(save.wallet.cash,cash-offer.cost);assert.equal(save.auction.spent,offer.cost);assert.equal(save.auction.clues.length,1);
 assert.equal(buyInformation(save,save.auction.offers[1].id,1200),save);
 assert.equal(buyInformation(start(),'not-offered',1100).wallet.cash,250000);
 const poor={...start(),wallet:{...start().wallet,cash:0}};assert.equal(buyInformation(poor,poor.auction.offers[0].id,1200),poor);
 const locked=lockBid(start(),10,1100);assert.equal(buyInformation(locked,locked.auction.offers[0].id,1200),locked);
 assert.equal(buyInformation(start(),start().auction.offers[0].id,61000).wallet.cash,250000);
});
test('identity-only and aggregate investigations never leak or double-count known prices',()=>{
 let auction=start().auction;const before=knownValue(auction);
 const highest=investigate(auction,INVESTIGATIONS.find(option=>option.id==='highest'));
 assert.deepEqual(highest.priced,auction.priced);assert.equal(knownValue({...auction,...highest}),before);
 const aggregate=investigate(auction,INVESTIGATIONS.find(option=>option.id==='top5'));assert.equal(knownValue({...auction,...aggregate}),before);
 const expected=auction.priced.length+3,priced=investigate(auction,INVESTIGATIONS.find(option=>option.id==='reveal3'));assert.equal(priced.priced.length,expected);
 auction={...auction,known:priced.known,priced:priced.priced};assert.equal(new Set(auction.priced).size,expected);
 assert.equal(INVESTIGATIONS.filter(option=>!RETIRED_INVESTIGATION_IDS.includes(option.id)).length,24);
});
test('bid lock is irreversible, cents-valid and affordable; NPC acceleration changes timing only',()=>{
 const save=start(),before=save.auction.npcs.map(npc=>npc.bid),locked=lockBid(save,10000,1100);
 assert.equal(locked.wallet.cash,250000);assert.equal(locked.auction.selected,10000);
 assert.deepEqual(locked.auction.npcs.map(npc=>npc.bid),before);
 assert.ok(locked.auction.npcs.every(npc=>npc.lockAt<=4100));
 assert.equal(lockBid(locked,20000,1200),locked);
 for(const invalid of [-1,.5,NaN,Infinity,250001])assert.equal(lockBid(save,invalid,1100),save);
 assert.equal(lockBid(save,10,61000),save);
});
test('buyouts honor inclusive 100/60/30 percent boundaries, require two positives and tie deterministically',()=>{
 for(const [round,amount] of [[1,200],[2,160],[3,130]]){
  const bids=[{name:'You',cents:amount},{name:'The Dealer',cents:100}];assert.equal(auctionWinner(bids,round,1).winner.name,'You');
  assert.equal(auctionWinner([{...bids[0],cents:amount-1},bids[1]],round,1).winner,null);
 }
 assert.equal(auctionWinner([{name:'You',cents:1}],1,1).winner,null);
 assert.equal(auctionWinner([{name:'You',cents:1}],4,1).winner.name,'You');
 assert.equal(auctionWinner([{name:'You',cents:0}],4,1).winner,null);
 const ties=[{name:'You',cents:100},{name:'The Dealer',cents:100}];assert.deepEqual(auctionWinner(ties,4,3),auctionWinner([...ties].reverse(),4,3));
});
test('unsettled bids expire and next-round bids are independent, with no accumulated bid charges',()=>{
 let save=fixedBids(start(),[10000,9000,8000]);save=lockBid(save,10000,1100);save=tickAuction(save,5000);
 assert.equal(save.auction.stage,'reveal');assert.equal(save.wallet.cash,250000);
 save=nextAuctionRound(save,6000);assert.equal(save.auction.round,2);assert.equal(save.auction.selected,null);
 assert.equal(save.auction.spent,0);assert.equal(save.wallet.cash,250000);
 const bought=buyInformation(save,save.auction.offers[0].id,6100);assert.equal(bought.auction.clues.length,1);
});
test('deadlines default the player to pass and settlement occurs once across serialized reloads',()=>{
 let save=fixedBids(start(),[100,50,0]);save=tickAuction(parseAuctionSave(JSON.stringify(save)),62000);
 assert.equal(save.auction.selected,0);assert.equal(save.auction.result.winner,save.auction.npcs[0].name);assert.equal(save.wallet.cash,250000);
 assert.equal(tickAuction(save,99999),save);
 assert.equal(tickAuction(parseAuctionSave(JSON.stringify(save)),99999).wallet.cash,250000);
});
test('all passes reach the fourth round with no winner, no inventory and no fabricated profit',()=>{
 let save=start();
 for(let round=1;round<=4;round++){
  save=fixedBids(save,[0,0,0]);save=tickAuction(save,save.auction.deadline+1);
  if(round<4){assert.equal(save.auction.stage,'reveal');save=nextAuctionRound(save,save.auction.deadline+2000)}
 }
 assert.equal(save.auction.result.winner,null);assert.equal(save.wallet.inventory.length,0);assert.equal(save.wallet.cash,250000);assert.equal(save.auction.result.net,0);
});
test('winning charges once, adds precise quantities, reprices inventory live and applies the selling fee once',()=>{
 let save=fixedBids(start(),[100,50,0]);save=lockBid(save,200,1100);save=tickAuction(save,5000);
 assert.equal(save.auction.result.winner,'You');assert.equal(save.wallet.cash,249800);assert.equal(save.wallet.inventory.reduce((sum,row)=>sum+row.quantity,0),48);
 assert.ok(save.wallet.inventory.every(row=>Object.keys(row).sort().join(',')==='printing,productId,quantity'));
 const initial=inventoryQuote(save.wallet.inventory,catalog,1000),increased=inventoryQuote(save.wallet.inventory,catalog.map(card=>({...card,cents:card.cents*2})),1000);
 assert.equal(increased.net,initial.net*2);assert.equal(sellInventory(save,catalog),save);
 save=finishAuction(save);const oldCash=save.wallet.cash;save=sellInventory(save,catalog);assert.equal(save.wallet.cash,oldCash+initial.net);assert.equal(save.wallet.inventory.length,0);
 assert.equal(sellInventory(save,catalog),save);
});
test('missing inventory prices remain owned and are not sold as zero; fee configuration is bounded and between-auction only',()=>{
 let save={...initialAuctionSave(),wallet:{...initialAuctionSave().wallet,inventory:[{productId:1,printing:'Normal',quantity:2},{productId:999,printing:'Normal',quantity:1}]}};
 const quote=inventoryQuote(save.wallet.inventory,catalog,1000);assert.equal(quote.unpriced,1);assert.equal(quote.net,180);
 save=sellInventory(save,catalog);assert.equal(save.wallet.cash,250180);assert.deepEqual(save.wallet.inventory,[{productId:999,printing:'Normal',quantity:1}]);
 assert.equal(changeAuctionFee(save,500).wallet.feeBps,500);
 for(const bad of [-1,10001,1.1,NaN])assert.equal(changeAuctionFee(save,bad),save);
 const active=start();assert.equal(changeAuctionFee(active,500),active);
});
test('NPC valuation uses supplied evidence and a repeatable seed without a monetary bid ceiling',()=>{
 assert.equal(npcBid([100,200],[25,50],[],0,()=>.5),npcBid([100,200],[25,50],[],0,()=>.5));
 assert.ok(npcBid([10000000],[25,50],[],1,()=>.5)>250000);
 assert.equal(npcBid([100],[25,50],[],0,()=>.99),0);
});
test('local saves validate corruption, normalize holdings without stored values and preserve resumable frozen auctions',()=>{
 assert.deepEqual(parseAuctionSave(null),initialAuctionSave());const save=start();assert.deepEqual(parseAuctionSave(JSON.stringify(save)),save);
 const realTime=beginAuction(initialAuctionSave(),catalog,Date.now());assert.deepEqual(parseAuctionSave(JSON.stringify(realTime)),realTime);
 const extra={...initialAuctionSave(),wallet:{...initialAuctionSave().wallet,inventory:[{productId:1,printing:'Normal',quantity:1,marketPrice:999}]}};
 assert.deepEqual(parseAuctionSave(JSON.stringify(extra)).wallet.inventory,[{productId:1,printing:'Normal',quantity:1}]);
 for(const raw of ['bad','null','{}',JSON.stringify({...save,version:2}),JSON.stringify({...save,wallet:{...save.wallet,cash:-1}}),JSON.stringify({...save,auction:{...save.auction,lot:[{}]}}),JSON.stringify({...save,auction:{...save.auction,priced:[999]}})])assert.throws(()=>parseAuctionSave(raw));
});
