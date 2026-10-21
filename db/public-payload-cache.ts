import type {D1DatabaseLike} from './repository.ts';
import {readPayloadVersion} from './publication-version.ts';
type Version={signature:string;busy:boolean};
type Entry<T>={at:number;promise:Promise<T>};

// Public derived data only. Cache lifetime, cardinality and failure retention are bounded.
export function createPublicPayloadCache<T>({clock=Date.now,version=readPayloadVersion,ttlMs=60_000,maxEntries=4}:{clock?:()=>number;version?:(db:D1DatabaseLike)=>Promise<Version>;ttlMs?:number;maxEntries?:number}={}){
 if(!Number.isFinite(ttlMs)||ttlMs<=0||!Number.isSafeInteger(maxEntries)||maxEntries<1)throw new Error('Invalid public cache limits');
 const databases=new WeakMap<D1DatabaseLike,Map<string,Entry<T>>>();
 return async(db:D1DatabaseLike,configuration:string,build:()=>Promise<T>):Promise<T>=>{
  const start=await version(db).catch(()=>null);
  if(!start?.signature||start.busy)return build();
  let entries=databases.get(db);if(!entries){entries=new Map();databases.set(db,entries)}
  const key=JSON.stringify([start.signature,configuration]),now=clock(),existing=entries.get(key);
  if(existing&&now-existing.at<ttlMs)return existing.promise;
  const entry:Entry<T>={at:now,promise:Promise.resolve().then(build)};
  entry.promise=entry.promise.then(async value=>{
   const end=await version(db);
   if(end.signature!==start.signature||end.busy)throw new Error('Published data changed during loading. Please retry.');
   if(value===null&&entries.get(key)===entry)entries.delete(key);
   return value;
  }).catch(error=>{if(entries.get(key)===entry)entries.delete(key);throw error});
  entries.delete(key);entries.set(key,entry);
  while(entries.size>maxEntries)entries.delete(entries.keys().next().value!);
  return entry.promise;
 };
}

// Opt-in through the caller: durations are attached to a request, never global user state.
export type PayloadTimings={stages:Record<string,number>};
export const payloadServerTiming=(timings:PayloadTimings)=>Object.entries(timings.stages).filter(([name,value])=>/^[a-z]+$/.test(name)&&Number.isFinite(value)&&value>=0).map(([name,value])=>`${name};dur=${value}`).join(', ');
export async function timedPayload<T>(timings:PayloadTimings|undefined,name:string,load:()=>Promise<T>):Promise<T>{
 const started=performance.now();try{return await load()}finally{if(timings)timings.stages[name]=Math.round(performance.now()-started)}
}
