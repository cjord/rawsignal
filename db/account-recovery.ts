import type {D1DatabaseLike} from './repository.ts';
import {base64,unbase64} from '../core/domain/recovery.ts';
type RecoveryKeyRow={keyId:string;wrappedKey:string;iv:string};
async function wrappingKey(secret:string,owner:string){
 const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),'HKDF',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt:new TextEncoder().encode(owner),info:new TextEncoder().encode('raw-signal-recovery-wrap-v1')},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
export async function accountRecoveryKey(db:D1DatabaseLike,owner:string,secret:string){
 const select=()=>db.prepare('SELECT key_id AS keyId,wrapped_key AS wrappedKey,iv FROM account_recovery_keys WHERE user_id=?').bind(owner).first<RecoveryKeyRow>();
 let row=await select();const key=await wrappingKey(secret,owner);
 if(!row){
  const keyId=crypto.randomUUID(),iv=crypto.getRandomValues(new Uint8Array(12)),raw=crypto.getRandomValues(new Uint8Array(32));
  const wrapped=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(owner+':'+keyId)},key,raw);
  await db.prepare('INSERT INTO account_recovery_keys(user_id,key_id,wrapped_key,iv,created_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id) DO NOTHING').bind(owner,keyId,base64(new Uint8Array(wrapped)),base64(iv),new Date().toISOString()).run();
  row=await select();if(!row)throw new Error('Recovery key unavailable');
 }
 const raw=await crypto.subtle.decrypt({name:'AES-GCM',iv:unbase64(row.iv),additionalData:new TextEncoder().encode(owner+':'+row.keyId)},key,unbase64(row.wrappedKey));
 return {owner,keyId:row.keyId,key:base64(new Uint8Array(raw))};
}
