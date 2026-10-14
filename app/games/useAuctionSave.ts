"use client";
/* eslint-disable react-hooks/set-state-in-effect -- browser-only save is loaded after hydration */
import {useCallback,useEffect,useRef,useState} from 'react';
import {AUCTION_STORAGE_KEY,parseAuctionSave} from '../../core/domain/auction-save';
import {initialAuctionSave,type AuctionSave} from '../../core/domain/auction-types';

export function useAuctionSave(){
 const [save,setSave]=useState<AuctionSave|null>(null),[error,setError]=useState<string|null>(null),current=useRef<AuctionSave|null>(null);
 const adopt=useCallback((value:AuctionSave)=>{current.current=value;setSave(value)},[]);
 useEffect(()=>{
  try{adopt(parseAuctionSave(localStorage.getItem(AUCTION_STORAGE_KEY)))}catch{setError('Saved game could not be loaded. Your stored data has not been overwritten. Reset to start again, or enable browser storage.')}
  const receive=(event:StorageEvent)=>{if(event.key!==AUCTION_STORAGE_KEY)return;try{adopt(parseAuctionSave(event.newValue));setError('Game updated in another tab. Review it before continuing.')}catch{setError('Another tab changed the saved game to an invalid state.')}};
  window.addEventListener('storage',receive);return()=>window.removeEventListener('storage',receive);
 },[adopt]);
 const transact=useCallback((update:(save:AuctionSave)=>AuctionSave)=>{
  const previous=current.current;if(!previous)return;
  try{
   const stored=parseAuctionSave(localStorage.getItem(AUCTION_STORAGE_KEY));
   if(stored.revision!==previous.revision){adopt(stored);setError('Another tab changed your game. Please repeat your action.');return}
   const changed=update(previous);if(changed===previous)return;
   const next={...changed,revision:previous.revision+1};
   localStorage.setItem(AUCTION_STORAGE_KEY,JSON.stringify(next));adopt(next);setError(null);
  }catch{setError('Browser storage is unavailable or full. This action was not saved or charged. Free storage and try again.')}
 },[adopt]);
 const reset=useCallback(()=>{
  try{const next=initialAuctionSave();next.revision=(current.current?.revision??0)+1;localStorage.setItem(AUCTION_STORAGE_KEY,JSON.stringify(next));adopt(next);setError(null)}catch{setError('Browser storage is unavailable. Enable storage to reset and play.')}
 },[adopt]);
 return {save,error,transact,reset};
}
