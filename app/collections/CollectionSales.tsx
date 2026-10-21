"use client";
import {useState} from 'react';
import {groupedSales} from '../../core/domain/collection-sales';
import type {CardShowEvent,CollectionSale,OwnedCollection} from '../../core/domain/owned-collections';
import type {CollectionFilters} from '../state/collection-query';
import {soldCsv} from '../../core/domain/collection-export';
import CollectionExportButton from './CollectionExportButton';
import ProductIdentity from '../leaderboard/ProductIdentity';
import AuctionDialog from '../games/AuctionDialog';
import {NumberedPagination,SortToolbar} from '../MarketUI';
import {collectionMoney} from './CollectionLedger';

type SaleGroup=ReturnType<typeof groupedSales>[number];
function AssignmentDialog({group,events,onSave,onClose}:{group:SaleGroup;events:CardShowEvent[];onSave:(action:unknown)=>Promise<unknown>;onClose:()=>void}){
 const [eventId,setEventId]=useState(group.first.eventId??''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const save=async()=>{setBusy(true);setError('');try{await onSave({type:'sale-event',groupKey:group.key,eventId:eventId||null});onClose()}catch(cause){setError(cause instanceof Error?cause.message:'Unable to assign event')}finally{setBusy(false)}};
 return <AuctionDialog title="Assign Sale to Event" onClose={()=>{if(!busy)onClose()}}><div className="collection-form"><p>{group.first.name} · {group.quantity} cards · {collectionMoney(group.proceeds)} net</p>
 <label>Card Show Event<select value={eventId} disabled={busy} onChange={e=>setEventId(e.target.value)}><option value="">No Event</option>{events.map(event=><option key={event.id} value={event.id}>{event.name} · {event.date}</option>)}</select></label>
 <p className="games-note">Changes the entire sale, including allocations from other collections. Quantity, proceeds and historical purchase cost are not changed.</p>{error&&<p role="alert">{error}</p>}<button className="game-control account-primary" disabled={busy} onClick={()=>void save()}>{busy?'Saving…':'Save Assignment'}</button></div></AuctionDialog>;
}
function SaleCard({group,event,onAssign}:{group:SaleGroup;event?:CardShowEvent;onAssign:()=>void}){
 const first=group.first;
 return <article className="collection-sale">
 <div className="collection-section-heading"><ProductIdentity className="identity" image={first.product?.image??null} alt="" title={`${first.name} · ×${group.quantity}`} meta={`${first.product?.printing??'Printing not recorded'} · ${first.date.slice(0,10)} UTC`}/><button className="game-control" onClick={onAssign}>{event?'Change Event':'Assign Event'}</button></div>
 <p className="games-note">{event?`${event.name} · ${event.date}`:'No Event'}</p>
 <dl className="collection-sale-values"><div><dt>Net Proceeds</dt><dd>{collectionMoney(group.proceeds)}</dd></div><div><dt>Known Purchase Cost</dt><dd>{collectionMoney(group.cost)}</dd></div><div><dt>Realized Card Gain / Loss</dt><dd className={group.profit===null||group.profit===0?'':group.profit<0?'down':'up'}>{collectionMoney(group.profit)}</dd></div></dl>
 <p className="games-note">{group.costedQuantity}/{group.quantity} sold cards have known costs · card profit is before shared event expenses.</p>
 <details className="collection-lots"><summary>{group.rows.length} Dated Lot {group.rows.length===1?'Allocation':'Allocations'}</summary>{group.rows.map(row=><div className="collection-lot" key={row.id}><span>×{row.quantity} · Net {collectionMoney(row.netCents)}<small>Recorded cost {collectionMoney(row.costCents)}</small></span></div>)}</details>
 </article>;
}
const columns=[{key:'date',label:'Sale Date'},{key:'proceeds',label:'Net Proceeds'},{key:'profit',label:'Card Profit'}] as const;
export default function CollectionSales({sales,events,collections,filter,change,onSave}:{sales:CollectionSale[];events:CardShowEvent[];collections:OwnedCollection[];filter:CollectionFilters;change:(patch:Partial<CollectionFilters>)=>void;onSave:(action:unknown)=>Promise<unknown>}){
 const [selected,setSelected]=useState<SaleGroup|null>(null),{soldQ:query,soldEvent:eventId,soldSort:sort,soldDirection:direction,page}=filter;
 const groups=groupedSales(sales).filter(group=>group.first.name.toLowerCase().includes(query.toLowerCase())&&(eventId==='all'||(group.first.eventId??'none')===eventId));
 groups.sort((a,b)=>{const av=sort==='date'?a.first.date:a[sort],bv=sort==='date'?b.first.date:b[sort];if(av===null)return bv===null?0:1;if(bv===null)return -1;const result=typeof av==='string'?av.localeCompare(String(bv)):av-Number(bv);return result*(direction==='asc'?1:-1)});
 const pages=Math.max(1,Math.ceil(groups.length/20)),current=Math.min(page,pages);
 const changeSort=(next:typeof sort)=>change({soldDirection:next===sort&&direction==='desc'?'asc':'desc',soldSort:next});
 return <section className="detail-section collection-sales" aria-label="Sold History"><div className="collection-section-heading"><h2>Sold History</h2><CollectionExportButton label="Export Sold CSV" filename="raw-signal-sold-history.csv" disabled={!groups.length} build={()=>soldCsv(groups.flatMap(group=>group.rows),collections,events)}/></div>
 <p className="games-note">Completed sales stay in your account after the holding is sold out or removed. New sales group FIFO allocations into one record; older records remain separate because their original sale grouping was not saved. Figures use recorded proceeds and costs, not today’s market.</p>
 <div className="collection-toolbar"><label>Search Sold Items<input value={query} onChange={e=>change({soldQ:e.target.value})}/></label><label>Filter Sales by Event<select value={eventId} onChange={e=>change({soldEvent:e.target.value})}><option value="all">All Events</option><option value="none">No Event</option>{events.map(event=><option key={event.id} value={event.id}>{event.name}</option>)}</select></label><button className="game-control" onClick={()=>change({soldQ:'',soldEvent:'all'})}>Clear Sale Filters</button><small>{groups.length} {groups.length===1?'sale':'sales'}</small></div>
 <SortToolbar label="Sort Sold History" items={columns} sort={sort} direction={direction} onSort={changeSort}/>
 {groups.slice((current-1)*20,current*20).map(group=><SaleCard key={group.key} group={group} event={events.find(event=>event.id===group.first.eventId)} onAssign={()=>setSelected(group)}/>)}
 {!groups.length&&<p className="collection-empty">No completed sales match this view.</p>}
 {pages>1&&<NumberedPagination page={current} pages={pages} onChange={page=>change({page})} label="Sold History Pages"/>}
 {selected&&<AssignmentDialog group={selected} events={events} onSave={onSave} onClose={()=>setSelected(null)}/>}
 </section>;
}
