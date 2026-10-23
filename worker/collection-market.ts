import type {AccountEnv} from './account-auth.ts';
import type {D1DatabaseLike} from '../db/repository.ts';
import {collectionMarket} from '../db/collection-market.ts';
import {allowedRarities} from '../core/market-state.ts';
import {parseCards,parseSealedProducts} from '../core/domain/contracts.ts';
import {productKey,type CollectionProduct,type ProductRef} from '../core/domain/owned-collections.ts';
import {withRiftboundRegularArtwork} from '../core/domain/riftbound-artwork.ts';
type Assets={fetch(request:Request):Promise<Response>};
const cache=new WeakMap<object,{until:number;value:Promise<CollectionProduct[]>}>();
async function feeds(request:Request,assets:Assets){
 const cached=cache.get(assets);if(cached&&cached.until>Date.now())return cached.value;
 const value=(async()=>{
  const paths:{path:string;kind:'single'|'sealed'}[]=[...[...new Set(allowedRarities.all)].map(section=>({path:`/data/${section}.json`,kind:'single' as const})),...['pokemon','riftbound','onepiece'].map(game=>({path:`/data/sealed-${game}.json`,kind:'sealed' as const}))];
  const groups=await Promise.all(paths.map(async entry=>{
   const response=await assets.fetch(new Request(new URL(entry.path,request.url)));if(response.status===404)return [];if(!response.ok)throw new Error('Collection feed unavailable');
   const raw=await response.json();
   if(entry.kind==='single')return parseCards(raw).map(withRiftboundRegularArtwork).map(card=>({...card,kind:'single',cents:card.marketPrice===null?null:Math.round(card.marketPrice*100),source:'feed',asOf:null})) as CollectionProduct[];
   return parseSealedProducts(raw).filter(row=>['pokemon','riftbound','onepiece'].includes(row.game)).map(row=>({...row,kind:'sealed',printing:'Sealed',rarity:row.category,cents:row.marketPrice===null?null:Math.round(row.marketPrice*100),source:'feed',asOf:null})) as CollectionProduct[];
  }));
  // Store only the compact collection contract, not full market feeds or signals.
  return [...new Map(groups.flat().map(row=>[productKey(row),{kind:row.kind,game:row.game,productId:row.productId,printing:row.printing,name:row.name,set:row.set,rarity:row.rarity,image:row.image||null,cents:row.cents,source:row.source,asOf:row.asOf}])).values()];
 })();cache.set(assets,{until:Date.now()+300000,value});void value.catch(()=>cache.delete(assets));return value;
}
export async function loadCollectionMarket(request:Request,env:AccountEnv,refs:ProductRef[]){
 const unique=[...new Map(refs.map(row=>[productKey(row),row])).values()];if(!unique.length)return [];
 if(unique.length>2000)throw new Error('Too many collection products');
 try{const rows=await collectionMarket(env.DB as D1DatabaseLike,unique);if(rows)return rows}catch{/* Keep the established, explicitly labeled bundled fallback. */}
 const assets=(env as AccountEnv&{ASSETS?:Assets}).ASSETS;if(!assets)throw new Error('Collection market unavailable');
 const wanted=new Set(unique.map(productKey));return (await feeds(request,assets)).filter(row=>wanted.has(productKey(row)));
}
