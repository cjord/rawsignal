"use client";
import {useState} from 'react';
import {collectionTotals,reviewMovers,type Holding,type CollectionReview,type CollectionSale} from '../../core/domain/owned-collections';
import {formatPercent} from '../../core/domain/formatters';
import InfoHint from '../InfoHint';
import SlidingTabs from '../SlidingTabs';
import {collectionMoney} from './CollectionLedger';
export function CollectionOverview({holdings,sales}:{holdings:Holding[];sales:CollectionSale[]}){
 const totals=collectionTotals(holdings),knownSales=sales.filter(row=>row.costCents!==null),realized=knownSales.length?knownSales.reduce((sum,row)=>sum+row.netCents-row.costCents!,0):null;
 const metrics=[{label:'Known Market Value',value:collectionMoney(totals.value),hint:`${totals.priced}/${totals.total} printings priced`,tone:'blue'},{label:'Market Movement Since Added',value:formatPercent(totals.percent,'N/A'),hint:`${collectionMoney(totals.change)} · ${totals.compared}/${totals.total} printings comparable`,tone:totals.change!==null&&totals.change<0?'down':'up'},{label:'Unrealized Purchase Gain / Loss',value:collectionMoney(totals.profit),hint:'Only holdings with known purchase costs',tone:totals.profit!==null&&totals.profit<0?'down':'up'},{label:'Realized Gain / Loss',value:collectionMoney(realized),hint:`${totals.quantity} owned copies · ${sales.reduce((sum,row)=>sum+row.quantity,0)} sold copies`,tone:realized!==null&&realized<0?'down':'purple'}];
 return <section className="collection-overview" aria-label="Collection Overview">
<div className="collection-metric-heading">
<h2>Collection Overview</h2>
<InfoHint label="How collection performance is calculated">Market movement compares current prices with each dated lot’s market price when added, for copies still owned. Adding stock is not a gain. Purchase gains use your optional cost. Sales use total net proceeds and oldest lots first. Missing prices/costs are excluded, not estimated; realized gains include only costed sales. USD; raw singles use Near Mint, sealed uses unopened pricing.</InfoHint>
</div>
<div className="collection-metrics">{metrics.map(metric=>
<div key={metric.label} className={`detail-metric collection-metric tone-${metric.tone}`}>
<small>{metric.label}</small>
<strong>{metric.value}</strong>
<span>{metric.hint}</span>
</div>)}</div>
</section>;
}
export function VisitMovers({holdings,reviews,busy,onReview}:{holdings:Holding[];reviews:CollectionReview[];busy:boolean;onReview:()=>void}){
 const [open,setOpen]=useState(false),[selected,setSelected]=useState(''),[rank,setRank]=useState('impact');const sorted=[...reviews].sort((a,b)=>b.date.localeCompare(a.date)),review=sorted.find(row=>row.date===selected)??sorted[0]??null,movers=reviewMovers(holdings,review),changed=movers.filter(row=>row.change!==null&&row.change!==0).sort((a,b)=>Math.abs(rank==='percent'?b.percent??0:b.change??0)-Math.abs(rank==='percent'?a.percent??0:a.change??0)),added=movers.reduce((sum,row)=>sum+row.addedQuantity,0);
 return <section className="detail-section collection-movers">
<div className="collection-section-heading">
<button className="collection-disclosure" onClick={()=>setOpen(value=>!value)} aria-expanded={open} aria-controls="collection-movers-list">Changes Since Review <span>{review?`${changed.length} movers · ${review.date} UTC`:'Set Your First Review Point'}</span>
</button>
<button className="game-control" disabled={busy||!holdings.length} onClick={onReview}>Mark as Reviewed</button>
</div>{open&&<div id="collection-movers-list">
<p className="games-note">Opening or reloading does not reset your comparison. Mark as Reviewed stores at most three distinct UTC review days; another review today replaces today’s point. New copies are separate, not gains.</p>{review?<>
<div className="collection-toolbar">
<label>Compare with<select value={review.date} onChange={event=>setSelected(event.target.value)}>{sorted.map(row=>
<option key={row.date}>{row.date}</option>)}</select>
</label>
<SlidingTabs label="Mover Ranking" selectedKey={rank} onSelect={setRank} options={[{key:'impact',label:'Dollar Impact'},{key:'percent',label:'Percentage'}]}/>
</div>{changed.slice(0,10).map(row=>
<div key={row.key} className="collection-mover">
<span>
<b>{row.product.name}</b>
<small>{row.product.printing} · {row.comparedQuantity} previously owned copies</small>
</span>
<strong className={row.change!<0?'down':'up'}>{collectionMoney(row.change)} · {formatPercent(row.percent)}</strong>
</div>)}{!changed.length&&<p>No comparable price movement since this review.</p>}<p className="games-note">{added} newly added copies are excluded from the movement ranking. Missing price pairs remain unavailable.</p>
</>:<p>No review snapshot yet. Mark this collection as reviewed to start comparisons on future visits.</p>}</div>}</section>;
}
