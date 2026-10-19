import {decryptRecovery,encryptRecovery,importRecoveryKey,RECOVERY_TTL_MS,type RecoveryDraft} from '../../core/domain/recovery.ts';
import {recoveryRows,writeRecoveryRow,removeRecoveryRows,purgeExpiredRecovery} from './recovery-db.ts';
type Vault={owner:string;keyId:string;key:CryptoKey;stream:string;createdAt:number;adopted:Set<string>};
export type RecoveryOption={id:string;createdAt:number;expiresAt:number};
let vault:Vault|null=null,serial:Promise<void>=Promise.resolve(),epoch=0;
let state={enabled:false,ready:false,error:'',drafts:[] as RecoveryOption[],savedAt:null as number|null,expired:0};
const listeners=new Set<()=>void>();
const notify=()=>{for(const listener of listeners)listener()};
export const recoveryState=()=>state;
export const subscribeRecovery=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener)}};
export function forgetRecoveryKey(){epoch++;vault=null;state={enabled:false,ready:false,error:'',drafts:[],savedAt:null,expired:0};notify()}
export function recoveryUnavailable(){state={...state,enabled:true,ready:false,error:'Persistent recovery is unavailable. Keep this tab open or export pending changes.'};notify()}
async function refresh(current:Vault){
 const rows=await recoveryRows(current.owner),now=Date.now(),expired=rows.filter(row=>row.expiresAt<=now);
 if(expired.length)await removeRecoveryRows(current.owner,expired.map(row=>row.id));
 if(vault!==current)return;
 state={...state,expired:state.expired+expired.length,drafts:rows.filter(row=>row.id!==current.stream&&!current.adopted.has(row.id)&&row.expiresAt>now).map(({id,createdAt,expiresAt})=>({id,createdAt,expiresAt})).sort((a,b)=>b.createdAt-a.createdAt)};notify();
}
export async function initializeRecovery(payload:{owner:string;keyId:string;key:string}){
 const run=epoch,key=await importRecoveryKey(payload.key);if(epoch!==run)return;
 const current:Vault={owner:payload.owner,keyId:payload.keyId,key,stream:crypto.randomUUID(),createdAt:Date.now(),adopted:new Set()};
 vault=current;state={enabled:true,ready:true,error:'',drafts:[],savedAt:null,expired:0};
 const expired=await purgeExpiredRecovery(current.owner);if(vault!==current)return;state={...state,expired};await refresh(current);notify();
}
export function persistentRecoveryReady(owner:string){return vault?.owner===owner&&state.ready}
export function persistRecovery(owner:string,documents:RecoveryDraft[]){
 const current=vault;if(!current||current.owner!==owner)return Promise.resolve(false);
 const snapshot=documents.map(row=>({...row})),adopted=[...current.adopted];
 const operation=serial.catch(()=>{}).then(async()=>{
  if(snapshot.length){
   if(current.createdAt+RECOVERY_TTL_MS<=Date.now())throw new Error('The recovery window expired. Export pending changes before closing this tab.');
   const row=await encryptRecovery(current.key,{id:current.stream,owner,keyId:current.keyId,createdAt:current.createdAt,expiresAt:current.createdAt+RECOVERY_TTL_MS},snapshot);await writeRecoveryRow(row);
  }else{await removeRecoveryRows(owner,[current.stream,...adopted]);for(const id of adopted)current.adopted.delete(id)}
  if(vault===current){state={...state,error:'',savedAt:snapshot.length?Date.now():null};await refresh(current)}
 });
 serial=operation.catch(cause=>{if(vault===current){state={...state,error:cause instanceof Error?cause.message:'Device recovery failed.'};notify()}});
 return operation.then(()=>true,()=>false);
}
export async function readRecovery(id:string){
 const current=vault;if(!current)throw new Error('Sign in to unlock recovery.');
 const row=(await recoveryRows(current.owner)).find(item=>item.id===id);if(!row||row.id===current.stream)throw new Error('Recovery draft is unavailable.');
 const documents=await decryptRecovery(current.key,row,current.owner,current.keyId);
 if(vault!==current)throw new Error('The signed-in account changed.');return documents;
}
export function adoptRecovery(id:string){vault?.adopted.add(id)}
export async function deleteRecovery(id:string){const current=vault;if(!current)throw new Error('Sign in to unlock recovery.');await removeRecoveryRows(current.owner,[id]);await refresh(current)}
export const flushRecovery=()=>serial;
