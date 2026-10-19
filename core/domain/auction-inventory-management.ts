import type {Card} from './types.ts';
import {holdingKey,type AuctionCard,type AuctionSave} from './auction-types.ts';
import {inventoryQuote} from './auction-market.ts';
import {auctionSaleRarity} from './auction-economy.ts';

export type InventoryFilters={search:string;rarity:string;set:string;availability:'all'|'priced'|'unpriced';sort:'value-desc'|'value-asc'|'unit-desc'|'quantity-desc'|'rarity-desc'|'name'};
export const initialInventoryFilters:InventoryFilters={search:'',rarity:'',set:'',availability:'all',sort:'value-desc'};
const text=(value:string)=>value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function managedInventory(save:AuctionSave,catalog:AuctionCard[],cards:Card[],filters:InventoryFilters){
 const metadata=new Map(cards.map(card=>[holdingKey(card),card]));
 const rows=inventoryQuote(save.wallet.inventory,catalog,1000).rows.map(row=>{
  const card=metadata.get(holdingKey(row.holding))??row.card;
  return {...row,key:holdingKey(row.holding),name:card?.name??`Card ${row.holding.productId}`,image:card?.image??'',set:card?.set??'',rarity:card?auctionSaleRarity({...card,cents:row.card?.cents??0}):'Unknown',metadata:card};
 });
 const search=text(filters.search.trim()),matched=rows.filter(row=>(!search||text(`${row.name} ${row.set} ${row.holding.printing}`).includes(search))&&(!filters.rarity||row.rarity===filters.rarity)&&(!filters.set||row.set===filters.set)&&(filters.availability==='all'||(filters.availability==='priced')===(row.net!==null)));
 matched.sort((a,b)=>inventoryOrder(a,b,filters.sort));
 return {rows:matched,totalCopies:rows.reduce((sum,row)=>sum+row.holding.quantity,0),rarities:[...new Set(rows.map(row=>row.rarity))].sort(),sets:[...new Set(rows.map(row=>row.set).filter(Boolean))].sort()};
}
type ManagedRow=ReturnType<typeof managedInventory>['rows'][number];
function inventoryOrder(a:ManagedRow,b:ManagedRow,sort:InventoryFilters['sort']){
 const tie=()=>a.name.localeCompare(b.name)||a.holding.printing.localeCompare(b.holding.printing)||a.holding.productId-b.holding.productId;
 if(sort==='name')return tie();
 if(sort==='quantity-desc')return b.holding.quantity-a.holding.quantity||tie();
 if(sort==='rarity-desc'){
  const rank=(rarity:string)=>['Unknown','Other','Commons','Uncommons','Rares','Epics','Alt Arts','Showcase','Promo','Over-Numbered','Signatures'].indexOf(rarity);
  return rank(b.rarity)-rank(a.rarity)||tie();
 }
 if(a.net===null||b.net===null)return Number(a.net===null)-Number(b.net===null)||tie();
 if(sort==='unit-desc')return b.card!.cents-a.card!.cents||tie();
 return (sort==='value-asc'?a.net-b.net:b.net-a.net)||tie();
}
export function inventorySalePlan(save:AuctionSave,catalog:AuctionCard[],keys:readonly string[],keep=0){
 if(!Number.isSafeInteger(keep)||keep<0)return {rows:[],copies:0,net:0};
 const chosen=new Set(keys),holdings=save.wallet.inventory.filter(row=>chosen.has(holdingKey(row))).map(row=>({...row,quantity:Math.max(0,row.quantity-keep)})).filter(row=>row.quantity>0);
 const quote=inventoryQuote(holdings,catalog,1000),rows=quote.rows.filter(row=>row.net!==null);
 return {rows,copies:rows.reduce((sum,row)=>sum+row.holding.quantity,0),net:rows.reduce((sum,row)=>sum+row.net!,0)};
}
export function sellInventorySelection(save:AuctionSave,catalog:AuctionCard[],keys:readonly string[],keep=0):AuctionSave{
 if(save.auction||!Number.isSafeInteger(keep)||keep<0)return save;
 const plan=inventorySalePlan(save,catalog,keys,keep);if(!plan.copies||!Number.isSafeInteger(plan.net)||!Number.isSafeInteger(save.wallet.cash+plan.net))return save;
 const quantities=new Map(plan.rows.map(row=>[holdingKey(row.holding),row.holding.quantity]));
 return {...save,wallet:{...save.wallet,cash:save.wallet.cash+plan.net,inventory:save.wallet.inventory.map(row=>({...row,quantity:row.quantity-(quantities.get(holdingKey(row))??0)})).filter(row=>row.quantity>0)}};
}
