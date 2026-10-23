"use client";
/* eslint-disable react-hooks/set-state-in-effect -- private data hydrates on account change, never from guest storage. */
import {useCallback,useEffect,useRef,useState} from 'react';
import {useAccount} from '../account/context';
import {parseCollections,type OwnedCollections,type CollectionProduct} from '../../core/domain/owned-collections';
import {notify} from '../notifications/store';
export type CollectionPayload={owner:string;state:OwnedCollections;revision:number;prices:CollectionProduct[];pricingUnavailable:boolean};
function checked(data:CollectionPayload,owner:string){if(data.owner!==owner||!Number.isSafeInteger(data.revision)||!Array.isArray(data.prices))throw new Error('The signed-in account changed. Reload before continuing.');parseCollections(JSON.stringify(data.state));return data}
class SaveFailure extends Error{requiresReload:boolean;constructor(message:string,reload:boolean){super(message);this.requiresReload=reload}}
async function saveCollection(owner:string,revision:number,action:unknown){
 const response=await fetch('/api/account/collections',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({owner,revision,action})}),payload=await response.json();
 if(!response.ok)throw new SaveFailure(payload.error??'Collection save failed.',[401,409].includes(response.status)||response.status>=500);
 const next=checked(payload,owner);if(next.revision!==revision+1)throw new Error('Unexpected save acknowledgement');return next;
}
function savedMessage(action:unknown){const type=(action as {type?:string})?.type??'',messages:Record<string,string>={create:'Collection created.',add:'Items saved to your collection.',sell:'Sale recorded in Sold History.',review:'Review checkpoint saved.',event:'Card show event saved.','sale-event':'Sale event updated.',lot:'Dated lot saved.',remove:'Lot removed. Recorded sales were retained.',update:'Collection settings saved.'};return messages[type]??'Collection saved.'}
export function useCollections(){
 const account=useAccount(),owner=account.user?.id??'',enabled=!!owner&&!account.loading&&!!account.features?.collections;
 const [data,setData]=useState<CollectionPayload|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[needsReload,setNeedsReload]=useState(false),[attempt,setAttempt]=useState(0),current=useRef(owner),working=useRef(false);
 useEffect(()=>{current.current=owner;return()=>{current.current=''}},[owner]);
 useEffect(()=>{
  if(!enabled){setData(null);setLoading(false);return}let active=true;const controller=new AbortController();setLoading(true);setError('');
  void fetch('/api/account/collections',{cache:'no-store',credentials:'same-origin',signal:controller.signal}).then(async response=>{if(!response.ok)throw new Error('Unable to load your collections. Retry without making changes.');const payload=checked(await response.json(),owner);if(active){setData(payload);setNeedsReload(false);if(attempt)notify('Latest saved collection loaded.',{id:'collection-reload',tone:'success'})}}).catch(cause=>{if(active){setNeedsReload(true);setError(cause instanceof Error?cause.message:'Collections unavailable')}}).finally(()=>{if(active)setLoading(false)});
  return()=>{active=false;controller.abort()};
 },[enabled,owner,attempt]);
 const act=useCallback(async(action:unknown)=>{
  if(!data||working.current||loading)throw new Error('Wait for your collection to finish loading or saving.');if(needsReload)throw new Error('Reload your saved collection before trying another change.');working.current=true;setBusy(true);setError('');
  try{const next=await saveCollection(owner,data.revision,action);if(current.current!==owner)throw new Error('Account changed; reload before continuing.');setData(next);notify(savedMessage(action),{id:'collection-save',tone:'success'});return next;
  }catch(cause){const reload=!(cause instanceof SaveFailure)||cause.requiresReload,message=cause instanceof SaveFailure?cause.message:'Save could not be confirmed. Reload the saved collection before retrying; do not repeat a sale blindly.';if(current.current===owner){setError(message);setNeedsReload(reload);notify(message,{id:'collection-save',tone:'warning'})}throw new Error(message)}finally{working.current=false;if(current.current===owner)setBusy(false)}
 },[data,owner,loading,needsReload]);
 return {data:enabled&&data?.owner===owner?data:null,loading,busy,error,needsReload,act,reload:()=>{if(!working.current&&!loading)setAttempt(value=>value+1)}};
}
