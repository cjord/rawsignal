"use client";
import {useCallback,useEffect,useSyncExternalStore} from 'react';
import {legacyAuctionCatalog} from './auction-legacy-catalog';

// Catalog prices are public; account-owned game progress still remounts independently.
export function useRiftboundCatalog(enabled=true){
 const state=useSyncExternalStore(legacyAuctionCatalog.subscribe,legacyAuctionCatalog.getSnapshot,legacyAuctionCatalog.getServerSnapshot);
 useEffect(()=>{if(enabled)void legacyAuctionCatalog.refresh()},[enabled]);
 const reload=useCallback(()=>{void legacyAuctionCatalog.refresh(true)},[]);
 return {...state,status:!enabled?'idle' as const:state.status==='idle'?'loading' as const:state.status,reload};
}
