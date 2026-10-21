"use client";
import {useCallback,useMemo,useState} from 'react';
import type {AuctionCard,AuctionSave} from '../../core/domain/auction-types';
import type {Card} from '../../core/domain/types';
import {initialInventoryFilters,managedInventory,inventorySalePlan,sellInventorySelection,type InventoryFilters} from '../../core/domain/auction-inventory-management';
import {auctionRarity} from '../../core/domain/auction-display';
import DeferredImage from '../DeferredImage';
import AuctionSaleConfirmation,{type AuctionMarketCheck} from './AuctionSaleConfirmation';
import AuctionInventorySales from './AuctionInventorySales';
import {auctionUsd} from './AuctionWallet';
import InventoryFiltersPanel from './AuctionInventoryFilters';
import {useAuctionInventoryControls} from './useAuctionInventoryControls';
import AuctionInventorySkeleton from './AuctionInventorySkeleton';

const PAGE_SIZE=24;
type Props={save:AuctionSave;catalog:AuctionCard[];cards:Card[];loading:boolean;transact:(update:(save:AuctionSave)=>AuctionSave)=>void;urlState?:boolean;checkMarket?:AuctionMarketCheck};
export default function AuctionInventoryManager({save,catalog,cards,loading,transact,urlState=false,checkMarket}:Props){
 const [selected,setSelected]=useState<string[]>([]),[sale,setSale]=useState<{keys:string[];keep:number}|null>(null),resetSelection=useCallback(()=>setSelected([]),[setSelected]);
 const controls=useAuctionInventoryControls(urlState,resetSelection),{filters,page,setPage}=controls;
 const inventory=useMemo(()=>managedInventory(save,catalog,cards,filters),[save,catalog,cards,filters]),pages=Math.max(1,Math.ceil(inventory.rows.length/PAGE_SIZE)),current=Math.min(page,pages-1),rows=inventory.rows.slice(current*PAGE_SIZE,(current+1)*PAGE_SIZE);
 const disabled=loading||Boolean(save.auction),eligible=inventory.rows.filter(row=>row.net!==null),validKeys=new Set(eligible.map(row=>row.key)),selection=selected.filter(key=>validKeys.has(key));
 const selectedPlan=inventorySalePlan(save,catalog,selection);
 const change=(patch:Partial<InventoryFilters>)=>{controls.change(patch);setSelected([])};
 if(!controls.ready)return <AuctionInventorySkeleton/>;
 return <div className="auction-inventory-manager" role="region" aria-label="Auction Inventory Manager">
  <InventoryFiltersPanel filters={filters} rarities={inventory.rarities} sets={inventory.sets} change={change}/>
  <p className="games-note" role="status">{inventory.rows.length} Matching Printings · {inventory.totalCopies} Total Sellable Copies · Page {current+1} of {pages}. Showcase cards are protected and are not listed here.</p>
  <div className="auction-actions auction-inventory-selection"><button className="game-control" type="button" disabled={disabled||!rows.some(row=>row.net!==null)} onClick={()=>setSelected([...new Set([...selection,...rows.filter(row=>row.net!==null).map(row=>row.key)])])}>Select This Page</button><button className="game-control" type="button" disabled={disabled||!eligible.length} onClick={()=>setSelected(eligible.map(row=>row.key))}>Select All Filtered</button><button className="game-control" type="button" disabled={!selection.length} onClick={()=>setSelected([])}>Clear Selection</button><button className="game-control game-control-secondary" type="button" disabled={disabled||!selectedPlan.copies} onClick={()=>setSale({keys:selection,keep:0})}>Sell Selected ({selectedPlan.copies})</button><button className="game-control" type="button" disabled={disabled||!eligible.some(row=>row.holding.quantity>3)} onClick={()=>setSale({keys:eligible.map(row=>row.key),keep:3})}>Sell Filtered Extras (Keep 3)</button></div>
  <p className="auction-inventory-selection-summary">{selection.length} Selected Printings · {loading?'N/A':auctionUsd(selectedPlan.net)} Sale Value After Fee</p>
  <div className="auction-inventory-grid">{rows.map(row=><label className="auction-owned-card" data-rarity={auctionRarity(row.metadata??undefined)} key={row.key}><input type="checkbox" aria-label={`Select ${row.name} (${row.holding.printing})`} checked={selection.includes(row.key)} disabled={disabled||row.net===null} onChange={event=>setSelected(event.target.checked?[...selection,row.key]:selection.filter(key=>key!==row.key))}/><DeferredImage src={row.image} alt=""/><div><b>{row.name}</b><small>{row.holding.printing} · Near Mint · ×{row.holding.quantity}</small><small>{row.set||'Set Unavailable'} · {row.rarity}</small><strong>{!loading&&row.net!==null?auctionUsd(row.net):'N/A'} after fee</strong></div></label>)}</div>
  {!rows.length&&<p className="games-note">No inventory matches these filters. <button className="game-control" type="button" onClick={()=>change(initialInventoryFilters)}>Clear Filters</button></p>}
  <div className="auction-actions" aria-label="Inventory Pages"><button className="game-control" type="button" disabled={current===0} onClick={()=>setPage(current-1)}>Previous Inventory Page</button><button className="game-control" type="button" disabled={current+1>=pages} onClick={()=>setPage(current+1)}>Next Inventory Page</button></div>
  <details className="auction-inventory-quick-sales"><summary>Sell by Rarity or Sell All (Entire Inventory)</summary><AuctionInventorySales save={save} catalog={catalog} loading={loading} transact={transact} checkMarket={checkMarket}/></details>
  {sale&&<AuctionSaleConfirmation title={sale.keep?'Sell Filtered Extra Copies?':'Sell Selected Inventory?'} label="Confirm Inventory Sale" save={save} catalog={catalog} disabled={disabled} transact={transact} checkMarket={checkMarket} close={()=>{setSale(null);setSelected([])}} quote={(current,prices)=>inventorySalePlan(current,prices,sale.keys,sale.keep)} commit={(current,prices)=>sellInventorySelection(current,prices,sale.keys,sale.keep)}><p>{sale.keep?'Keep at least three of each matching printing in sellable inventory. ':''}Unpriced cards, unselected printings and showcase cards remain owned. This cannot be undone.</p></AuctionSaleConfirmation>}
 </div>;
}
