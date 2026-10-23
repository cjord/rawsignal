import {RECOVERY_LIMIT_BYTES,type RecoveryEnvelope} from '../../core/domain/recovery.ts';
let connection:Promise<IDBDatabase>|null=null;
function database(){
 if(!connection)connection=new Promise<IDBDatabase>((resolve,reject)=>{
  const request=indexedDB.open('raw-signal-recovery-v1',1);
  request.onupgradeneeded=()=>{const store=request.result.createObjectStore('drafts',{keyPath:'id'});store.createIndex('owner','owner')};
  request.onerror=()=>{connection=null;reject(new Error('Browser recovery storage is unavailable.'))};
  request.onblocked=()=>{connection=null;reject(new Error('Close older Raw Signal tabs to upgrade recovery storage.'))};
  request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();connection=null};resolve(db)};
 });return connection;
}
export async function recoveryRows(owner:string){
 const db=await database();return new Promise<RecoveryEnvelope[]>((resolve,reject)=>{
  const tx=db.transaction('drafts','readonly'),request=tx.objectStore('drafts').index('owner').getAll(owner);
  tx.oncomplete=()=>resolve(request.result as RecoveryEnvelope[]);tx.onabort=tx.onerror=()=>reject(new Error('Unable to read recovery storage.'));
 });
}
export async function writeRecoveryRow(row:RecoveryEnvelope){
 const db=await database();return new Promise<void>((resolve,reject)=>{
  const tx=db.transaction('drafts','readwrite',{durability:'strict'}),store=tx.objectStore('drafts'),request=store.index('owner').getAll(row.owner);let message='Unable to save recovery data. Keep this tab open or export a backup.';
  request.onsuccess=()=>{
   const others=(request.result as RecoveryEnvelope[]).filter(item=>item.id!==row.id);
   const bytes=others.reduce((sum,item)=>sum+item.ciphertext.length,0)+row.ciphertext.length;
   if(others.length>=5||bytes>RECOVERY_LIMIT_BYTES){message='Device recovery storage is full. Review or export older drafts before closing this tab.';tx.abort();return}
   store.put(row);
  };
  tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(new Error(message));
 });
}
export async function removeRecoveryRows(owner:string,ids:string[]){
 const db=await database();return new Promise<void>((resolve,reject)=>{
  const tx=db.transaction('drafts','readwrite',{durability:'strict'}),store=tx.objectStore('drafts');
  for(const id of ids){const request=store.get(id);request.onsuccess=()=>{if(request.result?.owner===owner)store.delete(id)}}
  tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(new Error('Unable to remove the recovery draft.'));
 });
}
export async function purgeExpiredRecovery(owner:string,now=Date.now()){
 const db=await database();return new Promise<number>((resolve,reject)=>{
  const tx=db.transaction('drafts','readwrite',{durability:'strict'}),request=tx.objectStore('drafts').openCursor();let own=0;
  request.onsuccess=()=>{const cursor=request.result;if(!cursor)return;const row=cursor.value as RecoveryEnvelope;if(row.expiresAt<=now){if(row.owner===owner)own++;cursor.delete()}cursor.continue()};
  tx.oncomplete=()=>resolve(own);tx.onabort=tx.onerror=()=>reject(new Error('Unable to check recovery retention.'));
 });
}
