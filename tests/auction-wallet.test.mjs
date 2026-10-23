import test from 'node:test';
import assert from 'node:assert/strict';
import {auctionWalletSummary} from '../core/domain/auction-wallet.ts';
import {initialAuctionSave} from '../core/domain/auction-types.ts';
import {inventoryQuote} from '../core/domain/auction-market.ts';
import {ownedAuctionCards,moveShowcaseCard} from '../core/domain/auction-showcase.ts';
const card={productId:1,printing:'Normal',name:'Card',image:'',set:'Origins',rarity:'Rare',section:'rares',cents:10005};
const holding={productId:1,printing:'Normal',quantity:1};

test('wallet partitions cash, inventory and duplicate showcase cards without changing saves or fee rounding',()=>{
 const save=initialAuctionSave();save.wallet.inventory=[holding];save.showcase=[holding,holding];const before=JSON.stringify(save);
 const result=auctionWalletSummary(save,[card]);
 assert.equal(result.inventory.count,1);assert.equal(result.showcase.count,2);assert.equal(result.inventory.gross,10005);assert.equal(result.showcase.gross,20010);
 assert.equal(result.netWorth,save.wallet.cash+inventoryQuote(ownedAuctionCards(save),[card],1000).net);
 assert.equal(result.netWorth,result.cash+result.inventory.net+result.showcase.net);assert.equal(JSON.stringify(save),before);
 const moved=moveShowcaseCard(save,0,'showcase');assert.equal(auctionWalletSummary(moved,[card]).netWorth,result.netWorth);
});
test('unknown prices keep complete totals unavailable and expose only known subtotals',()=>{
 const save=initialAuctionSave();save.wallet.inventory=[holding,{...holding,productId:2,quantity:3}];save.showcase=[{...holding,productId:3}];
 const result=auctionWalletSummary(save,[card]);assert.equal(result.netWorth,null);assert.equal(result.unpriced,4);assert.equal(result.inventory.unpriced,3);assert.equal(result.showcase.unpriced,1);
 assert.equal(result.knownNetWorth,result.cash+9004);assert.equal(result.inventory.count,4);assert.equal(result.showcase.count,1);
});
test('empty wallet values do not depend on the catalog, a saved custom fee, or separate daily funds',()=>{
 const save=initialAuctionSave();save.wallet.feeBps=5000;save.daily={save:{wallet:{cash:99999999}}};
 assert.equal(auctionWalletSummary(save,[]).netWorth,250000);
 save.wallet.inventory=[holding];assert.equal(auctionWalletSummary(save,[card]).inventory.net,9004);
});
