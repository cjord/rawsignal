"use client";
import {getSavedItem,setSavedItem} from '../account/storage';
import {useCallback,useEffect,useRef,useState} from 'react';
import {SHOWDOWN_DAILY_KEY,initialDailyShowdown,parseDailyShowdown,validDailyShowdownManifest,type DailyShowdownSave} from '../../core/domain/showdown-daily';
import {utcGameDate} from '../../core/domain/daily-game';

export function useDailyShowdown(){
 const [save,setSave]=useState<DailyShowdownSave|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),current=useRef<DailyShowdownSave|null>(null);
 const adopt=useCallback((save:DailyShowdownSave|null)=>{current.current=save;setSave(save)},[]);
 const load=useCallback(async(signal?:AbortSignal)=>{
  setLoading(true);setError('');
  try{
   const raw=getSavedItem(SHOWDOWN_DAILY_KEY),stored=raw?parseDailyShowdown(raw):null;
   if(stored?.manifest.date===utcGameDate(Date.now())){adopt(stored);return}
   const response=await fetch('/api/showdown/daily',{signal,cache:'no-store'});if(!response.ok)throw new Error('The daily lineup is unavailable. Please retry later.');
   const manifest:unknown=await response.json();if(!validDailyShowdownManifest(manifest)||manifest.date!==utcGameDate(Date.now()))throw new Error('Daily lineup is out of date. Please retry.');
   if(signal?.aborted)return;
   // Do not overwrite an attempt another tab started while this request was pending.
   const latest=getSavedItem(SHOWDOWN_DAILY_KEY),existing=latest?parseDailyShowdown(latest):null;
   const next=existing?.manifest.date===manifest.date?existing:initialDailyShowdown(manifest);
   setSavedItem(SHOWDOWN_DAILY_KEY,JSON.stringify(next));adopt(next);
  }catch(error){if(!signal?.aborted)setError(error instanceof Error?error.message:'Browser storage is unavailable. Enable storage to play.')}
  finally{if(!signal?.aborted)setLoading(false)}
 },[adopt]);
 useEffect(()=>{const controller=new AbortController();queueMicrotask(()=>{if(!controller.signal.aborted)void load(controller.signal)});const receive=(event:StorageEvent)=>{if(event.key!==SHOWDOWN_DAILY_KEY)return;try{adopt(event.newValue?parseDailyShowdown(event.newValue):null)}catch{setError('Saved daily progress is invalid. It has not been overwritten.')}};window.addEventListener('storage',receive);return()=>{controller.abort();window.removeEventListener('storage',receive)}},[load,adopt]);
 const transact=useCallback((update:(save:DailyShowdownSave)=>DailyShowdownSave)=>{
  try{
   const previous=current.current;if(!previous)return;
   const raw=getSavedItem(SHOWDOWN_DAILY_KEY),stored=raw?parseDailyShowdown(raw):null;
   if(!stored||stored.revision!==previous.revision||stored.manifest.date!==previous.manifest.date){adopt(stored);setError('Daily progress changed in another tab. Review it and try again.');return}
   const next=update(previous);if(next===previous)return;
   setSavedItem(SHOWDOWN_DAILY_KEY,JSON.stringify(next));adopt(next);setError('');
  }catch{setError('Browser storage is unavailable. This answer was not saved. Please try again.')}
 },[adopt]);
 return {save,error,loading,reload:()=>void load(),transact};
}
