"use client";
/* eslint-disable react-hooks/set-state-in-effect -- initial URL hydration must complete before URL replacement */
import {useCallback,useEffect,useRef,useState} from "react";
import {getHistoryWriteMode,parseMarketQuery,serializeMarketQuery,type MarketQueryState} from "./market-query";

// Detail pages read this to make "Back to results" return to the exact filtered leaderboard.
const rememberListUrl=(url:string)=>{try{sessionStorage.setItem("raw-signal-last-list-url",url)}catch{/* Storage can be unavailable (private mode); the back button falls back to a default list. */}};

export function useMarketQueryState(onRestore:(state:MarketQueryState,rawSearch:string)=>void){
 const restoreRef=useRef(onRestore),lastStateRef=useRef<MarketQueryState|null>(null),restoringRef=useRef<string|null>(null),[ready,setReady]=useState(false);
 useEffect(()=>{restoreRef.current=onRestore},[onRestore]);
 useEffect(()=>{
  const restore=()=>{
   // rawSearch is captured BEFORE normalization: replaceState below strips params the
   // codec never serializes (e.g. a shared link's strictness), and restore callbacks
   // need to see what the visitor actually opened.
   const rawSearch=location.search;
   const state=parseMarketQuery(rawSearch),serialized=serializeMarketQuery(state),url=`${location.pathname}?${serialized}${location.hash}`;
   if(location.search.slice(1)!==serialized)window.history.replaceState(null,"",url);
   rememberListUrl(url);
   lastStateRef.current=state;restoringRef.current=serialized;restoreRef.current(state,rawSearch);
  };
  restore();setReady(true);window.addEventListener("popstate",restore);return()=>window.removeEventListener("popstate",restore);
 },[]);
 const write=useCallback((state:MarketQueryState)=>{
  const serialized=serializeMarketQuery(state);
  if(restoringRef.current!==null){
   const restoring=restoringRef.current;
   restoringRef.current=null;
   if(restoring===serialized)return;
   // The first write after a restore is the page normalizing the restored entry under
   // device state (mode masks, remembered-market landings). Normalization REPLACES the
   // entry — pushing here would trap Back in a restore→normalize→push loop.
   const url=`${location.pathname}?${serialized}${location.hash}`;
   window.history.replaceState(null,"",url);
   rememberListUrl(url);
   lastStateRef.current=state;
   return;
  }
  const mode=getHistoryWriteMode(lastStateRef.current,state);
  if(mode==="skip")return;
  const url=`${location.pathname}?${serialized}${location.hash}`;
  if(mode==="push")window.history.pushState(null,"",url);else window.history.replaceState(null,"",url);
  rememberListUrl(url);
  lastStateRef.current=state;
 },[]);
 return{urlReady:ready,writeUrl:write};
}
