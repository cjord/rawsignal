"use client";
import {useState,type FormEvent} from 'react';
import type {CardShowEvent,CollectionSale} from '../../core/domain/owned-collections';
import {groupedSales,saleTotals} from '../../core/domain/collection-sales';
import AuctionDialog from '../games/AuctionDialog';
import {NumberedPagination} from '../MarketUI';
import {CollectionMetric} from './CollectionOverview';
import {collectionMoney} from './CollectionLedger';
import {moneyInput} from './CollectionAddDialog';

function EventDialog({event,onSave,onClose}:{event:CardShowEvent|null;onSave:(action:unknown)=>Promise<unknown>;onClose:()=>void}){
 const [name,setName]=useState(event?.name??''),[date,setDate]=useState(event?.date??''),[expenses,setExpenses]=useState(event?String(event.expensesCents/100):''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const submit=async(e:FormEvent)=>{e.preventDefault();setBusy(true);setError('');try{await onSave({type:'event',eventId:event?.id,name,date,expensesCents:moneyInput(expenses)??0});onClose()}catch(cause){setError(cause instanceof Error?cause.message:'Unable to save event')}finally{setBusy(false)}};
 return <AuctionDialog title={event?'Edit Card Show Event':'New Card Show Event'} onClose={()=>{if(!busy)onClose()}}><form className="collection-form" onSubmit={e=>void submit(e)}>
 <label>Event Name<input required maxLength={80} value={name} disabled={busy} onChange={e=>setName(e.target.value)}/></label>
 <label>Event Date<input required type="date" value={date} disabled={busy} onChange={e=>setDate(e.target.value)}/></label>
 <label>Expenses Paid (Optional, USD)<input type="number" min="0" step="0.01" value={expenses} disabled={busy} onChange={e=>setExpenses(e.target.value)}/></label>
 <p className="games-note">Enter actual shared costs such as a table, travel or supplies. Sale proceeds are already after selling fees—do not include those fees again. This event can contain sales from multiple collections.</p>
 {error&&<p role="alert">{error}</p>}<button className="game-control account-primary" disabled={busy}>{busy?'Saving…':'Save Event'}</button>
 </form></AuctionDialog>;
}
function EventCard({event,sales,onEdit}:{event:CardShowEvent;sales:CollectionSale[];onEdit:()=>void}){
 const totals=saleTotals(sales),profit=totals.profit===null?null:totals.profit-event.expensesCents;
 return <article className="detail-section collection-event" aria-label={event.name}>
 <div className="collection-section-heading"><div><h3>{event.name}</h3><p className="games-note">{event.date} · {groupedSales(sales).length} sales · {totals.quantity} cards sold</p></div><button className="game-control" onClick={onEdit}>Edit Event</button></div>
 <div className="collection-metrics">
 <CollectionMetric label="Net Sale Proceeds" value={collectionMoney(totals.proceeds)} hint="All event sales · after selling fees"/>
 <CollectionMetric label="Known Purchase Cost" value={collectionMoney(totals.cost)} hint={`${totals.costedQuantity}/${totals.quantity} sold cards costed`} tone="purple"/>
 <CollectionMetric label="Event Expenses" value={collectionMoney(event.expensesCents)} hint="Paid shared costs · counted once" tone={event.expensesCents?'down':'neutral'}/>
 <CollectionMetric label="Net Profit / Loss" value={collectionMoney(profit)} hint="Costed sales profit − all event expenses" tone={profit===null||profit===0?'neutral':profit<0?'down':'up'}/>
 </div>{totals.costedQuantity<totals.quantity&&<p className="games-note">Profit excludes sales with unknown purchase costs, including their proceeds. It is a partial figure; known event expenses are deducted in full.</p>}
 </article>;
}
export default function CollectionEvents({events,sales,onSave}:{events:CardShowEvent[];sales:CollectionSale[];onSave:(action:unknown)=>Promise<unknown>}){
 const [dialog,setDialog]=useState<CardShowEvent|null|undefined>(undefined),[page,setPage]=useState(1),pages=Math.max(1,Math.ceil(events.length/10)),current=Math.min(page,pages),sorted=[...events].sort((a,b)=>b.date.localeCompare(a.date)||a.name.localeCompare(b.name));
 return <section className="collection-events" aria-label="Card Show Events">
 <div className="collection-section-heading"><h2>Card Show Events</h2><button className="game-control account-primary" onClick={()=>setDialog(null)}>New Card Show Event</button></div>
 <p className="games-note">Account-wide events can combine sales from several collections. Assign a show when recording a sale or later in Sold History. Expenses affect the account-wide combined total, never each collection separately.</p>
 {sorted.slice((current-1)*10,current*10).map(event=><EventCard key={event.id} event={event} sales={sales.filter(row=>row.eventId===event.id)} onEdit={()=>setDialog(event)}/>)}
 {!events.length&&<p className="collection-empty">No events yet. Create a named show and record its date and optional paid expenses.</p>}
 {pages>1&&<NumberedPagination page={current} pages={pages} onChange={setPage} label="Card Show Event Pages"/>}
 {dialog!==undefined&&<EventDialog event={dialog} onSave={onSave} onClose={()=>setDialog(undefined)}/>}
 </section>;
}
