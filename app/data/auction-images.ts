import {generateAuctionLot} from '../../core/domain/auction-lots';
import type {AuctionCard,AuctionKind} from '../../core/domain/auction-types';
import type {PriceGameImageLoader} from './price-game-images';

export async function prepareAuctionLot(catalog:AuctionCard[],loader:PriceGameImageLoader,seed:number,kind:AuctionKind='free'):Promise<AuctionCard[]>{
 for(let attempt=0;attempt<4;attempt++){
  const lot=generateAuctionLot(catalog.filter(card=>!loader.failed(card.image)),seed,kind);
  if(lot.length<(kind==='paid'?128:6))return [];
  const urls=[...new Set(lot.map(card=>card.image))];
  for(let offset=0;offset<urls.length;offset+=6)await Promise.all(urls.slice(offset,offset+6).map(src=>loader.load(src)));
  if(lot.every(card=>!loader.failed(card.image)))return lot;
 }
 return [];
}
