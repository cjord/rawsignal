"use client";
import {useState} from 'react';
import DeferredImage from '../DeferredImage';
import InfoHint from '../InfoHint';
import AuctionDialog from './AuctionDialog';
import type {AuctionCard,AuctionSave} from '../../core/domain/auction-types';
import type {Card} from '../../core/domain/types';
import {holdingKey} from '../../core/domain/auction-types';
import {inventoryQuote} from '../../core/domain/auction-market';
import {ownedAuctionCards} from '../../core/domain/auction-showcase';
import {auctionRarity} from '../../core/domain/auction-display';
import AuctionInventorySales from './AuctionInventorySales';

export const auctionUsd=(cents:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100);
type Props={save:AuctionSave;catalog:AuctionCard[];cards:Card[];transact:(update:(save:AuctionSave)=>AuctionSave)=>void;reset:()=>void;refresh:()=>void;loading:boolean};
export default function AuctionWallet({save,catalog,cards,transact,reset,refresh,loading}:Props){
 const [confirm,setConfirm]=useState(false);
 const quote=inventoryQuote(save.wallet.inventory,catalog,1000),worth=inventoryQuote(ownedAuctionCards(save),catalog,1000),between=!save.auction;
 const available=!worth.unpriced&&(!loading||!ownedAuctionCards(save).length),metadata=new Map(cards.map(card=>[holdingKey(card),card]));
 return <section className="detail-section auction-wallet" aria-label="Virtual bankroll and inventory">
  <div className="auction-wallet-title"><div><span className="games-eyebrow">Virtual Net Worth</span><p className="auction-net-worth"><span className="auction-cash-value">{auctionUsd(save.wallet.cash)}</span> + (<span className="auction-inventory-value">{available?auctionUsd(worth.net):'N/A'} cards</span>) <InfoHint label="Inventory valuation and selling fees">Inventory and showcase value use the latest catalog loaded here, less the fixed 10% virtual selling fee. Showcase cards must return to inventory before sale. Missing prices are unavailable, never zero. Market prices are not guaranteed sale proceeds. Use Refresh market to reload the catalog.</InfoHint></p></div></div>
  <div className="auction-actions"><button className="game-control" type="button" disabled={loading} onClick={refresh}>Refresh market</button><button className="game-control" type="button" onClick={()=>setConfirm(true)}>Reset cash &amp; inventory</button></div>
  {quote.unpriced>0&&<p className="games-note">{quote.unpriced} owned copies have unavailable current prices. You can sell priced copies; unavailable ones remain in inventory.</p>}
  <details className="auction-inventory"><summary>Inventory ({save.wallet.inventory.reduce((sum,row)=>sum+row.quantity,0)} copies)</summary>
   {!quote.rows.length?<p className="games-note">Win an auction to start your collection.</p>:<><AuctionInventorySales save={save} catalog={catalog} loading={loading} transact={transact}/><div className="auction-inventory-grid">{quote.rows.map(row=><div className="auction-owned-card" data-rarity={auctionRarity(metadata.get(holdingKey(row.holding)))} key={holdingKey(row.holding)}>
    <DeferredImage src={metadata.get(holdingKey(row.holding))?.image} alt=""/><div><b>{metadata.get(holdingKey(row.holding))?.name??`Card ${row.holding.productId}`}</b><small>{row.holding.printing} · Near Mint · ×{row.holding.quantity}</small><strong>{!loading&&row.net!==null?auctionUsd(row.net):'N/A'} after fee</strong></div>
   </div>)}</div></>}
   {!between&&<p className="games-note">Inventory selling is available between auctions. Finish reviewing the auction first.</p>}
  </details>
  {confirm&&<AuctionDialog title="Reset your auction progress?" onClose={()=>setConfirm(false)}>
   <p>This removes your normal-play inventory, showcase, display name, auction statistics, pending collections and unfinished auction, restores $2,500 virtual cash, and resets the selling fee to 10%. Today’s daily challenge attempt is preserved. Previously shared snapshots are not removed. Other site preferences are unchanged.</p>
   <button className="game-control" type="button" onClick={()=>{reset();setConfirm(false)}}>Confirm reset</button>
  </AuctionDialog>}
 </section>;
}
