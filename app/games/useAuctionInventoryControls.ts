"use client";
import {useEffect,useRef,useState} from 'react';
import {initialInventoryFilters,type InventoryFilters} from '../../core/domain/auction-inventory-management';
import {parseAuctionInventoryQuery,serializeAuctionInventoryQuery} from '../../core/domain/auction-inventory-query';
export function useAuctionInventoryControls(syncURL:boolean,resetSelection:()=>void){
 const [state,setState]=useState({filters:initialInventoryFilters,page:0,ready:!syncURL}),current=useRef(state);
 useEffect(()=>{if(!syncURL)return;const restore=()=>{const next={...parseAuctionInventoryQuery(location.search),ready:true};current.current=next;setState(next);resetSelection()};restore();window.addEventListener('popstate',restore);return()=>window.removeEventListener('popstate',restore)},[syncURL,resetSelection]);
 const write=(next:typeof state)=>{current.current=next;setState(next);if(syncURL){const query=serializeAuctionInventoryQuery(next.filters,next.page);history.replaceState(history.state,'',location.pathname+(query?'?'+query:'')+location.hash)}};
 return {...state,change:(patch:Partial<InventoryFilters>)=>write({...current.current,filters:{...current.current.filters,...patch},page:0}),setPage:(page:number)=>write({...current.current,page})};
}
