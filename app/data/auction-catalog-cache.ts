import type {Card} from '../../core/domain/types.ts';
import {parseAuctionCatalogManifest,unpackAuctionCatalog,verifyAuctionCatalogSnapshot,type AuctionCatalogSnapshot} from '../../core/domain/auction-catalog-snapshot.ts';
import {requestJson} from './request-json.ts';

export const AUCTION_CATALOG_FRESH_MS=5*60_000;
type CacheState={snapshot:AuctionCatalogSnapshot|null;items:Card[];loading:boolean;error:string|null;checkedAt:number};
const initial:CacheState={snapshot:null,items:[],loading:false,error:null,checkedAt:0};
export function createAuctionCatalogCache(fetcher:typeof fetch=(input,options)=>fetch(input,options),clock=Date.now,timeoutMs=15_000){
 let state=initial,pending:Promise<AuctionCatalogSnapshot|null>|null=null;
 const listeners=new Set<()=>void>(),publish=(next:CacheState)=>{state=next;for(const listener of listeners)listener()};
 const read=async(url:string)=>{
  const {response,data}=await requestJson(url,{cache:'no-store',credentials:'omit'},{fetcher,timeoutMs});
  if(!response.ok){const error=new Error('Price refresh unavailable. Using the latest valid market snapshot available here; it may be out of date.');throw Object.assign(error,{status:response.status})}
  return data;
 };
 const load=async()=>{
  // Retry a publication race once. An old manifest must never label a new payload.
  for(let attempt=0;attempt<2;attempt++){
   const manifest=parseAuctionCatalogManifest(await read('/api/auction/catalog'));
   if(state.snapshot?.source==='database'&&manifest.source==='feed')throw new Error('Live market data is unavailable. Keeping the last checked catalog.');
   if(state.snapshot?.version===manifest.version){publish({...state,loading:false,error:null,checkedAt:clock()});return state.snapshot}
   try{
    const snapshot=await verifyAuctionCatalogSnapshot(await read(`/api/auction/catalog?version=${manifest.version}`));
    if(snapshot.version!==manifest.version||snapshot.count!==manifest.count||snapshot.source!==manifest.source||snapshot.asOf!==manifest.asOf||snapshot.publishedAt!==manifest.publishedAt)throw new Error('Auction catalog changed during loading. Retry the price check.');
    publish({snapshot,items:unpackAuctionCatalog(snapshot),loading:false,error:null,checkedAt:clock()});return snapshot;
   }catch(cause){if(attempt===0&&(cause as {status?:number})?.status===409)continue;throw cause}
  }
  throw new Error('Auction catalog changed during loading.');
 };
 const refresh=(force=false):Promise<AuctionCatalogSnapshot|null>=>{
  if(pending)return pending;
  if(!force&&state.snapshot&&!state.error&&clock()-state.checkedAt<AUCTION_CATALOG_FRESH_MS)return Promise.resolve(state.snapshot);
  publish({...state,loading:true,error:null});
  pending=load().catch(cause=>{publish({...state,loading:false,error:cause instanceof Error?cause.message:'Auction catalog unavailable.'});return null}).finally(()=>{pending=null});
  return pending;
 };
 return {getSnapshot:()=>state,getServerSnapshot:()=>initial,subscribe:(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener)}},refresh};
}
// Public prices only. No wallets, account documents, private cards or owner IDs.
export const auctionCatalogCache=createAuctionCatalogCache();
