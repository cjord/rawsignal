import {requestJson} from './request-json.ts';
export function createFreshnessStore(fetcher:typeof fetch=fetch,clock=Date.now,ttlMs=60_000){
 let iso:string|null=null,checkedAt=-Infinity,pending:Promise<void>|null=null;
 const listeners=new Set<()=>void>();
 const refresh=()=>{
  if(pending)return pending;if(clock()-checkedAt<ttlMs)return Promise.resolve();
  pending=requestJson('/data/freshness.json',{}, {fetcher}).then(({response,data})=>{
   const next=(data as {sourceUpdatedAt?:unknown}|null)?.sourceUpdatedAt;
   if(response.ok&&typeof next==='string'&&Number.isFinite(Date.parse(next))){iso=next;checkedAt=clock();for(const listener of listeners)listener()}
  }).catch(()=>{/* Keep the last known source date, never a fabricated current date. */}).finally(()=>{pending=null});
  return pending;
 };
 return {getSnapshot:()=>iso,getServerSnapshot:()=>null,subscribe:(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener)}},refresh};
}
export const freshnessStore=createFreshnessStore();
