"use client";
/* eslint-disable react-hooks/set-state-in-effect -- private data hydrates on account change, never from guest storage. */
import {useCallback,useEffect,useRef,useState} from 'react';
import {useAccount} from '../account/context';
import {parseCollections,type OwnedCollections,type CollectionProduct} from '../../core/domain/owned-collections';
export type CollectionPayload={owner:string;state:OwnedCollections;revision:number;prices:CollectionProduct[];pricingUnavailable:boolean};
function checked(data:CollectionPayload,owner:string){if(data.owner!==owner||!Number.isSafeInteger(data.revision)||!Array.isArray(data.prices))throw new Error('The signed-in account changed. Reload before continuing.');parseCollections(JSON.stringify(data.state));return data}
export function useCollections(){
 const account=useAccount(),owner=account.user?.id??'',enabled=!!owner&&!account.loading&&!!account.features?.collections;
 const [data,setData]=useState<CollectionPayload|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[attempt,setAttempt]=useState(0),current=useRef(owner),working=useRef(false);
 useEffect(()=>{current.current=owner;return()=>{current.current=''}},[owner]);
 useEffect(()=>{
  setData(null);if(!enabled){setLoading(false);return}let active=true;const controller=new AbortController();setLoading(true);setError('');
  void fetch('/api/account/collections',{cache:'no-store',credentials:'same-origin',signal:controller.signal}).then(async response=>{if(!response.ok)throw new Error('Unable to load your collections. Retry without making changes.');const payload=checked(await response.json(),owner);if(active)setData(payload)}).catch(cause=>{if(active)setError(cause instanceof Error?cause.message:'Collections unavailable')}).finally(()=>{if(active)setLoading(false)});
  return()=>{active=false;controller.abort()};
 },[enabled,owner,attempt]);
 const act=useCallback(async(action:unknown)=>{
  if(!data||working.current)throw new Error('Wait for your collection to finish saving.');working.current=true;setBusy(true);setError('');
  try{const response=await fetch('/api/account/collections',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({owner,revision:data.revision,action})}),payload=await response.json();if(!response.ok)throw new Error(payload.error??'Collection save failed; nothing was overwritten.');if(current.current!==owner)throw new Error('Account changed; reload before continuing.');const next=checked(payload,owner);if(next.revision!==data.revision+1)throw new Error('Unexpected save acknowledgement. Reload your collections.');setData(next);return next;
  }catch(cause){const message=cause instanceof Error?cause.message:'Collection save failed';if(current.current===owner)setError(message);throw cause}finally{working.current=false;if(current.current===owner)setBusy(false)}
 },[data,owner]);
 return {data:enabled&&data?.owner===owner?data:null,loading,busy,error,act,reload:()=>setAttempt(value=>value+1)};
}
