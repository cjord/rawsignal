"use client";
import {useMemo} from 'react';
import {GamesShell} from './GamesView';
import {useAccount} from './account/context';
import {useAuctionCatalog} from './data/useAuctionCatalog';
import {auctionCatalog,inventoryQuote} from '../core/domain/auction-market';
import {useAuctionSave} from './games/useAuctionSave';
import AuctionInventoryManager from './games/AuctionInventoryManager';
import AuctionInventorySkeleton from './games/AuctionInventorySkeleton';
import AuctionMarketStatus from './games/AuctionMarketStatus';
import AuctionHub from './games/AuctionHub';
import AuctionLink from './games/AuctionLink';
import {auctionUsd} from './games/AuctionWallet';
import type {AuctionSave} from '../core/domain/auction-types';

function InventoryOverview({save,value}:{save:AuctionSave;value:string}){
 return <div className="auction-inventory-overview"><div><span>Virtual Cash</span><strong>{auctionUsd(save.wallet.cash)}</strong></div><div><span>Sellable Inventory</span><strong>{save.wallet.inventory.reduce((sum,row)=>sum+row.quantity,0)} Cards</strong></div><div><span>Protected Showcase</span><strong>{save.showcase?.length??0} Cards</strong></div><div><span>Inventory Sale Value</span><strong>{value}</strong></div></div>;
}
export default function AuctionInventory({catalogCache=false}:{catalogCache?:boolean}){
 const account=useAccount(),market=useAuctionCatalog(!account.loading&&!account.error,catalogCache),{save,error,transact}=useAuctionSave();
 const catalog=useMemo(()=>auctionCatalog(market.items),[market.items]),quote=save?inventoryQuote(save.wallet.inventory,catalog,1000):null,waiting=account.loading||!save||market.status==='loading'||market.status==='idle';
 const value=waiting?'Loading…':quote&&!quote.unpriced?auctionUsd(quote.net):'N/A';
 return <GamesShell auction><header className="games-heading"><span className="games-eyebrow">Riftbound Auction House</span><h1>Auction Inventory</h1><p>Search your cards, keep a playset, or turn selected holdings into virtual cash. Showcase cards stay protected.</p><AuctionHub/></header><AuctionMarketStatus {...market}/>{error&&<p role="alert">{error}</p>}<section className="detail-section auction-inventory-workspace">
  {waiting?<AuctionInventorySkeleton overview/>:save&&<><InventoryOverview save={save} value={value}/>{save.auction&&<p className="games-note">Your auction timer continues. <AuctionLink href="/games/riftbound-auction">Return to the auction</AuctionLink> before selling or moving cards.</p>}<AuctionInventoryManager save={save} catalog={catalog} cards={market.items} loading={market.status!=='success'} transact={transact} checkMarket={market.checkLatest} urlState/></>}
  <p className="games-note">Current market prices, less the fixed 10% virtual selling fee. Missing prices stay unavailable. This inventory contains game cards, not real owned collections.</p>
 </section></GamesShell>;
}
