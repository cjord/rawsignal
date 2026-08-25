"use client";
/* eslint-disable react-hooks/set-state-in-effect -- initial URL hydration must complete before URL replacement */
import {useCallback,useEffect,useRef,useState} from "react";
import {parseMarketQuery,serializeMarketQuery,type MarketQueryState} from "./market-query";

export function useMarketQueryState(onRestore:(state:MarketQueryState)=>void){
 const restoreRef=useRef(onRestore),[ready,setReady]=useState(false);
 useEffect(()=>{restoreRef.current=onRestore},[onRestore]);
 useEffect(()=>{const restore=()=>restoreRef.current(parseMarketQuery(location.search));restore();setReady(true);window.addEventListener("popstate",restore);return()=>window.removeEventListener("popstate",restore)},[]);
 const replace=useCallback((state:MarketQueryState)=>window.history.replaceState(null,"",`${location.pathname}?${serializeMarketQuery(state)}`),[]);
 return{urlReady:ready,replaceUrl:replace};
}
