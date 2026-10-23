"use client";
import {useEffect,useSyncExternalStore} from "react";
import {freshnessStore} from './freshness-store';

// The bundled index date is baked into the build; the published Worker serves the live
// run's dates at /data/freshness.json (audit C1) so the page never understates its own
// freshness. Silent fallback where the endpoint is absent (dev server, feed-only deploys).
export function useFreshness(fallbackIso:string){
 const iso=useSyncExternalStore(freshnessStore.subscribe,freshnessStore.getSnapshot,freshnessStore.getServerSnapshot);
 useEffect(()=>{void freshnessStore.refresh()},[]);
 return iso??fallbackIso;
}
