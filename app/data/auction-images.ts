import {AUCTION_LOT_SIZES,generateAuctionLot} from '../../core/domain/auction-lots.ts';
import type {AuctionCard,AuctionKind} from '../../core/domain/auction-types';
import type {PriceGameImageLoader} from './price-game-images';

export async function prepareAuctionLot(catalog:AuctionCard[],loader:PriceGameImageLoader,seed:number,kind:AuctionKind='free',signal?:AbortSignal):Promise<AuctionCard[]>{
 let pool=catalog.filter(card=>card.image.trim()&&!loader.failed(card.image));
 const verified=new Set<string>(),minimum=AUCTION_LOT_SIZES[kind].min;
 while(pool.length>=6&&!signal?.aborted){
  // Failed URLs leave the stock pool, not the seed: preserve the advertised theme.
  const lot=generateAuctionLot(pool,seed,kind);
  if(lot.length<minimum)return [];
  const urls=[...new Set(lot.map(card=>card.image))].filter(src=>!verified.has(src));
  for(let offset=0;offset<urls.length;offset+=6){
   if(signal?.aborted)return [];
   await Promise.all(urls.slice(offset,offset+6).map(async src=>{if(await loader.load(src))verified.add(src);else loader.exclude(src)}));
  }
  if(lot.every(card=>verified.has(card.image)))return signal?.aborted?[]:lot;
  // Every unsuccessful pass removes at least one failed URL, so retries terminate
  // only on genuinely exhausted stock, never an arbitrary four-draw limit.
  pool=pool.filter(card=>!loader.failed(card.image));
 }
 return [];
}
