"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps -- request state follows a source list represented by sourceKey */
import {useCallback,useEffect,useMemo,useState} from "react";

export type CatalogStatus="idle"|"loading"|"success"|"empty"|"error";
type Options<T>={enabled?:boolean;sources:string[];parse:(value:unknown)=>T[];keyOf?:(item:T)=>string|number};

export async function loadCatalogSources<T>(sources:string[],parse:(value:unknown)=>T[],signal:AbortSignal,fetcher:typeof fetch=fetch){
 // A 404 means the section has not materialized in this deployment yet (a staged rollout,
 // e.g. Japanese promos before their first ingestion run) — contribute nothing rather than
 // failing every other section in the batch. Other failures still surface.
 const groups=await Promise.all(sources.map(async source=>{const response=await fetcher(source,{signal});if(response.status===404)return [] as T[];if(!response.ok)throw new Error(`Catalog request failed: ${response.status}`);return parse(await response.json())}));
 return groups.flat();
}

export function useCatalogPage<T>({enabled=true,sources,parse,keyOf}:Options<T>){
 const sourceKey=sources.join("\u0000"),[revision,setRevision]=useState(0),[items,setItems]=useState<T[]>([]),[status,setStatus]=useState<CatalogStatus>(enabled?"loading":"idle"),[error,setError]=useState<string|null>(null);
 const reload=useCallback(()=>setRevision(value=>value+1),[]);
 useEffect(()=>{
  if(!enabled){setStatus("idle");return}
  const controller=new AbortController();setStatus("loading");setError(null);
  loadCatalogSources(sources,parse,controller.signal).then(rows=>{if(controller.signal.aborted)return;const next=keyOf?[...new Map(rows.map(item=>[keyOf(item),item])).values()]:rows;setItems(next);setStatus(next.length?"success":"empty")}).catch(reason=>{if(controller.signal.aborted)return;setItems([]);setError(reason instanceof Error?reason.message:"Catalog unavailable");setStatus("error")});
  return()=>controller.abort();
 },[enabled,sourceKey,revision,parse,keyOf]);
 return useMemo(()=>({items,status,loading:status==="loading",error,reload}),[items,status,error,reload]);
}
