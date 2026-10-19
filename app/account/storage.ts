"use client";
import {ACCOUNT_KEYS,isAccountKey,validAccountValue,type AccountDocument,type AccountKey} from '../../core/domain/account-data.ts';

type StorageMode='legacy'|'loading'|'guest'|'account'|'blocked';
let mode:StorageMode='legacy',owner='',records=new Map<AccountKey,AccountDocument>();
const pending=new Map<AccountKey,string>(),listeners=new Set<()=>void>();
let working=false,error='',generation=0;
const notify=()=>{for(const listener of listeners)listener()};
export const subscribeCloud=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener)}};
export const cloudStatus=()=>({pending:pending.size,error,mode});
export function configureAccountStorage(next:StorageMode,userId='',documents:AccountDocument[]=[]){
 generation++;mode=next;owner=userId;pending.clear();working=false;error='';records=new Map(documents.filter(row=>isAccountKey(row.key)&&validAccountValue(row.key,row.value)).map(row=>[row.key,row]));
 if(typeof window!=='undefined')for(const key of ACCOUNT_KEYS)window.dispatchEvent(new StorageEvent('storage',{key,newValue:getSavedItem(key)}));
 notify();
}
export function getSavedItem(key:string):string|null{
 if(!isAccountKey(key)||mode==='legacy'||mode==='guest')return localStorage.getItem(key);
 return pending.get(key)??records.get(key)?.value??null;
}
export function setSavedItem(key:string,value:string){
 if(!isAccountKey(key)||mode==='legacy'||mode==='guest'){localStorage.setItem(key,value);return}
 if(mode!=='account'||error)throw new Error('Cloud saves are unavailable. Resolve the account warning before continuing.');
 if(!validAccountValue(key,value)){pending.set(key,value);error='This save is invalid or too large. Export pending changes before reloading.';notify();throw new Error(error)}
 if(getSavedItem(key)===value)return;
 pending.set(key,value);notify();void flushCloud();
}
export async function flushCloud(){
 if(working||mode!=='account'||!pending.size)return;
 working=true;error='';const run=generation,user=owner;
 try{
  while(pending.size&&run===generation){
   const [key,value]=pending.entries().next().value!;
   const response=await fetch('/api/account/data',{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({key,value,owner:user,revision:records.get(key)?.revision??0})});
   if(run!==generation||owner!==user)return;
   if(!response.ok)throw new Error(response.status===409?'Progress changed on another device. Export pending changes before reloading.':response.status===401?'Your session expired. Export pending changes before signing in again.':'Cloud save failed. Keep this tab open and retry.');
   const {document}=await response.json() as {document:AccountDocument};
   if(!document||document.key!==key||document.value!==value)throw new Error('Cloud save response was invalid.');
   records.set(key,document);if(pending.get(key)===value)pending.delete(key);notify();
  }
 }catch(cause){if(run===generation)error=cause instanceof Error?cause.message:'Cloud save failed.'}
 finally{if(run===generation){working=false;notify()}}
}
export function retryCloud(){error='';notify();void flushCloud();}
export function pendingBackup(){return JSON.stringify({type:'Raw Signal unsynced backup',savedAt:new Date().toISOString(),documents:[...pending].map(([key,value])=>({key,value}))},null,2)}
