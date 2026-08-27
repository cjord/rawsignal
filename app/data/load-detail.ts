import {env} from "cloudflare:workers";
import {createD1CatalogRepository} from "../../db/catalog-repository";
import {publishedIngestion,type D1DatabaseLike} from "../../db/repository";
import type {CatalogDetail,CatalogKind} from "../domain/types";
import {createFeedCatalogRepository} from "./feed-catalog-repository";
import {parseSealedProducts} from "../domain/contracts";
import {createMemoryCatalogRepository,type CatalogRepository} from "./catalog-repository";

type FetchLike=(input:RequestInfo|URL,init?:RequestInit)=>Promise<Response>;

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
 if(db&&productId>0)try{const published=await publishedIngestion(db);if(published){const detail=await createD1CatalogRepository(db,published.runId).getDetail(kind,productId,market);if(detail)return detail}}catch{/* Retain the generated detail snapshot while D1 is incomplete. */}
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
 return (await cachedRepository(`feeds:${origin}`,()=>createFeedCatalogRepository(origin,fetcher))).getDetail(kind,productId,market);
}
