import type {Card} from '../../core/domain/types.ts';
import {allowedRarities} from '../../core/market-state.ts';
import {parseCards} from '../../core/domain/contracts.ts';
import {holdingKey} from '../../core/domain/auction-types.ts';
import {requestJson} from './request-json.ts';
const sources=allowedRarities.riftbound.map(section=>`/data/${section}.json`);
type State={items:Card[];status:'idle'|'loading'|'success'|'empty'|'error';loading:boolean;error:string|null;checkedAt:number};
const initial:State={items:[],status:'idle',loading:false,error:null,checkedAt:0};
export function createLegacyAuctionCatalog(fetcher:typeof fetch=fetch,clock=Date.now,timeoutMs=15_000){
 let state=initial,pending:Promise<void>|null=null;
 const listeners=new Set<()=>void>(),publish=(next:State)=>{state=next;listeners.forEach(listener=>listener())};
 const refresh=(force=false)=>{
  if(pending)return pending;
  if(!force&&state.status==='success'&&!state.error&&clock()-state.checkedAt<300_000)return Promise.resolve();
  publish({...state,loading:true,status:state.items.length?'success':'loading',error:null});
  pending=Promise.all(sources.map(async source=>{const {response,data}=await requestJson(source,{credentials:'omit'},{fetcher,timeoutMs});if(response.status===404)return [];if(!response.ok)throw new Error('Market refresh unavailable. Keeping the last loaded prices where available.');return parseCards(data)})).then(groups=>{const items=[...new Map(groups.flat().filter(card=>card.game==='riftbound').map(card=>[holdingKey(card),card])).values()];publish({items,status:items.length?'success':'empty',loading:false,error:null,checkedAt:clock()})}).catch(cause=>publish({...state,status:state.items.length?'success':'error',loading:false,error:cause instanceof Error?cause.message:'Market unavailable.'})).finally(()=>{pending=null});
  return pending;
 };
 return {getSnapshot:()=>state,getServerSnapshot:()=>initial,subscribe:(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener)}},refresh};
}
// Public catalog only, bounded to one browser document. Never persist owner data.
export const legacyAuctionCatalog=createLegacyAuctionCatalog();
