"use client";
import {useState} from 'react';
import type {AuctionCard,AuctionSave} from '../../core/domain/auction-types';
import {inventoryQuote} from '../../core/domain/auction-market';
import {auctionSaleRarity} from '../../core/domain/auction-economy';
import {sellInventory} from '../../core/domain/auction-engine';
import AuctionDialog from './AuctionDialog';
import {auctionUsd} from './AuctionWallet';

export default function AuctionInventorySales({save,catalog,loading,transact}:{save:AuctionSave;catalog:AuctionCard[];loading:boolean;transact:(update:(save:AuctionSave)=>AuctionSave)=>void}){
 const [selection,setSelection]=useState<string|null>(null);
 const quote=inventoryQuote(save.wallet.inventory,catalog,1000);
 const priced=quote.rows.filter(row=>row.net!==null&&row.card);
 const groups=[...new Set(['Commons','Uncommons','Rares','Epics','Alt Arts','Over-Numbered','Signatures',...priced.map(row=>auctionSaleRarity(row.card!))])];
 const selected=selection==='all'?priced:priced.filter(row=>auctionSaleRarity(row.card!)===selection);
 const proceeds=selected.reduce((sum,row)=>sum+row.net!,0),copies=selected.reduce((sum,row)=>sum+row.holding.quantity,0);
 const disabled=!!save.auction||loading;
 return <><div className="auction-actions auction-rarity-sales" aria-label="Sell priced inventory">{groups.map(group=><button key={group} className="game-control" type="button" disabled={disabled||!priced.some(row=>auctionSaleRarity(row.card!)===group)} onClick={()=>setSelection(group)}>Sell {group}</button>)}<button className="game-control" type="button" disabled={disabled||!priced.length} onClick={()=>setSelection('all')}>Sell All</button></div>
  {selection&&<AuctionDialog title={selection==='all'?'Sell All Priced Inventory?':`Sell ${selection}?`} onClose={()=>setSelection(null)}><p>Sell {copies} copies for {loading?'N/A':auctionUsd(proceeds)} virtual cash after the fixed 10% fee. Showcase cards, other rarities and unpriced cards remain owned. This cannot be undone.</p><button className="game-control" type="button" disabled={disabled||!selected.length} onClick={()=>{transact(current=>sellInventory(current,catalog,undefined,selection==='all'?undefined:selection));setSelection(null)}}>Confirm sale</button></AuctionDialog>}
 </>;
}
