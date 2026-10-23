import {inventoryQuote} from './auction-market.ts';
import {ownedAuctionCards} from './auction-showcase.ts';
import {AUCTION_DEFAULT_FEE,type AuctionCard,type AuctionSave,type Holding} from './auction-types.ts';

function bucket(holdings:Holding[],catalog:AuctionCard[]){
 const quote=inventoryQuote(holdings,catalog,AUCTION_DEFAULT_FEE);
 return {count:holdings.reduce((sum,row)=>sum+row.quantity,0),unpriced:quote.unpriced,
  gross:quote.rows.reduce((sum,row)=>sum+(row.gross??0),0),net:quote.net};
}

// Presentation only: preserve the existing all-owned, per-printing fee rounding.
// Allocate any shared-printing rounding remainder to protected showcase cards.
export function auctionWalletSummary(save:AuctionSave,catalog:AuctionCard[]){
 const inventory=bucket(save.wallet.inventory,catalog),showcase=bucket(save.showcase??[],catalog),owned=bucket(ownedAuctionCards(save),catalog);
 showcase.net=owned.net-inventory.net;
 return {cash:save.wallet.cash,inventory,showcase,unpriced:owned.unpriced,
  knownNetWorth:save.wallet.cash+owned.net,netWorth:owned.unpriced?null:save.wallet.cash+owned.net};
}
export type AuctionWalletValues=ReturnType<typeof auctionWalletSummary>;
