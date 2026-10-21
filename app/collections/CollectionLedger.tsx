"use client";
import ProductIdentity from '../leaderboard/ProductIdentity';
import DeferredImage from '../DeferredImage';
import {NumberedPagination,SortableHeader,SortToolbar} from '../MarketUI';
import type {CollectionLot,Holding} from '../../core/domain/owned-collections';
import {formatPercent} from '../../core/domain/formatters';
export const collectionMoney=(cents:number|null)=>cents===null?'N/A':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100);
const tone=(value:number|null)=>value===null||value===0?'':value>0?'up':'down';
type Sort='name'|'quantity'|'value'|'change'|'percent';
export function orderHoldings(rows:Holding[],sort:Sort,direction:'asc'|'desc'){
 return [...rows].sort((a,b)=>{const av=sort==='name'?a.product.name:a[sort],bv=sort==='name'?b.product.name:b[sort];if(av===null)return bv===null?a.key.localeCompare(b.key):1;if(bv===null)return -1;const result=typeof av==='string'?av.localeCompare(String(bv)):av-Number(bv);return (direction==='asc'?result:-result)||a.key.localeCompare(b.key)});
}
function Sticker({holding}:{holding:Holding}){const values=new Set(holding.lots.map(lot=>lot.stickerCents));return <strong className="collection-sticker">Sticker · {values.size===1?collectionMoney(holding.lots[0].stickerCents):'Varies by Lot'}</strong>}
const columns=[{key:'name',label:'Card / Product'},{key:'quantity',label:'Quantity'},{key:'value',label:'Market Value'},{key:'change',label:'Since Added'},{key:'percent',label:'Change %'}] as const;
function Lots({holding,cardShow,disabled,onManage}:{holding:Holding;cardShow:boolean;disabled:boolean;onManage:(lot:CollectionLot)=>void}){return <details className="collection-lots">
<summary>{holding.lots.length} Dated {holding.lots.length===1?'Lot':'Lots'}</summary>
<div>{holding.lots.map(lot=>
<div className="collection-lot" key={lot.id}>
<span>{lot.addedAt.slice(0,10)} · ×{lot.quantity}<small>Starting market / item {collectionMoney(lot.product.cents)} · Cost / item {collectionMoney(lot.costCents)}</small>{cardShow&&<small className="collection-sticker">Sticker per Copy · {collectionMoney(lot.stickerCents)}</small>}
</span>
<button className="game-control" disabled={disabled} onClick={()=>onManage(lot)} aria-label={`Manage ${lot.product.name} lot ${lot.addedAt.slice(0,10)}`}>Manage</button>
</div>)}</div>
</details>}
export default function CollectionLedger({holdings,view,cardShow,sort,direction,page,disabled,onPage,onSort,onManage,onSell}:{holdings:Holding[];view:string;cardShow:boolean;sort:Sort;direction:'asc'|'desc';page:number;disabled:boolean;onPage:(page:number)=>void;onSort:(column:Sort)=>void;onManage:(lot:CollectionLot)=>void;onSell:(holding:Holding)=>void}){
 const pages=Math.max(1,Math.ceil(holdings.length/30)),current=Math.min(page,pages),rows=orderHoldings(holdings,sort,direction).slice((current-1)*30,current*30);
 return <>
{view==='grid'&&<SortToolbar items={columns} sort={sort} direction={direction} onSort={onSort} label="Sort Collection Holdings"/>}
<div className={`collection-ledger ${view==='grid'?'collection-grid':''}`} role={view==='grid'?'list':'table'} aria-label="Collection Holdings">{view!=='grid'&&<div className="collection-columns" role="row">{columns.map(column=>
<SortableHeader key={column.key} label={column.label} column={column.key} sort={sort} direction={direction} onSort={onSort}/>)}<span role="columnheader">Manage</span>
</div>}{rows.map(holding=>
<div className="collection-holding-group" key={holding.key} role={view==='grid'?'listitem':'rowgroup'}><article className="collection-holding" role={view==='grid'?undefined:'row'}>
<a href={`/${holding.product.kind==='sealed'?'sealed':'cards'}/${holding.product.productId}${holding.product.kind==='sealed'?`?market=${holding.product.game}`:''}`} className="collection-identity" role={view==='grid'?undefined:'cell'}>{view==='grid'?<>
<DeferredImage src={holding.product.image} alt=""/>
<b>{holding.product.name}</b>
<small>{holding.product.set} · {holding.product.printing}</small>
</>:<ProductIdentity className="identity" image={holding.product.image} alt="" title={holding.product.name} meta={`${holding.product.set} · ${holding.product.printing}`}/>}</a>
<span className="collection-number" role={view==='grid'?undefined:'cell'}>
<small>Quantity</small>{holding.quantity}</span>
<strong className="collection-number" role={view==='grid'?undefined:'cell'}>
<small>Market Value</small>{collectionMoney(holding.value)}<small className="collection-unit-price">{collectionMoney(holding.product.cents)} / item</small></strong>
<span className={`collection-number ${tone(holding.change)}`} role={view==='grid'?undefined:'cell'}>
<small>Since Added</small>{collectionMoney(holding.change)}</span>
<span className={`collection-number ${tone(holding.change)}`} role={view==='grid'?undefined:'cell'}>
<small>Change %</small>{formatPercent(holding.percent,'N/A')}</span>
<div className="collection-row-actions" role={view==='grid'?undefined:'cell'}>
<button className="game-control" disabled={disabled} onClick={()=>onSell(holding)} aria-label={`Record sale of ${holding.product.name}`}>Record Sale</button>
{cardShow&&<Sticker holding={holding}/>}</div></article><div className="collection-lot-expansion" role={view==='grid'?undefined:'row'}><div role={view==='grid'?undefined:'cell'} aria-colspan={view==='grid'?undefined:6}><Lots holding={holding} cardShow={cardShow} disabled={disabled} onManage={onManage}/></div></div>
</div>)}</div>{!rows.length&&<p className="collection-empty">No holdings match this view. Add an item or adjust your filters.</p>}{pages>1&&<NumberedPagination page={current} pages={pages} onChange={onPage} label="Collection Holdings Pages"/>}</>;
}
