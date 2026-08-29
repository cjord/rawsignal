import {env} from "cloudflare:workers";
import {createD1CatalogRepository} from "../../db/catalog-repository";
import {publishedIngestion,type D1DatabaseLike} from "../../db/repository";
import type {CatalogDetail,CatalogKind,PullRateConfig} from "../../core/domain/types";
import {createFeedCatalogRepository} from "./feed-catalog-repository";
import {parsePullRateConfig,parseSealedProducts} from "../../core/domain/contracts";
import {createMemoryCatalogRepository,type CatalogRepository} from "../../core/catalog-repository";

type FetchLike=(input:RequestInfo|URL,init?:RequestInit)=>Promise<Response>;

// Diagnostic timings for real-deployment cold-start measurement (todo F1). RSC pages cannot
// set response headers, so the detail page surfaces this Server-Timing-formatted string as a
// data attribute; keyed by the returned detail object to stay race-free across requests.
const detailTimings=new WeakMap<CatalogDetail,string>();
export const detailServerTiming=(detail:CatalogDetail|null)=>detail?detailTimings.get(detail)??null:null;
const recordTiming=(detail:CatalogDetail|null,source:string,repositoryMs:number,detailMs:number,cold:boolean)=>{if(detail)detailTimings.set(detail,`repo;dur=${Math.round(repositoryMs)}${cold?";desc=cold":""}, detail;dur=${Math.round(detailMs)}, source;desc=${source}`)};

// The curated pull-rate config is a small bundled asset; D1-served details thread it into
// the adapter so the hero pull-rate tile and sealed pull-rate sections keep feed parity.
// Cached per isolate; a failed fetch resolves undefined and retries next isolate.
const pullRateConfigs=new Map<string,Promise<PullRateConfig|undefined>>();
function cachedPullRates(origin:string,fetcher:FetchLike){
 let config=pullRateConfigs.get(origin);
 if(!config){
  config=fetcher(new Request(new URL("/data/pull-rates.json",origin),{headers:{Accept:"application/json"}}))
   .then(response=>{if(!response.ok)throw new Error(`Pull rates unavailable: ${response.status}`);return response.json()})
   .then(value=>parsePullRateConfig(value)).catch(()=>undefined);
  pullRateConfigs.set(origin,config);
 }
 return config;
}

// The metrics payload prices pack EV from the same curated config (audit Phase C); assets
// resolve by path, so a fixed placeholder origin serves every caller without a request URL.
export function loadPullRateConfig():Promise<PullRateConfig|undefined>{
 const assets=(env as unknown as {ASSETS?:{fetch(input:RequestInfo|URL,init?:RequestInit):Promise<Response>}}).ASSETS;
 return cachedPullRates("https://assets.internal",assets?assets.fetch.bind(assets):fetch);
}

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
 const assets=(env as unknown as {ASSETS?:{fetch(input:RequestInfo|URL,init?:RequestInit):Promise<Response>}}).ASSETS;
 const fetcher:FetchLike=assets?assets.fetch.bind(assets):fetch;
 // Detail reads are unscoped by run: upserts re-stamp ingestion_run_id in place, so pinning
 // to the published run would exclude every product an in-progress re-ingestion has touched.
 if(db&&productId>0)try{const started=performance.now();const published=await publishedIngestion(db);if(published){const pullRates=await cachedPullRates(origin,fetcher);const repositoryMs=performance.now()-started,queryStarted=performance.now();const detail=await createD1CatalogRepository(db,undefined,pullRates).getDetail(kind,productId,market);if(detail){recordTiming(detail,"d1",repositoryMs,performance.now()-queryStarted,false);return detail}}}catch(error){
  // Retain the generated detail snapshot while D1 is incomplete — but say why it fell back.
  // An unmigrated local database (dev) is the expected fallback, not an anomaly worth logging.
  const message=error instanceof Error?error.message:"Unknown failure";
  if(!/no such table/.test(message))console.error(JSON.stringify({event:"d1_detail_failed",kind,productId,message}));
 }
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
