import {ACCOUNT_KEYS,isAccountKey,validAccountValue,type AccountKey} from './account-data.ts';
export const RECOVERY_TTL_MS=7*86400000;
export const RECOVERY_LIMIT_BYTES=10*1024*1024;
export type RecoveryDraft={key:AccountKey;value:string;revision:number};
export type RecoveryEnvelope={id:string;owner:string;keyId:string;createdAt:number;expiresAt:number;iv:string;ciphertext:string};
export function validRecoveryDrafts(value:unknown):value is RecoveryDraft[]{
 if(!Array.isArray(value)||value.length>ACCOUNT_KEYS.length)return false;
 const keys=new Set<string>();let size=0;
 return value.every(row=>{
  if(!row||!isAccountKey(row.key)||!validAccountValue(row.key,row.value)||!Number.isSafeInteger(row.revision)||row.revision<0||keys.has(row.key))return false;
  keys.add(row.key);size+=new TextEncoder().encode(row.value).length;return size<=RECOVERY_LIMIT_BYTES;
 });
}
export function base64(bytes:Uint8Array){let binary='';for(let start=0;start<bytes.length;start+=8192)binary+=String.fromCharCode(...bytes.subarray(start,start+8192));return btoa(binary)}
export function unbase64(value:string){const text=atob(value),bytes=new Uint8Array(text.length);for(let i=0;i<text.length;i++)bytes[i]=text.charCodeAt(i);return bytes}
export async function importRecoveryKey(raw:string){const bytes=unbase64(raw);if(bytes.length!==32)throw new Error('Invalid recovery key');return crypto.subtle.importKey('raw',bytes,'AES-GCM',false,['encrypt','decrypt'])}
const additionalData=(row:Omit<RecoveryEnvelope,'iv'|'ciphertext'>)=>new TextEncoder().encode(JSON.stringify([1,row.owner,row.id,row.keyId,row.createdAt,row.expiresAt]));
export async function encryptRecovery(key:CryptoKey,row:Omit<RecoveryEnvelope,'iv'|'ciphertext'>,documents:RecoveryDraft[]):Promise<RecoveryEnvelope>{
 if(!validRecoveryDrafts(documents))throw new Error('Invalid recovery draft');
 const iv=crypto.getRandomValues(new Uint8Array(12)),plaintext=new TextEncoder().encode(JSON.stringify({v:1,documents}));
 const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:additionalData(row)},key,plaintext);
 return {...row,iv:base64(iv),ciphertext:base64(new Uint8Array(encrypted))};
}
export async function decryptRecovery(key:CryptoKey,row:RecoveryEnvelope,owner:string,keyId:string,now=Date.now()):Promise<RecoveryDraft[]>{
 if(row.owner!==owner||row.keyId!==keyId||!Number.isSafeInteger(row.createdAt)||!Number.isSafeInteger(row.expiresAt)||row.expiresAt<=now||row.expiresAt-row.createdAt!==RECOVERY_TTL_MS||row.createdAt>now+60000||row.ciphertext.length>RECOVERY_LIMIT_BYTES*2)throw new Error('Recovery draft is unavailable or expired');
 const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:unbase64(row.iv),additionalData:additionalData(row)},key,unbase64(row.ciphertext));
 const payload=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));if(payload.v!==1||!validRecoveryDrafts(payload.documents))throw new Error('Invalid recovery draft');return payload.documents;
}
