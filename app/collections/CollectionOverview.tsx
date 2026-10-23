"use client";
import {useState} from 'react';
import {collectionTotals,reviewMovers,type Holding,type CollectionReview,type CollectionSale} from '../../core/domain/owned-collections';
import {collectionPerformance} from '../../core/domain/collection-sales';
import {formatPercent} from '../../core/domain/formatters';
import InfoHint from '../InfoHint';
import SlidingTabs from '../SlidingTabs';
import {collectionMoney} from './CollectionLedger';
const profitTone=(value:number|null)=>value===null||value===0?'neutral':value<0?'down':'up';
export function CollectionMetric({label,value,hint,tone='blue'}:{label:string;value:string;hint:string;tone?:string}){return <div className={`detail-metric collection-metric tone-${tone}`}><small>{label}</small><strong>{value}</strong><span>{hint}</span></div>}
export function CollectionOverview({holdings,sales,expenses=0,allCollections=true}:{holdings:Holding[];sales:CollectionSale[];expenses?:number;allCollections?:boolean}){
 const totals=collectionTotals(holdings),profit=collectionPerformance(holdings,sales,expenses);
 const metrics=[{label:'Known Market Value',value:collectionMoney(totals.value),hint:`${totals.priced}/${totals.total} printings priced`,tone:'blue'},{label:'Market Movement Since Added',value:formatPercent(totals.percent,'N/A'),hint:`${collectionMoney(totals.change)} · ${totals.compared}/${totals.total} printings comparable`,tone:profitTone(totals.change)},{label:'Unrealized Purchase Gain / Loss',value:collectionMoney(profit.unrealized),hint:`${profit.costedQuantity}/${profit.quantity} owned cards have prices and costs`,tone:profitTone(profit.unrealized)},{label:'Realized Card Gain / Loss',value:collectionMoney(profit.realized),hint:`${profit.costedSoldQuantity}/${profit.soldQuantity} sold cards costed · before event expenses`,tone:profitTone(profit.realized)},{label:'Card Show Expenses',value:allCollections?collectionMoney(expenses):'Account-wide',hint:allCollections?'Paid expenses deducted once from combined profit':'See All Collections or Card Show Events',tone:expenses?'down':'neutral'},{label:'Combined Profit / Loss',value:collectionMoney(profit.combined),hint:allCollections?'Known realized + unrealized − event expenses':'Known card profit · before shared event expenses',tone:profitTone(profit.combined)}];
 return <section className="collection-overview" aria-label="Collection Overview">
<div className="collection-metric-heading">
<h2>Collection Overview</h2>
<InfoHint label="How collection performance is calculated">Market movement compares current prices with each dated lot’s starting market, for copies still owned. Adding stock is not a gain. Purchase gains use optional costs; sales use net proceeds and oldest lots first. Combined profit adds known realized and unrealized gains, deducting paid event expenses once in All Collections. Individual collections show card profit before shared expenses. Missing price/cost pairs are excluded with coverage counts, not assumed zero; partial totals are not complete portfolio profit. USD; Near Mint singles / unopened sealed.</InfoHint>
</div>
<div className="collection-metrics collection-overview-metrics">{metrics.map(metric=><CollectionMetric key={metric.label} {...metric}/>)}</div>
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
