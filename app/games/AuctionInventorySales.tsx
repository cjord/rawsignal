"use client";
import {useState} from 'react';
import type {AuctionCard,AuctionSave} from '../../core/domain/auction-types';
import {inventoryQuote} from '../../core/domain/auction-market';
import {auctionSaleRarity} from '../../core/domain/auction-economy';
import {sellInventory} from '../../core/domain/auction-engine';
import AuctionSaleConfirmation,{type AuctionMarketCheck} from './AuctionSaleConfirmation';

export default function AuctionInventorySales({save,catalog,loading,transact,checkMarket}:{save:AuctionSave;catalog:AuctionCard[];loading:boolean;transact:(update:(save:AuctionSave)=>AuctionSave)=>void;checkMarket?:AuctionMarketCheck}){
 const [selection,setSelection]=useState<string|null>(null);
 const quote=inventoryQuote(save.wallet.inventory,catalog,1000);
 const priced=quote.rows.filter(row=>row.net!==null&&row.card);
 const groups=[...new Set(['Commons','Uncommons','Rares','Epics','Alt Arts','Over-Numbered','Signatures',...priced.map(row=>auctionSaleRarity(row.card!))])];
 const disabled=!!save.auction||loading;
 return <><div className="auction-actions auction-rarity-sales" aria-label="Sell priced inventory">{groups.map(group=><button key={group} className="game-control" data-sale-rarity={group} type="button" disabled={disabled||!priced.some(row=>auctionSaleRarity(row.card!)===group)} onClick={()=>setSelection(group)}>Sell {group}</button>)}<button className="game-control" type="button" disabled={disabled||!priced.length} onClick={()=>setSelection('all')}>Sell All</button></div>
  {selection&&<AuctionSaleConfirmation title={selection==='all'?'Sell All Priced Inventory?':`Sell ${selection}?`} label="Confirm sale" save={save} catalog={catalog} disabled={disabled} transact={transact} checkMarket={checkMarket} close={()=>setSelection(null)} quote={(current,prices)=>raritySaleQuote(current,prices,selection)} commit={(current,prices)=>sellInventory(current,prices,undefined,selection==='all'?undefined:selection)}><p>Showcase cards, other rarities and unpriced cards remain owned. This cannot be undone.</p></AuctionSaleConfirmation>}
 </>;
}
function raritySaleQuote(save:AuctionSave,catalog:AuctionCard[],selection:string){
 const rows=inventoryQuote(save.wallet.inventory,catalog,1000).rows.filter(row=>row.net!==null&&row.card&&(selection==='all'||auctionSaleRarity(row.card)===selection));
 return {copies:rows.reduce((sum,row)=>sum+row.holding.quantity,0),net:rows.reduce((sum,row)=>sum+row.net!,0)};
}
