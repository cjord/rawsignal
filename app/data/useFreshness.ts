"use client";
import {useEffect,useState} from "react";

// The bundled index date is baked into the build; the published Worker serves the live
// run's dates at /data/freshness.json (audit C1) so the page never understates its own
// freshness. Silent fallback where the endpoint is absent (dev server, feed-only deploys).
export function useFreshness(fallbackIso:string){
 const [iso,setIso]=useState(fallbackIso);
 useEffect(()=>{
  const controller=new AbortController();
  fetch("/data/freshness.json",{signal:controller.signal})
   .then(async response=>response.ok?await response.json() as {sourceUpdatedAt?:string|null}:null)
   .then(body=>{if(!controller.signal.aborted&&body?.sourceUpdatedAt)setIso(body.sourceUpdatedAt)})
   .catch(()=>{/* Fallback date stands. */});
  return()=>controller.abort();
 },[]);
 return iso;
}
