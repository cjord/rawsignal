import type {D1DatabaseLike} from '../db/repository.ts';
import {readAuctionCatalogSnapshot} from '../db/auction-catalog.ts';
import {meteredReads} from '../db/read-meter.ts';
import {allowedRarities} from '../core/market-state.ts';
import {parseCards} from '../core/domain/contracts.ts';
import {auctionCatalogCacheEnabled,createAuctionCatalogSnapshot,type AuctionCatalogSnapshot} from '../core/domain/auction-catalog-snapshot.ts';

type CatalogEnv={DB?:D1DatabaseLike;ASSETS?:{fetch(request:Request):Promise<Response>};ENVIRONMENT?:string;AUCTION_CATALOG_CACHE_ENABLED?:string};
const snapshots=new WeakMap<object,{until:number;value:Promise<AuctionCatalogSnapshot>;pending:boolean}>();
const TTL=60_000;
async function bundledCatalog(request:Request,env:CatalogEnv){
 if(!env.ASSETS)throw new Error('Bundled auction catalog unavailable');
 const groups=await Promise.all(allowedRarities.riftbound.map(async section=>{
  const response=await env.ASSETS!.fetch(new Request(new URL(`/data/${section}.json`,request.url)));
  if(!response.ok)throw new Error('Incomplete bundled auction catalog');
  return parseCards(await response.json());
 }));
 const cards=[...new Map(groups.flat().filter(card=>card.game==='riftbound').map(card=>[`${card.productId}:${card.printing}`,card])).values()];
 // Static fallback has no claimed live source date. It is explicitly labeled feed.
 return createAuctionCatalogSnapshot(cards,'feed',null,null);
}
export function loadAuctionCatalog(request:Request,env:CatalogEnv,now=Date.now()){
 const key=env.DB??env.ASSETS;if(!key)return Promise.reject(new Error('Catalog unavailable'));
 const cached=snapshots.get(key);if(cached&&(cached.pending||cached.until>now))return cached.value;
 const value=(async()=>{if(env.DB){const meter=meteredReads(env.DB);let outcome='fallback';try{const snapshot=await readAuctionCatalogSnapshot(meter.db);outcome='database';return snapshot}catch{/* Preserve the bundled fallback, explicitly labeled. */}finally{if(env.ENVIRONMENT==='staging')console.info(JSON.stringify({event:'auction_catalog_read_cost',outcome,...meter.summary()}))}}return bundledCatalog(request,env)})();
 const memo={until:now+TTL,value,pending:true};snapshots.set(key,memo);
 void value.then(()=>{memo.pending=false},()=>{if(snapshots.get(key)?.value===value)snapshots.delete(key)});
 return value;
}
export async function handleAuctionCatalog(request:Request,env:CatalogEnv){
 const json=(body:unknown,status=200,headers:Record<string,string>={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store',...headers}});
 if(!auctionCatalogCacheEnabled(env))return json({error:'Auction catalog cache is not enabled'},404);
 if(request.method!=='GET')return json({error:'Method not allowed'},405,{Allow:'GET'});
 const url=new URL(request.url),version=url.searchParams.get('version');
 if([...url.searchParams.keys()].some(key=>key!=='version')||version!==null&&!/^[a-f0-9]{64}$/.test(version))return json({error:'Invalid catalog version'},400);
 try{
  const snapshot=await loadAuctionCatalog(request,env);
  if(version&&snapshot.version!==version)return json({error:'Catalog changed; recheck its manifest'},409);
  const manifest={schema:snapshot.schema,version:snapshot.version,source:snapshot.source,asOf:snapshot.asOf,publishedAt:snapshot.publishedAt,count:snapshot.count};
  return json(version?snapshot:manifest,200,{'Cache-Control':version?'public, max-age=0, s-maxage=600':'public, max-age=0, must-revalidate',ETag:`"${snapshot.version}"`,'X-Raw-Signal-Source':snapshot.source});
 }catch{return json({error:'Auction market catalog is temporarily unavailable'},503)}
}
