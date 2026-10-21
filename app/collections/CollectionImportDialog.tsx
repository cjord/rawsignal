"use client";
import {useState} from 'react';
import AuctionDialog from '../games/AuctionDialog';
import {readStoredImport} from '../state/collectr-import';
import {useAccount} from '../account/context';
import {productKey,type CollectionProduct,type OwnedCollections,type ProductRef} from '../../core/domain/owned-collections';
import {formatUsd} from '../../core/domain/formatters';
export default function CollectionImportDialog({state,revision,selected,onSave,onClose}:{state:OwnedCollections;revision:number;selected:string;onSave:(action:unknown)=>Promise<unknown>;onClose:()=>void}){
 const {user}=useAccount(),[source]=useState(readStoredImport),[collectionId,setCollectionId]=useState(state.collections.some(row=>row.id===selected)?selected:state.collections[0]?.id??''),[skip,setSkip]=useState(true),[unknown,setUnknown]=useState(false),[matched,setMatched]=useState<CollectionProduct[]|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const candidates=(source?.payload.cards??[]).filter(row=>row.matched&&['pokemon','riftbound','onepiece'].includes(row.matched.game)&&!(row.kind==='single'&&row.matched.game==='onepiece')&&(row.kind==='sealed'||['Near Mint','NM'].includes(row.condition??'')||unknown&&!row.condition)).map(row=>({kind:row.kind,game:row.matched!.game,productId:row.matched!.productId,printing:row.kind==='sealed'?'Sealed':row.printing??'Normal',quantity:row.quantity}));
 const quantities=new Map<string,number>();for(const row of candidates){const key=productKey(row as ProductRef);quantities.set(key,(quantities.get(key)??0)+row.quantity)}
 const existing=new Set(state.lots.filter(lot=>lot.collectionId===collectionId&&lot.quantity>0).map(lot=>productKey(lot.product))),items=(matched??[]).filter(row=>!skip||!existing.has(productKey(row)));
 const preview=async()=>{setBusy(true);setError('');try{if(!candidates.length||candidates.length>1000)throw new Error('Choose an import with 1–1,000 supported rows. Other conditions are not imported.');if([...quantities.values()].some(value=>!Number.isSafeInteger(value)||value<1||value>1000))throw new Error('Combined quantities must be 1–1,000 per printing. Review duplicate rows or split this import first.');const response=await fetch('/api/account/collections',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({owner:user?.id,revision,action:{type:'preview',items:candidates}})}),data=await response.json();if(!response.ok)throw new Error(data.error??'Unable to check import');if(data.owner!==user?.id)throw new Error('The signed-in account changed. Reload first.');setMatched(data.prices)}catch(cause){setError(cause instanceof Error?cause.message:'Unable to check import')}finally{setBusy(false)}};
 const save=async()=>{setBusy(true);setError('');try{await onSave({type:'add',collectionId,source:'collectr',skipExisting:skip,items:items.map(row=>({kind:row.kind,game:row.game,productId:row.productId,printing:row.printing,quantity:quantities.get(productKey(row))??1}))});onClose()}catch(cause){setError(cause instanceof Error?cause.message:'Import failed')}finally{setBusy(false)}};
 return <AuctionDialog title="Review Collectr Import" onClose={()=>{if(!busy)onClose()}}>
<div className="collection-form">{!source?<p>No saved account import. <a href="/import">Open Collectr Import</a> first, then return here. Nothing from a guest import is copied automatically.</p>:<>
<p>{source.payload.cards.length} imported rows · {source.payload.partial?'Partial Collectr import':'Saved Collectr import'}. Only exact supported printings are eligible; graded and unsupported conditions are excluded.</p>
<label>Destination Collection<select value={collectionId} onChange={event=>setCollectionId(event.target.value)} disabled={busy}>{state.collections.map(row=>
<option key={row.id} value={row.id}>{row.name}</option>)}</select>
</label>
<label>Existing Holdings<select value={skip?'skip':'add'} onChange={event=>setSkip(event.target.value==='skip')} disabled={busy}>
<option value="skip">Skip Existing</option>
<option value="add">Add Quantities as New Dated Lots</option>
</select>
</label>
<label className="auction-public-toggle">
<input type="checkbox" checked={unknown} disabled={busy} onChange={event=>{setUnknown(event.target.checked);setMatched(null)}}/>
<span>I Confirm Singles with Missing Condition May Use Near Mint Pricing</span>
</label>
<button className="game-control" disabled={busy} onClick={()=>void preview()}>{busy?'Checking…':'Check Matching Printings'}</button>{matched&&<>
<p className="account-notice">{items.length} new lots ready · {source.payload.cards.length-candidates.length} unsupported rows excluded · {quantities.size-matched.length} unmatched printings excluded · {skip?matched.length-items.length:0} existing printings skipped. Duplicate rows of the same printing are combined. Current market is captured on confirmation, not Collectr’s quoted value.</p>
<ul className="collection-import-list">{items.map(row=>
<li key={productKey(row)}>{row.name} · {row.printing} · ×{quantities.get(productKey(row))} · {formatUsd(row.cents===null?null:row.cents/100,'N/A')}</li>)}</ul>
<button className="game-control account-primary" disabled={busy||!items.length} onClick={()=>void save()}>{busy?'Saving…':`Import ${items.length} Dated Lots`}</button>
</>}</>}{error&&<p role="alert" className="account-form-error">{error}</p>}</div>
</AuctionDialog>;
}
