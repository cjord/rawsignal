"use client";
/* eslint-disable react-hooks/set-state-in-effect -- resolve device-only scope after hydration. */
import {useCallback,useEffect,useRef,useState} from 'react';
import {parseMetricsScope,serializeMetricsScope,type MetricsMode,type MetricsMarket} from './metrics-scope.ts';
export * from './metrics-scope.ts';

export function useMetricsScopeUrl(onRestore:(scope:ReturnType<typeof parseMetricsScope>)=>void){
 const restoreRef=useRef(onRestore),[ready,setReady]=useState(false);
 useEffect(()=>{restoreRef.current=onRestore},[onRestore]);
 useEffect(()=>{const restore=()=>restoreRef.current(parseMetricsScope(location.search));restore();setReady(true);window.addEventListener('popstate',restore);return()=>window.removeEventListener('popstate',restore)},[]);
 const write=useCallback((mode:MetricsMode,market:MetricsMarket,{push=true}={})=>{const url=`/metrics?${serializeMetricsScope(mode,market)}`;if(push)history.pushState(null,'',url);else history.replaceState(null,'',url)},[]);
 return {ready,write};
}
