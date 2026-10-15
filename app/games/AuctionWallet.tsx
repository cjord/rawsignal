"use client";
import {useState} from 'react';
import DeferredImage from '../DeferredImage';
import InfoHint from '../InfoHint';
import AuctionDialog from './AuctionDialog';
import type {AuctionCard,AuctionSave} from '../../core/domain/auction-types';
import type {Card} from '../../core/domain/types';
import {holdingKey} from '../../core/domain/auction-types';
import {inventoryQuote} from '../../core/domain/auction-market';
import {changeAuctionFee} from '../../core/domain/auction-engine';
import {auctionRarity} from '../../core/domain/auction-display';
import AuctionInventorySales from './AuctionInventorySales';

export const auctionUsd=(cents:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100);
type Props={save:AuctionSave;catalog:AuctionCard[];cards:Card[];transact:(update:(save:AuctionSave)=>AuctionSave)=>void;reset:()=>void;refresh:()=>void;loading:boolean};
export default function AuctionWallet({save,catalog,cards,transact,reset,refresh,loading}:Props){
 const [confirm,setConfirm]=useState(false),[fee,setFee]=useState<string|null>(null);
 const quote=inventoryQuote(save.wallet.inventory,catalog,save.wallet.feeBps),between=!save.auction;
 const available=!quote.unpriced&&(!loading||!save.wallet.inventory.length),metadata=new Map(cards.map(card=>[holdingKey(card),card]));
 return <section className="detail-section auction-wallet" aria-label="Virtual bankroll and inventory">
  <div className="auction-wallet-title"><div><span className="games-eyebrow">Virtual Net Worth</span><p className="auction-net-worth"><span className="auction-cash-value">{auctionUsd(save.wallet.cash)}</span> + (<span className="auction-inventory-value">{available?auctionUsd(quote.net):'N/A'} cards</span>) <InfoHint label="Inventory valuation and selling fees">Card value uses the latest catalog loaded here, less a {save.wallet.feeBps/100}% virtual selling fee. Missing prices are unavailable, never zero. Market prices are not guaranteed sale proceeds. Use Refresh market to reload the catalog.</InfoHint></p></div></div>
  <div className="auction-actions"><button className="game-control" type="button" disabled={loading} onClick={refresh}>Refresh market</button><button className="game-control" type="button" onClick={()=>setConfirm(true)}>Reset cash &amp; inventory</button></div>
  {quote.unpriced>0&&<p className="games-note">{quote.unpriced} owned copies have unavailable current prices. You can sell priced copies; unavailable ones remain in inventory.</p>}
  <details className="auction-inventory"><summary>Inventory ({save.wallet.inventory.reduce((sum,row)=>sum+row.quantity,0)} copies)</summary>
   {!quote.rows.length?<p className="games-note">Win an auction to start your collection.</p>:<><div className="auction-inventory-grid">{quote.rows.map(row=><div className="auction-owned-card" data-rarity={auctionRarity(metadata.get(holdingKey(row.holding)))} key={holdingKey(row.holding)}>
    <DeferredImage src={metadata.get(holdingKey(row.holding))?.image} alt=""/><div><b>{metadata.get(holdingKey(row.holding))?.name??`Card ${row.holding.productId}`}</b><small>{row.holding.printing} · Near Mint · ×{row.holding.quantity}</small><strong>{!loading&&row.net!==null?auctionUsd(row.net):'N/A'} after fee</strong></div>
   </div>)}</div><AuctionInventorySales save={save} catalog={catalog} loading={loading} transact={transact}/></>}
   {!between&&<p className="games-note">Inventory selling and fee changes are available between auctions. Finish reviewing the auction first.</p>}
  </details>
  <details className="auction-fee"><summary>Game settings · selling fee {save.wallet.feeBps/100}%</summary><label>Selling fee (%) <input type="number" min="0" max="100" step="1" value={fee??String(save.wallet.feeBps/100)} disabled={!between} onChange={event=>setFee(event.target.value)}/></label><button className="game-control" type="button" disabled={!between||fee===null||!/^\d{1,3}$/.test(fee)||Number(fee)>100} onClick={()=>{transact(current=>changeAuctionFee(current,Number(fee)*100));setFee(null)}}>Apply fee</button><p className="games-note">A configurable virtual game rule, not actual marketplace fees. Changing it affects future sales and the current inventory display.</p></details>
  {confirm&&<AuctionDialog title="Reset your auction progress?" onClose={()=>setConfirm(false)}>
   <p>This removes your saved inventory and unfinished auction, restores $2,500 virtual cash, and resets the selling fee to 10%. Other site preferences are unchanged.</p>
   <button className="game-control" type="button" onClick={()=>{reset();setConfirm(false)}}>Confirm reset</button>
  </AuctionDialog>}
 </section>;
}
