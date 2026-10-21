"use client";
/* eslint-disable react-hooks/set-state-in-effect -- catalog search is a debounced, cancellable data load. */
import {useEffect,useState,type FormEvent} from 'react';
import AuctionDialog from '../games/AuctionDialog';
import ProductIdentity from '../leaderboard/ProductIdentity';
import {formatUsd} from '../../core/domain/formatters';
import type {OwnedCollection} from '../../core/domain/owned-collections';
type Candidate={kind:'single'|'sealed';game:'pokemon'|'riftbound'|'onepiece';productId:number;printing:string;name:string;set:string;rarity:string;image:string|null;marketPrice:number|null};
export const moneyInput=(text:string)=>text.trim()===''?null:Math.round(Number(text)*100);
export default function CollectionAddDialog({collections,selected,onSave,onClose,initial}:{collections:OwnedCollection[];selected:string;onSave:(action:unknown)=>Promise<unknown>;onClose:()=>void;initial?:{productId:number;kind:string;game:string;printing:string}}){
 const [collectionId,setCollectionId]=useState(collections.some(row=>row.id===selected)?selected:collections[0]?.id??''),[kind,setKind]=useState(initial?.kind==='sealed'?'sealed':'single'),[game,setGame]=useState(initial?.game??'pokemon'),[query,setQuery]=useState(initial?String(initial.productId):''),[rows,setRows]=useState<Candidate[]>([]),[chosen,setChosen]=useState<Candidate|null>(null),[quantity,setQuantity]=useState('1'),[cost,setCost]=useState(''),[sticker,setSticker]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState('');
 useEffect(()=>{
  if(query.trim().length<2){setRows([]);return}const controller=new AbortController();setLoading(true);setError('');
  const timer=setTimeout(()=>{const params=new URLSearchParams({mode:kind==='sealed'?'sealed':'singles',market:game,rarity:'all',type:'all',q:query.trim(),perPage:'20'});
   const numeric=/^\d{1,9}$/.test(query.trim()),url=numeric?'/api/catalog/detail?'+new URLSearchParams({kind,market:game,productId:query.trim()}):'/api/catalog?'+params;
   void fetch(url,{signal:controller.signal}).then(async response=>{if(!response.ok)throw new Error('Catalog search unavailable');const result=await response.json();if(controller.signal.aborted)return;setRows((numeric?[result]:result.items).map((row:Candidate&{category?:string})=>({...row,kind,printing:kind==='sealed'?'Sealed':row.printing,rarity:row.rarity??row.category??'Sealed'})))}).catch(cause=>{if(!controller.signal.aborted)setError(cause.message)}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});
  },300);return()=>{clearTimeout(timer);controller.abort()};
 },[query,kind,game]);
 const submit=async(event:FormEvent)=>{event.preventDefault();if(!chosen||busy)return;setBusy(true);setError('');try{await onSave({type:'add',collectionId,items:[{kind:chosen.kind,game:chosen.game,productId:chosen.productId,printing:chosen.printing,quantity:Number(quantity),costCents:moneyInput(cost),stickerCents:moneyInput(sticker)}]});onClose()}catch(cause){setError(cause instanceof Error?cause.message:'Unable to add item')}finally{setBusy(false)}};
 const cardShow=collections.find(row=>row.id===collectionId)?.cardShow;
 return <AuctionDialog title="Add to Collection" onClose={()=>{if(!busy)onClose()}}>
<form onSubmit={event=>void submit(event)} className="collection-form">
<label>Collection<select value={collectionId} onChange={event=>setCollectionId(event.target.value)} required disabled={busy}>{collections.map(row=>
<option value={row.id} key={row.id}>{row.name}</option>)}</select>
</label>
<div className="collection-form-pair">
<label>Product Type<select value={kind} onChange={event=>{setKind(event.target.value);setChosen(null);if(event.target.value==='single'&&game==='onepiece')setGame('pokemon')}} disabled={busy}>
<option value="single">Singles</option>
<option value="sealed">Sealed</option>
</select>
</label>
<label>Game<select value={game} onChange={event=>{setGame(event.target.value);setChosen(null)}} disabled={busy}>
<option value="pokemon">Pokémon</option>
<option value="riftbound">Riftbound</option>{kind==='sealed'&&<option value="onepiece">One Piece</option>}</select>
</label>
</div>
<label>Find a Card or Product<input value={query} onChange={event=>{setQuery(event.target.value);setChosen(null)}} placeholder="Name or TCGplayer product ID" disabled={busy}/>
</label>
<div className="collection-search-results" aria-busy={loading}>{loading?<p role="status">Searching Catalog…</p>:rows.map((row,index)=>
<button className={`collection-search-item ${chosen===row?'is-selected':''}`} type="button" key={`${row.productId}:${row.printing}:${index}`} aria-pressed={chosen===row} onClick={()=>setChosen(row)}>
<ProductIdentity className="identity" image={row.image} alt="" title={row.name} meta={`${row.set} · ${row.printing}`}/>
<span>{formatUsd(row.marketPrice,'N/A')}</span>
</button>)}{!loading&&query.length>=2&&!rows.length&&<p>No matching catalog items.</p>}</div>{initial&&<p className="games-note">Select the exact printing you want to track: {initial.printing}. Unsupported printings will not receive a guessed price.</p>}{chosen&&<p className="account-notice">Selected: <strong>{chosen.name}</strong> · {chosen.printing}. Performance starts at the market snapshot available when saved; singles use Near Mint pricing.</p>}<div className="collection-form-pair">
<label>Quantity<input type="number" min="1" max="1000" step="1" required value={quantity} onChange={event=>setQuantity(event.target.value)} disabled={busy}/>
</label>
<label>Purchase Cost per Copy (Optional, USD)<input type="number" min="0" step="0.01" value={cost} onChange={event=>setCost(event.target.value)} disabled={busy}/>
</label>
</div>{cardShow&&<label>Sticker Price per Copy (Optional, USD)<input type="number" min="0" step="0.01" value={sticker} onChange={event=>setSticker(event.target.value)} disabled={busy}/>
</label>}{error&&<p role="alert" className="account-form-error">{error}</p>}<button className="game-control account-primary" type="submit" disabled={busy||!chosen||!collectionId}>{busy?'Saving…':'Add Item'}</button>
</form>
</AuctionDialog>;
}
