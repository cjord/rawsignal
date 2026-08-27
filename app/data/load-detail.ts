import {env} from "cloudflare:workers";
import {createD1CatalogRepository} from "../../db/catalog-repository";
import {publishedIngestion,type D1DatabaseLike} from "../../db/repository";
import type {CatalogDetail,CatalogKind} from "../domain/types";
import {createFeedCatalogRepository} from "./feed-catalog-repository";
import {parseSealedProducts} from "../domain/contracts";
import {createMemoryCatalogRepository} from "./catalog-repository";

export async function loadCatalogDetail(kind:CatalogKind,productId:number,market:string|undefined,origin:string):Promise<CatalogDetail|null>{
 const db=env.DB as unknown as D1DatabaseLike|undefined;
 if(db&&productId>0)try{const published=await publishedIngestion(db);if(published){const detail=await createD1CatalogRepository(db,published.runId).getDetail(kind,productId,market);if(detail)return detail}}catch{/* Retain the generated detail snapshot while D1 is incomplete. */}
 const assets=(env as unknown as {ASSETS?:{fetch(input:RequestInfo|URL,init?:RequestInit):Promise<Response>}}).ASSETS;
 if(kind==="sealed"&&market==="scalping")try{const request=new Request(new URL("/data/sealed-scalping.json",origin)),response=await (assets?assets.fetch(request):fetch(request));if(response.ok){const products=parseSealedProducts(await response.json()),detail=await createMemoryCatalogRepository([],products).getDetail(kind,productId,market);if(detail)return detail}}catch{/* Fall through to the standard market snapshots. */}
 return (await createFeedCatalogRepository(origin,assets?assets.fetch.bind(assets):fetch)).getDetail(kind,productId,market);
}
