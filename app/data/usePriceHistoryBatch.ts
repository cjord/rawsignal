"use client";
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {parsePriceHistory} from "../../core/domain/contracts.ts";
import {deriveHistoryMetrics} from "../../core/domain/history-metrics.ts";
import type {PriceHistory} from "../../core/domain/types";
import {mapWithConcurrency} from "../../core/market-utils.ts";
import {chunkHistoryTargets,encodeHistoryTargets,historyBatchKey} from "../../core/history-batch.ts";

export type HistoryTarget={productId:number;printing:string;sealed?:boolean};
export type HistoryStatus="idle"|"loading"|"partial"|"success"|"empty"|"error";
type BatchEntry={target:HistoryTarget;history:PriceHistory;failed:boolean};
const unavailableHistory:PriceHistory={points:[],coverage:"none",change7:null,change30:null,change90:null,low30:null,high30:null,historyLow:null,historyHigh:null};
export const historyTargetKey=(target:HistoryTarget)=>`${target.sealed?"sealed":"single"}:${target.productId}:${target.printing.toLowerCase()}`;

export function usePriceHistoryPrefetch(targets:HistoryTarget[],enabled:boolean,request:(targets:HistoryTarget[])=>Promise<void>){
 const targetsRef=useRef(targets);
 const key=targets.map(historyTargetKey).join(",");
 useEffect(()=>{targetsRef.current=targets},[targets]);
 useEffect(()=>{if(enabled)void request(targetsRef.current)},[enabled,key,request]);
}

// One request per page of rows (review §14 follow-up): the batch route answers from stored
// observations; anything it has no series for (null) falls back to the single-product
// route, which owns the upstream fetch. A failed batch request degrades to singles too.
async function loadStoredBatch(targets:HistoryTarget[],signal:AbortSignal,fetcher:typeof fetch):Promise<Map<string,PriceHistory>>{
 const found=new Map<string,PriceHistory>();
 await Promise.all(chunkHistoryTargets(targets).map(async chunk=>{
  try{
   const response=await fetcher(`/api/history/batch?t=${encodeHistoryTargets(chunk)}`,{signal});if(!response.ok)return;
   const body=await response.json() as {histories?:Record<string,unknown>};
   for(const target of chunk){const raw=body.histories?.[historyBatchKey(target)];if(raw==null)continue;try{const parsed=parsePriceHistory(raw);found.set(historyTargetKey(target),{...parsed,...deriveHistoryMetrics(parsed.points)})}catch{/* a malformed entry falls back to the single route */}}
  }catch(error){if(signal.aborted||(error instanceof DOMException&&error.name==="AbortError"))throw error}
 }));
 return found;
}

export async function loadPriceHistoryBatch(targets:HistoryTarget[],signal:AbortSignal,fetcher:typeof fetch=fetch,limit=4){
 const stored=targets.length>1?await loadStoredBatch(targets,signal,fetcher):new Map<string,PriceHistory>();
 return mapWithConcurrency(targets,limit,async target=>{
  const fromBatch=stored.get(historyTargetKey(target));if(fromBatch)return{target,history:fromBatch,failed:false} satisfies BatchEntry;
  if(signal.aborted)throw new DOMException("Request aborted","AbortError");
  try{
   const params=new URLSearchParams({productId:String(target.productId),printing:target.printing});if(target.sealed)params.set("sealed","1");
   const response=await fetcher(`/api/history?${params}`,{signal});if(!response.ok)throw new Error(`History request failed: ${response.status}`);
   const parsed=parsePriceHistory(await response.json()),history={...parsed,...deriveHistoryMetrics(parsed.points)};
   return{target,history,failed:false} satisfies BatchEntry;
  }catch(error){if(signal.aborted||(error instanceof DOMException&&error.name==="AbortError"))throw error;return{target,history:unavailableHistory,failed:true} satisfies BatchEntry}
 });
}

