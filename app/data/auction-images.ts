import {generateAuctionLot} from '../../core/domain/auction-lots';
import type {AuctionCard} from '../../core/domain/auction-types';
import type {PriceGameImageLoader} from './price-game-images';

export async function prepareAuctionLot(catalog:AuctionCard[],loader:PriceGameImageLoader,seed:number):Promise<AuctionCard[]>{
 for(let attempt=0;attempt<4;attempt++){
  const lot=generateAuctionLot(catalog.filter(card=>!loader.failed(card.image)),seed);
  if(!lot.length)return [];
  const urls=[...new Set(lot.map(card=>card.image))];
  for(let offset=0;offset<urls.length;offset+=6)await Promise.all(urls.slice(offset,offset+6).map(src=>loader.load(src)));
  if(lot.every(card=>!loader.failed(card.image)))return lot;
 }
 return [];
}
