"use client";
import {ACCOUNT_KEYS,isAccountKey,validAccountValue,type AccountDocument,type AccountKey} from '../../core/domain/account-data.ts';
import {requestJson} from '../data/request-json.ts';
import {readPendingDrafts,writePendingDrafts} from './pending-journal.ts';
import {adoptRecovery,deleteRecovery,forgetRecoveryKey,initializeRecovery,persistentRecoveryReady,persistRecovery,readRecovery,recoveryState,recoveryUnavailable,subscribeRecovery,flushRecovery} from './recovery-vault.ts';

type StorageMode='legacy'|'loading'|'guest'|'account'|'blocked';
export const ACCOUNT_STORAGE_EVENT_URL='raw-signal:account-storage';
let mode:StorageMode='legacy',owner='',records=new Map<AccountKey,AccountDocument>();
const pending=new Map<AccountKey,string>(),listeners=new Set<()=>void>();
let working=false,error='',generation=0,failure:'transient'|'conflict'|'session'|'invalid'|'recovered'|''='';
let retryNotBefore=0;
async function journal(){
 const user=owner,documents=[...pending].map(([key,value])=>({key,value,revision:records.get(key)?.revision??0}));
 if(persistentRecoveryReady(user)){if(await persistRecovery(user,documents))writePendingDrafts(user,[])}else writePendingDrafts(user,documents);
}
const notify=()=>{for(const listener of listeners)listener()};
subscribeRecovery(notify);
export const subscribeCloud=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener)}};
export const cloudStatus=()=>({pending:pending.size,error,mode,failure,working,recovery:recoveryState()});
export function configureAccountStorage(next:StorageMode,userId='',documents:AccountDocument[]=[]){
 if(next!=='account'||owner!==userId)forgetRecoveryKey();
 generation++;mode=next;owner=userId;pending.clear();working=false;error='';failure='';retryNotBefore=0;records=new Map(documents.filter(row=>isAccountKey(row.key)&&validAccountValue(row.key,row.value)).map(row=>[row.key,row]));
 if(next==='account'){
  for(const draft of readPendingDrafts(owner)){
   const saved=records.get(draft.key);if(saved?.value===draft.value)continue;
   pending.set(draft.key,draft.value);
   if((saved?.revision??0)!==draft.revision){failure='conflict';records.set(draft.key,{key:draft.key,value:saved?.value??'',revision:draft.revision,updatedAt:saved?.updatedAt??''})}
  }
  if(pending.size){failure=failure||'recovered';error=failure==='conflict'?'Recovered changes conflict with progress from another device. Export them before loading the cloud save.':'Unsaved changes recovered from this tab. Retry Save to sync them, or export a backup.'}void journal();
 }
 if(typeof window!=='undefined')for(const key of ACCOUNT_KEYS)window.dispatchEvent(new StorageEvent('storage',{key,newValue:getSavedItem(key),url:ACCOUNT_STORAGE_EVENT_URL}));
 notify();
}
export function getSavedItem(key:string):string|null{
 if(!isAccountKey(key)||mode==='legacy'||mode==='guest')return localStorage.getItem(key);
 return pending.get(key)??records.get(key)?.value??null;
}
export function setSavedItem(key:string,value:string){
 if(!isAccountKey(key)||mode==='legacy'||mode==='guest'){localStorage.setItem(key,value);return}
 if(mode!=='account'||error)throw new Error('Cloud saves are unavailable. Resolve the account warning before continuing.');
 if(!validAccountValue(key,value)){pending.set(key,value);failure='invalid';error='This save is invalid or too large. Export pending changes before reloading.';notify();throw new Error(error)}
 if(getSavedItem(key)===value)return;
 pending.set(key,value);void journal();notify();void flushCloud();
}
function failedSave(status:number,retryAfter:string|null){
 failure=status===409?'conflict':status===401?'session':'transient';
 if(status===429){const seconds=Math.min(3600,Math.max(1,Number(retryAfter)||60));retryNotBefore=Date.now()+seconds*1000;return new Error(`Too many save requests. Wait ${seconds} seconds before retrying. Your pending changes are preserved.`)}
 return new Error(status===409?'Progress changed on another device. Export pending changes before loading the cloud save.':status===401?'Your session expired. Export pending changes before signing in again.':'Cloud save failed. Keep this tab open and retry.');
}
export async function flushCloud(){
 if(working||mode!=='account'||!pending.size||error)return;
 working=true;error='';const run=generation,user=owner;
 try{
  while(pending.size&&run===generation){
   const [key,value]=pending.entries().next().value!;
   await journal();if(run!==generation||owner!==user)return;
   const base=records.get(key)?.revision??0;
   const {response,data}=await requestJson('/api/account/data',{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({key,value,owner:user,revision:base})});
   if(run!==generation||owner!==user)return;
   if(!response.ok)throw failedSave(response.status,response.headers.get('Retry-After'));
   const document=(data as {document?:AccountDocument})?.document;
   if(!validAcknowledgement(document,key,value,base)){failure='invalid';throw new Error('Cloud save acknowledgement was invalid. Export pending changes before loading the cloud save.')}
   records.set(key,{key:document.key,value:document.value,revision:document.revision,updatedAt:document.updatedAt});if(pending.get(key)===value)pending.delete(key);await journal();if(run===generation&&owner===user)notify();
  }
 }catch(cause){if(run===generation){failure=failure||'transient';error=cause instanceof TypeError?'Cloud save failed. Keep this tab open and retry.':cause instanceof Error?cause.message:'Cloud save failed.'}}
 finally{if(run===generation){working=false;notify()}}
}
function validAcknowledgement(document:AccountDocument|undefined,key:AccountKey,value:string,base:number):document is AccountDocument{
 return !!document&&document.key===key&&document.value===value&&document.revision===base+1&&Number.isSafeInteger(document.revision)&&typeof document.updatedAt==='string'&&Number.isFinite(Date.parse(document.updatedAt));
}
export function retryCloud(){if(Date.now()<retryNotBefore||['conflict','session','invalid'].includes(failure))return;error='';failure='';notify();void flushCloud();}
export async function discardCloudPending(){if(working)throw new Error('Wait for the current save to finish.');pending.clear();await journal();error='';failure='';notify();}
export function pendingBackup(){return JSON.stringify({type:'Raw Signal unsynced backup',savedAt:new Date().toISOString(),documents:[...pending].map(([key,value])=>({key,value,revision:records.get(key)?.revision??0}))},null,2)}
export async function initializeAccountRecovery(enabled:boolean){
 if(!enabled||mode!=='account')return;const user=owner,run=generation;
 try{
  const {response,data:payload}=await requestJson('/api/account/recovery-key',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:'{}'});if(!response.ok)throw new Error('Recovery unavailable');
  const data=payload as {owner:string;keyId:string;key:string};if(run!==generation||owner!==user)return;
  if(data.owner!==user||typeof data.keyId!=='string'||typeof data.key!=='string')throw new Error('Invalid recovery key');
  await initializeRecovery(data);if(run!==generation||owner!==user)return;await journal();
 }catch{if(run===generation)recoveryUnavailable()}
}
export async function restoreRecoveryDraft(id:string){
 if(mode!=='account'||pending.size||working)throw new Error('Resolve this tab’s pending changes before recovering another draft.');
 const user=owner,run=generation,documents=await readRecovery(id);
 const {response,data}=await requestJson('/api/account/session',{credentials:'same-origin',cache:'no-store'});if(!response.ok)throw new Error('Reconnect and sign in before recovery.');const current=data as {user:{id:string}|null;documents:AccountDocument[]};
 if(run!==generation||owner!==user||current.user?.id!==user)throw new Error('The signed-in account changed.');
 const saved=new Map<AccountKey,AccountDocument>((current.documents as AccountDocument[]).map(row=>[row.key,row]));
 const changes=documents.filter(row=>saved.get(row.key)?.value!==row.value);
 if(changes.some(row=>(saved.get(row.key)?.revision??0)!==row.revision))throw new Error('Cloud progress changed since this draft. Export it for review or keep the cloud save; money and inventory will not be merged.');
 if(!changes.length){await deleteRecovery(id);return}
 configureAccountStorage('account',user,current.documents);adoptRecovery(id);
 for(const row of changes)pending.set(row.key,row.value);
 failure='recovered';error='Device recovery loaded. Retry Save to sync it, or export pending changes.';await journal();
 if(typeof window!=='undefined')for(const key of ACCOUNT_KEYS)window.dispatchEvent(new StorageEvent('storage',{key,newValue:getSavedItem(key)}));notify();
}
export const flushDeviceRecovery=()=>flushRecovery();
