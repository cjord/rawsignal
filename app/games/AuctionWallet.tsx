"use client";
import {memo,useState} from 'react';
import AuctionWalletSummary from './AuctionWalletSummary';
import AuctionDialog from './AuctionDialog';
import type {AuctionCard,AuctionSave} from '../../core/domain/auction-types';
import type {Card} from '../../core/domain/types';
import {inventoryQuote} from '../../core/domain/auction-market';
import {ownedAuctionCards} from '../../core/domain/auction-showcase';
import AuctionInventoryManager from './AuctionInventoryManager';
import type {AuctionMarketCheck} from './AuctionSaleConfirmation';

export const auctionUsd=(cents:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100);
type Props={save:AuctionSave;catalog:AuctionCard[];cards:Card[];transact:(update:(save:AuctionSave)=>AuctionSave)=>void;reset:()=>void;refresh:()=>void;loading:boolean;checkMarket?:AuctionMarketCheck};
function AuctionWallet({save,catalog,cards,transact,reset,refresh,loading,checkMarket}:Props){
 const [confirm,setConfirm]=useState(false),[inventoryOpen,setInventoryOpen]=useState(false);
 const owned=ownedAuctionCards(save),quote=inventoryQuote(save.wallet.inventory,catalog,1000),worth=inventoryQuote(owned,catalog,1000),between=!save.auction;
 const priceLoading=loading&&owned.length>0,available=!worth.unpriced&&!priceLoading;
 return <section className="detail-section auction-wallet" aria-label="Virtual bankroll and inventory">
  <AuctionWalletSummary cash={save.wallet.cash} net={available?worth.net:null} loading={priceLoading}/>
  <div className="auction-actions"><button className="game-control" type="button" disabled={loading} onClick={refresh}>Refresh market</button><button className="game-control" type="button" onClick={()=>setConfirm(true)}>Reset cash &amp; inventory</button></div>
  <p className="games-note auction-inventory-price-notice">{loading?'Loading inventory prices…':quote.unpriced>0?`${quote.unpriced} owned copies have unavailable current prices. You can sell priced copies; unavailable ones remain in inventory.`:null}</p>
  <details className="auction-inventory" onToggle={event=>setInventoryOpen(event.currentTarget.open)}><summary>Inventory ({save.wallet.inventory.reduce((sum,row)=>sum+row.quantity,0)} copies)</summary>
   {inventoryOpen&&(!quote.rows.length?<p className="games-note">Win an auction to start your collection.</p>:<AuctionInventoryManager save={save} catalog={catalog} cards={cards} loading={loading} transact={transact} checkMarket={checkMarket}/>)}
   {!between&&<p className="games-note">Inventory selling is available between auctions. Finish reviewing the auction first.</p>}
  </details>
  {confirm&&<AuctionDialog title="Reset your auction progress?" onClose={()=>setConfirm(false)}>
   <p>This removes your normal-play inventory, showcase, display name, auction statistics, pending collections and unfinished auction, restores $2,500 virtual cash, and resets the selling fee to 10%. Today’s daily challenge attempt is preserved. Previously shared snapshots are not removed. Other site preferences are unchanged.</p>
   <button className="game-control" type="button" onClick={()=>{reset();setConfirm(false)}}>Confirm reset</button>
  </AuctionDialog>}
 </section>;
}
export default memo(AuctionWallet);