// One-shot batch load for static target sets (detail-page tables, metrics movers):
// fetch once per serialized target list and fill entries in as they land, keyed by
// historyTargetKey so singles and sealed targets never collide.
export function useHistoryOnce(targets:HistoryTarget[]){
 const [history,setHistory]=useState<Record<string,PriceHistory>>({});
 const key=targets.map(historyTargetKey).join(",");
 useEffect(()=>{
  if(!targets.length)return;
  const controller=new AbortController();
  loadPriceHistoryBatch(targets,controller.signal)
   .then(entries=>setHistory(current=>{const next={...current};for(const entry of entries)next[historyTargetKey(entry.target)]=entry.history;return next}))
   .catch(()=>{});
  return()=>controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- targets identity is captured by the serialized key
 },[key]);
 return history;
}

export function usePriceHistoryBatch(){
 const [history,setHistory]=useState<Record<number,PriceHistory>>({}),historyRef=useRef<Record<number,PriceHistory>>({}),[status,setStatus]=useState<HistoryStatus>("idle"),[failedCount,setFailedCount]=useState(0),loadedRef=useRef(new Set<string>()),controllerRef=useRef<AbortController|null>(null),requestRef=useRef(0),lastTargetsRef=useRef<HistoryTarget[]>([]);
 const request=useCallback(async(targets:HistoryTarget[])=>{
  const unique=[...new Map(targets.filter(target=>target.productId>0).map(target=>[historyTargetKey(target),target])).values()];lastTargetsRef.current=unique;
  controllerRef.current?.abort();const requestId=++requestRef.current;
  const missing=unique.filter(target=>!loadedRef.current.has(historyTargetKey(target)));
  if(!missing.length){const values=unique.map(target=>historyRef.current[target.productId]).filter(Boolean);setFailedCount(0);setStatus(!unique.length?"idle":values.some(value=>value.points.length)?"success":"empty");return}
  const controller=new AbortController();controllerRef.current=controller;setStatus(Object.keys(historyRef.current).length?"partial":"loading");
  try{const entries=await loadPriceHistoryBatch(missing,controller.signal);if(controller.signal.aborted||requestId!==requestRef.current)return;for(const entry of entries)loadedRef.current.add(historyTargetKey(entry.target));const additions=Object.fromEntries(entries.map(entry=>[entry.target.productId,entry.history])) as Record<number,PriceHistory>,next:Record<number,PriceHistory>={...historyRef.current,...additions};historyRef.current=next;setHistory(next);const failures=entries.filter(entry=>entry.failed).length,hasHistory=Object.values(next).some(value=>value.points.length);setFailedCount(failures);setStatus(failures===entries.length?(hasHistory?"partial":"error"):failures?"partial":entries.some(entry=>entry.history.points.length)?"success":"empty")}catch{if(controller.signal.aborted)return;setFailedCount(missing.length);setStatus("error")}
 },[]);
 // Additive load for hover: fetch only what is missing without disturbing an in-flight page
 // request, so opening one row's chart never aborts the rest of the page.
 const ensure=useCallback(async(targets:HistoryTarget[])=>{
  const missing=[...new Map(targets.filter(target=>target.productId>0&&!loadedRef.current.has(historyTargetKey(target))).map(target=>[historyTargetKey(target),target])).values()];
  if(!missing.length)return;
  for(const target of missing)loadedRef.current.add(historyTargetKey(target));
  try{const entries=await loadPriceHistoryBatch(missing,new AbortController().signal);const additions:Record<number,PriceHistory>={};for(const entry of entries){if(entry.failed)loadedRef.current.delete(historyTargetKey(entry.target));else additions[entry.target.productId]=entry.history}
   if(Object.keys(additions).length){historyRef.current={...historyRef.current,...additions};setHistory(historyRef.current)}
  }catch{for(const target of missing)loadedRef.current.delete(historyTargetKey(target))}
 },[]);
 const retry=useCallback(()=>{for(const target of lastTargetsRef.current)loadedRef.current.delete(historyTargetKey(target));void request(lastTargetsRef.current)},[request]);
 useEffect(()=>()=>controllerRef.current?.abort(),[]);
 return useMemo(()=>({history,status,loading:status==="loading",failedCount,request,ensure,retry}),[history,status,failedCount,request,ensure,retry]);
}
