"use client";
/* eslint-disable react-hooks/set-state-in-effect -- initial URL hydration must complete before URL replacement */
import {useCallback,useEffect,useRef,useState} from "react";
import {getHistoryWriteMode,parseMarketQuery,serializeMarketQuery,type MarketQueryState} from "./market-query";

// Detail pages read this to make "Back to results" return to the exact filtered leaderboard.
const rememberListUrl=(url:string)=>{try{sessionStorage.setItem("raw-signal-last-list-url",url)}catch{/* Storage can be unavailable (private mode); the back button falls back to a default list. */}};

export function useMarketQueryState(onRestore:(state:MarketQueryState)=>void){
 const restoreRef=useRef(onRestore),lastStateRef=useRef<MarketQueryState|null>(null),restoringRef=useRef<string|null>(null),[ready,setReady]=useState(false);
 useEffect(()=>{restoreRef.current=onRestore},[onRestore]);
 useEffect(()=>{
  const restore=()=>{
   const state=parseMarketQuery(location.search),serialized=serializeMarketQuery(state),url=`${location.pathname}?${serialized}${location.hash}`;
   if(location.search.slice(1)!==serialized)window.history.replaceState(null,"",url);
   rememberListUrl(url);
   lastStateRef.current=state;restoringRef.current=serialized;restoreRef.current(state);
  };
  restore();setReady(true);window.addEventListener("popstate",restore);return()=>window.removeEventListener("popstate",restore);
 },[]);
 const write=useCallback((state:MarketQueryState)=>{
  const serialized=serializeMarketQuery(state);
  if(restoringRef.current===serialized){restoringRef.current=null;return}
  restoringRef.current=null;
  const mode=getHistoryWriteMode(lastStateRef.current,state);
  if(mode==="skip")return;
  const url=`${location.pathname}?${serialized}${location.hash}`;
  if(mode==="push")window.history.pushState(null,"",url);else window.history.replaceState(null,"",url);
  rememberListUrl(url);
  lastStateRef.current=state;
 },[]);
 return{urlReady:ready,writeUrl:write};
}
