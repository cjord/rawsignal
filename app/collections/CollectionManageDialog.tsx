"use client";
import {useState,type FormEvent} from 'react';
import AuctionDialog from '../games/AuctionDialog';
import {formatUsd} from '../../core/domain/formatters';
import type {CardShowEvent,CollectionLot,Holding,OwnedCollection} from '../../core/domain/owned-collections';
import {stickerSaleSuggestion} from '../../core/domain/collection-sales';
import {moneyInput} from './CollectionAddDialog';
type Props={onClose:()=>void;onSave:(action:unknown)=>Promise<unknown>};
function saleAllocations(lots:CollectionLot[],quantity:number){let remaining=Math.max(0,quantity);const result=[];for(const lot of lots){const amount=Math.min(remaining,lot.quantity);remaining-=amount;if(amount>0)result.push({lot,amount})}return result}
export function CollectionSettingsDialog({collection,onClose,onSave}:Props&{collection?:OwnedCollection}){
 const [name,setName]=useState(collection?.name??''),[show,setShow]=useState(collection?.cardShow??false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const submit=async(event:FormEvent)=>{event.preventDefault();setBusy(true);try{await onSave(collection?{type:'update',collectionId:collection.id,name,cardShow:show}:{type:'create',name});onClose()}catch(cause){setError(cause instanceof Error?cause.message:'Unable to save collection')}finally{setBusy(false)}};
 return <AuctionDialog title={collection?'Collection Settings':'New Collection'} onClose={()=>{if(!busy)onClose()}}>
<form className="collection-form" onSubmit={event=>void submit(event)}>
<label>Collection Name<input required maxLength={80} value={name} onChange={event=>setName(event.target.value)} disabled={busy}/>
</label>{collection&&<label className="auction-public-toggle">
<input type="checkbox" checked={show} onChange={event=>setShow(event.target.checked)} disabled={busy}/>
<span>Card Show Mode · Show Optional Sticker Prices</span>
</label>}<p className="games-note">Private to your account. Asking prices never change market values or gains.</p>{error&&<p role="alert">{error}</p>}<button className="game-control account-primary" disabled={busy||!name.trim()}>{busy?'Saving…':collection?'Save Settings':'Create Collection'}</button>
</form>
</AuctionDialog>;
}
export function CollectionLotDialog({lot,cardShow,onClose,onSave}:Props&{lot:CollectionLot;cardShow:boolean}){
 const [quantity,setQuantity]=useState(String(lot.quantity)),[cost,setCost]=useState(lot.costCents===null?'':String(lot.costCents/100)),[sticker,setSticker]=useState(lot.stickerCents===null?'':String(lot.stickerCents/100)),[busy,setBusy]=useState(false),[error,setError]=useState(''),[remove,setRemove]=useState(false);
 const save=async(event:FormEvent)=>{event.preventDefault();setBusy(true);try{await onSave(remove?{type:'remove',lotId:lot.id}:{type:'lot',lotId:lot.id,quantity:Number(quantity),costCents:moneyInput(cost),stickerCents:moneyInput(sticker)});onClose()}catch(cause){setError(cause instanceof Error?cause.message:'Unable to update lot')}finally{setBusy(false)}};
 return <AuctionDialog title="Manage Dated Lot" onClose={()=>{if(!busy)onClose()}}>
<p>{lot.product.name} · Added {lot.addedAt.slice(0,10)}</p>
<p className="games-note">Correcting quantity keeps the original baseline. Use Add Item for a new acquisition on another day.</p>
<form className="collection-form" onSubmit={event=>void save(event)}>{!remove?<>
<label>Correct Quantity<input required type="number" min="1" max="1000" step="1" value={quantity} onChange={event=>setQuantity(event.target.value)} disabled={busy}/>
</label>
<label>Purchase Cost per Copy (USD)<input type="number" min="0" step="0.01" value={cost} onChange={event=>setCost(event.target.value)} disabled={busy}/>
</label>{cardShow&&<label>Sticker Price per Copy (USD)<input type="number" min="0" step="0.01" value={sticker} onChange={event=>setSticker(event.target.value)} disabled={busy}/>
</label>}<button className="game-control account-delete" type="button" disabled={busy} onClick={()=>setRemove(true)}>Remove / Correct Entry</button>
</>:<p className="account-notice">Remove this lot? This is a correction, not a sale. Its tracking baseline will be removed, while recorded sales stay in your history.</p>}{error&&<p role="alert">{error}</p>}<button className={`game-control ${remove?'account-delete':'account-primary'}`} disabled={busy}>{busy?'Saving…':remove?'Confirm Remove Lot':'Save Lot'}</button>
</form>
</AuctionDialog>;
}
export function CollectionSaleDialog({holding,collectionId,events=[],onClose,onSave}:Props&{holding:Holding;collectionId:string;events?:CardShowEvent[]}){
 const [quantity,setQuantity]=useState('1'),[proceeds,setProceeds]=useState(''),[manual,setManual]=useState(false),[eventId,setEventId]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const suggested=stickerSaleSuggestion(holding.lots,Number(quantity)),amount=manual?proceeds:suggested===null?'':(suggested/100).toFixed(2);
 const allocations=saleAllocations(holding.lots,Number(quantity));
 const save=async(event:FormEvent)=>{event.preventDefault();setBusy(true);try{await onSave({type:'sell',collectionId,key:holding.key,quantity:Number(quantity),netCents:moneyInput(amount),eventId:eventId||null});onClose()}catch(cause){setError(cause instanceof Error?cause.message:'Unable to record sale')}finally{setBusy(false)}};
 return <AuctionDialog title="Record Sale" onClose={()=>{if(!busy)onClose()}}>
<p>{holding.product.name} · {holding.product.printing}</p>
<form className="collection-form" onSubmit={event=>void save(event)}>
<label>Quantity Sold<input required type="number" step="1" min="1" max={Math.min(1000,holding.quantity)} value={quantity} onChange={event=>setQuantity(event.target.value)} disabled={busy}/>
</label>
<label>Total Net Proceeds (USD, After Fees)<input required type="number" step="0.01" min="0" value={amount} onChange={event=>{setProceeds(event.target.value);setManual(true)}} disabled={busy}/>
</label>
{suggested!==null&&<p className="games-note">Sticker total: {(suggested/100).toFixed(2)} USD. Adjust for the negotiated price and any fees; no fees are deducted automatically. {manual&&<button className="game-control" type="button" disabled={busy} onClick={()=>setManual(false)}>Use Sticker Total</button>}</p>}
<label>Card Show Event (Optional)<select value={eventId} disabled={busy} onChange={event=>setEventId(event.target.value)}><option value="">No Event</option>{events.map(row=><option key={row.id} value={row.id}>{row.name} · {row.date}</option>)}</select></label>
<p className="games-note">Oldest additions first. This records your sale; it does not list or sell anything online.</p>
<ul>{allocations.map(({lot,amount})=>
<li key={lot.id}>{amount} from {lot.addedAt.slice(0,10)} · cost {lot.costCents===null?'N/A':formatUsd(lot.costCents*amount/100)}</li>)}</ul>{error&&<p role="alert">{error}</p>}<button className="game-control account-primary" disabled={busy}>{busy?'Saving…':'Confirm Sale'}</button>
</form>
</AuctionDialog>;
}
