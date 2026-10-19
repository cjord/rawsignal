"use client";
import {getSavedItem,setSavedItem} from '../account/storage';
import {useSyncExternalStore} from "react";

// Device preference for the row hover-preview popovers (docs/todo.md D2). Default on;
// stored outside React so MarketRow instances across pages share one subscription.
const KEY="raw-signal-hover-previews";
const listeners=new Set<()=>void>();
let hydrated=false,enabled=true;

function readStored(){try{return getSavedItem(KEY)!=="off"}catch{return true}}
function snapshot(){if(!hydrated&&typeof window!=="undefined"){enabled=readStored();hydrated=true}return enabled}
const serverSnapshot=()=>true;
function subscribe(listener:()=>void){const changed=(event:StorageEvent)=>{if(event.key===KEY){enabled=readStored();hydrated=true;listener()}};window.addEventListener('storage',changed);listeners.add(listener);return()=>{listeners.delete(listener);window.removeEventListener('storage',changed)}}

export function setHoverPreviews(next:boolean){
 enabled=next;hydrated=true;
 try{setSavedItem(KEY,next?"on":"off")}catch{/* Storage unavailable (private mode); the preference lasts this page view. */}
 for(const listener of listeners)listener();
}

export function useHoverPreviews(){return useSyncExternalStore(subscribe,snapshot,serverSnapshot)}
