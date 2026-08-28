import {env} from "cloudflare:workers";
import {createD1CatalogRepository} from "../../db/catalog-repository";
import {publishedIngestion,type D1DatabaseLike} from "../../db/repository";
import type {CatalogDetail,CatalogKind} from "../domain/types";
import {createFeedCatalogRepository} from "./feed-catalog-repository";
import {parseSealedProducts} from "../domain/contracts";
import {createMemoryCatalogRepository,type CatalogRepository} from "./catalog-repository";

type FetchLike=(input:RequestInfo|URL,init?:RequestInit)=>Promise<Response>;

// Diagnostic timings for real-deployment cold-start measurement (todo F1). RSC pages cannot
// set response headers, so the detail page surfaces this Server-Timing-formatted string as a
// data attribute; keyed by the returned detail object to stay race-free across requests.
const detailTimings=new WeakMap<CatalogDetail,string>();
export const detailServerTiming=(detail:CatalogDetail|null)=>detail?detailTimings.get(detail)??null:null;
const recordTiming=(detail:CatalogDetail|null,source:string,repositoryMs:number,detailMs:number,cold:boolean)=>{if(detail)detailTimings.set(detail,`repo;dur=${Math.round(repositoryMs)}${cold?";desc=cold":""}, detail;dur=${Math.round(detailMs)}, source;desc=${source}`)};

// Generated feeds only change per deploy, so repositories are cached for the isolate's
// lifetime; a failed build is evicted so the next request can retry.
const feedRepositories=new Map<string,Promise<CatalogRepository>>();
function cachedRepository(key:string,build:()=>Promise<CatalogRepository>){
 let repository=feedRepositories.get(key);
 if(!repository){repository=build();repository.catch(()=>feedRepositories.delete(key));feedRepositories.set(key,repository)}
 return repository;
}

export async function loadCatalogDetail(kind:CatalogKind,productId:number,market:string|undefined,origin:string):Promise<CatalogDetail|null>{
 const db=env.DB as unknown as D1DatabaseLike|undefined;
 // Detail reads are unscoped by run: upserts re-stamp ingestion_run_id in place, so pinning
 // to the published run would exclude every product an in-progress re-ingestion has touched.
 if(db&&productId>0)try{const started=performance.now();const published=await publishedIngestion(db);if(published){const repositoryMs=performance.now()-started,queryStarted=performance.now();const detail=await createD1CatalogRepository(db).getDetail(kind,productId,market);if(detail){recordTiming(detail,"d1",repositoryMs,performance.now()-queryStarted,false);return detail}}}catch(error){
  // Retain the generated detail snapshot while D1 is incomplete — but say why it fell back.
  console.error(JSON.stringify({event:"d1_detail_failed",kind,productId,message:error instanceof Error?error.message:"Unknown failure"}));
 }
 const assets=(env as unknown as {ASSETS?:{fetch(input:RequestInfo|URL,init?:RequestInit):Promise<Response>}}).ASSETS;
 const fetcher:FetchLike=assets?assets.fetch.bind(assets):fetch;
 if(kind==="sealed"&&market==="scalping")try{
  const repository=await cachedRepository(`scalping:${origin}`,async()=>{
   const response=await fetcher(new Request(new URL("/data/sealed-scalping.json",origin)));
   if(!response.ok)throw new Error(`Scalping snapshot unavailable: ${response.status}`);
   return createMemoryCatalogRepository([],parseSealedProducts(await response.json()));
  });
  const detail=await repository.getDetail(kind,productId,market);
  if(detail)return detail;
 }catch{/* Fall through to the standard market snapshots. */}
 const cold=!feedRepositories.has(`feeds:${origin}`),started=performance.now();
 const repository=await cachedRepository(`feeds:${origin}`,()=>createFeedCatalogRepository(origin,fetcher));
 const repositoryMs=performance.now()-started,queryStarted=performance.now();
 const detail=await repository.getDetail(kind,productId,market);
 recordTiming(detail,"feed",repositoryMs,performance.now()-queryStarted,cold);
 return detail;
}
