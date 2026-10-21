"use client";
/* eslint-disable react-hooks/set-state-in-effect -- resolve device-only scope after hydration. */
import {useCallback,useEffect,useRef,useState} from 'react';
import {parseSetsScope,serializeSetsScope,type SetsScope} from './sets-scope.ts';
export * from './sets-scope.ts';

export function useSetsScopeUrl(onRestore:(scope:ReturnType<typeof parseSetsScope>)=>void){
 const restoreRef=useRef(onRestore),[ready,setReady]=useState(false);
 useEffect(()=>{restoreRef.current=onRestore},[onRestore]);
 useEffect(()=>{const restore=()=>restoreRef.current(parseSetsScope(location.search));restore();setReady(true);window.addEventListener('popstate',restore);return()=>window.removeEventListener('popstate',restore)},[]);
 const write=useCallback((scope:SetsScope,{push=true}={})=>{const url=`/sets?${serializeSetsScope(scope)}`;if(push)history.pushState(null,'',url);else history.replaceState(null,'',url)},[]);
 return {ready,write};
}
