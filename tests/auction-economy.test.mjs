import assert from 'node:assert/strict';
import test from 'node:test';
import {auctionLossShares,auctionSaleRarity} from '../core/domain/auction-economy.ts';
import {beginAuction,tickAuction,finishAuction,sellInventory} from '../core/domain/auction-engine.ts';
import {initialAuctionSave} from '../core/domain/auction-types.ts';
import {parseAuctionSave} from '../core/domain/auction-save.ts';

const card={productId:1,printing:'Normal',name:'Card',image:'https://images.example/card.jpg',set:'Origins',rarity:'Common',section:'commons',cents:101};
test('NPC loss is conserved in cents across all other bidders including passes; no player-loss rebates',()=>{
 const bids=['You','The Dealer','The Collector','The Analyst'].map(name=>({name,cents:0}));
 for(let seed=0;seed<6;seed++){const shares=auctionLossShares('The Dealer',-101,bids,seed);assert.equal(shares.reduce((sum,row)=>sum+row.cents,0),101);assert.equal(shares.length,3);assert.ok(!shares.some(row=>row.name==='The Dealer'));assert.ok(Math.max(...shares.map(row=>row.cents))-Math.min(...shares.map(row=>row.cents))<=1)}
 for(const [winner,net] of [['You',-101],['The Dealer',0],['The Dealer',101],[null,-101]])assert.deepEqual(auctionLossShares(winner,net,bids,1),[]);
});
test('NPC compensation settles once, survives reload, and never retroactively credits old results',()=>{
 let save=beginAuction(initialAuctionSave(),[card],1000,Array.from({length:25},()=>({...card})),42);
 save={...save,auction:{...save.auction,selected:0,npcs:save.auction.npcs.map((npc,index)=>({...npc,bid:index===0?10000:1,locked:true}))}};
 save=tickAuction(save,1100);const result=save.auction.result,credit=result.lossShares.find(row=>row.name==='You').cents;
 assert.ok(result.net<0);assert.equal(save.wallet.cash,250000+credit);assert.equal(result.lossShares.reduce((sum,row)=>sum+row.cents,0),-result.net);assert.deepEqual(save.wallet.inventory,[]);
 const reload=parseAuctionSave(JSON.stringify(save));assert.equal(tickAuction(reload,999999),reload);assert.equal(reload.wallet.cash,save.wallet.cash);assert.equal(finishAuction(reload).wallet.cash,save.wallet.cash);
 const legacy=structuredClone(save);delete legacy.auction.result.lossShares;legacy.wallet.cash=250000;assert.equal(tickAuction(parseAuctionSave(JSON.stringify(legacy)),999999).wallet.cash,250000);
 const corrupt=structuredClone(save);corrupt.auction.result.lossShares[0].cents=-1;assert.throws(()=>parseAuctionSave(JSON.stringify(corrupt)));
});
test('rarity sales retain other tiers, alternate printings and unavailable holdings, charging fees once',()=>{
 const catalog=[card,{...card,printing:'Foil',rarity:'Rare',section:'rares',cents:200},{...card,productId:2,section:'signatures',rarity:'Epic',cents:500}];
 const holdings=[{productId:1,printing:'Normal',quantity:3},{productId:1,printing:'Foil',quantity:1},{productId:2,printing:'Normal',quantity:1},{productId:999,printing:'Normal',quantity:2}];
 const save={...initialAuctionSave(),wallet:{...initialAuctionSave().wallet,inventory:holdings}};
 const sold=sellInventory(save,catalog,undefined,'Commons');assert.equal(sold.wallet.cash,250273);assert.deepEqual(sold.wallet.inventory,holdings.slice(1));assert.equal(sellInventory(sold,catalog,undefined,'Commons'),sold);
 const active={...save,auction:{}};assert.equal(sellInventory(active,catalog,undefined,'Commons'),active);
 assert.equal(auctionSaleRarity(catalog[2]),'Signatures');assert.equal(auctionSaleRarity({...card,section:'over-numbered'}),'Over-Numbered');assert.equal(auctionSaleRarity({...card,section:'alt-arts'}),'Alt Arts');
});
