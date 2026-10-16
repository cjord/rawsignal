import {auctionRandom,type AuctionCard} from './auction-types.ts';

// Decorative catalog sample only: never inspect the prepared/hidden auction lot.
export function auctionBackdropImages(catalog:Pick<AuctionCard,'image'>[],seed:number,count=10):string[]{
 const images=[...new Set(catalog.map(card=>card.image.trim()).filter(image=>/^https?:\/\//.test(image)))].sort();
 const random=auctionRandom(seed);
 for(let index=images.length-1;index>0;index--){const swap=Math.floor(random()*(index+1));[images[index],images[swap]]=[images[swap],images[index]]}
 return images.slice(0,Math.max(0,count));
}
