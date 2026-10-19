import {isAccountKey,validAccountValue,type AccountKey} from '../../core/domain/account-data.ts';
export type PendingDraft={key:AccountKey;value:string;revision:number};
const journalKey=(owner:string)=>'raw-signal-pending-account:'+owner;
// Tab-scoped recovery, not a durable offline account cache. No auth tokens are stored.
export function readPendingDrafts(owner:string):PendingDraft[]{
 try{const value=JSON.parse(sessionStorage.getItem(journalKey(owner))??'null');if(value?.owner!==owner||!Array.isArray(value.documents))return [];return value.documents.filter((row:PendingDraft)=>row&&isAccountKey(row.key)&&validAccountValue(row.key,row.value)&&Number.isSafeInteger(row.revision)&&row.revision>=0)}catch{return []}
}
export function writePendingDrafts(owner:string,documents:PendingDraft[]){
 if(!owner)return;
 try{if(documents.length)sessionStorage.setItem(journalKey(owner),JSON.stringify({owner,documents}));else sessionStorage.removeItem(journalKey(owner))}catch{/* Save/export remain available when browser storage is blocked or full. */}
}
