"use client";
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {parsePriceHistory} from "../domain/contracts.ts";
import {deriveHistoryMetrics} from "../domain/history-metrics.ts";
import type {PriceHistory} from "../domain/types";
import {mapWithConcurrency} from "../market-utils.ts";

export type HistoryTarget={productId:number;printing:string;sealed?:boolean};
export type HistoryStatus="idle"|"loading"|"partial"|"success"|"empty"|"error";
type BatchEntry={target:HistoryTarget;history:PriceHistory;failed:boolean};
const unavailableHistory:PriceHistory={points:[],coverage:"none",change7:null,change30:null,change90:null,low30:null,high30:null,historyLow:null,historyHigh:null};
export const historyTargetKey=(target:HistoryTarget)=>`${target.sealed?"sealed":"single"}:${target.productId}:${target.printing.toLowerCase()}`;

export async function loadPriceHistoryBatch(targets:HistoryTarget[],signal:AbortSignal,fetcher:typeof fetch=fetch,limit=4){
 return mapWithConcurrency(targets,limit,async target=>{
  if(signal.aborted)throw new DOMException("Request aborted","AbortError");
  try{
   const params=new URLSearchParams({productId:String(target.productId),printing:target.printing});if(target.sealed)params.set("sealed","1");
   const response=await fetcher(`/api/history?${params}`,{signal});if(!response.ok)throw new Error(`History request failed: ${response.status}`);
   const parsed=parsePriceHistory(await response.json()),history={...parsed,...deriveHistoryMetrics(parsed.points)};
   return{target,history,failed:false} satisfies BatchEntry;
  }catch(error){if(signal.aborted||(error instanceof DOMException&&error.name==="AbortError"))throw error;return{target,history:unavailableHistory,failed:true} satisfies BatchEntry}
 });
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
 const retry=useCallback(()=>{for(const target of lastTargetsRef.current)loadedRef.current.delete(historyTargetKey(target));void request(lastTargetsRef.current)},[request]);
 useEffect(()=>()=>controllerRef.current?.abort(),[]);
 return useMemo(()=>({history,status,loading:status==="loading",failedCount,request,retry}),[history,status,failedCount,request,retry]);
}
