import {auctionRarityBand} from './auction-copy-policy.ts';
import {auctionRarityWeights} from './auction-composition.ts';
import {holdingKey,type AuctionCard,type AuctionKind,type AuctionMarketPrior} from './auction-types.ts';

export function auctionReferencePrice(prices:number[]){
 if(!prices.length)return 0;
 const sorted=prices.toSorted((a,b)=>a-b),median=sorted[Math.floor((sorted.length-1)/2)];
 return sorted.reduce((total,price)=>total+Math.min(price,median*3),0)/sorted.length*.8+median*.2;
}

// Market-level expectations only: never inspect the generated lot or reproduce its
// draw sequence. Freeze this small public-catalog model once, before round one.
export function auctionMarketPrior(catalog:AuctionCard[],seed:number,kind:AuctionKind):AuctionMarketPrior{
 const stock=[...new Map(catalog.filter(card=>card.image.trim()&&Number.isSafeInteger(card.cents)&&card.cents>0).map(card=>[holdingKey(card),card])).values()];
 const weights=auctionRarityWeights(seed,kind),groups=new Map<string,number[]>();
 for(const card of stock){const band=auctionRarityBand(card);groups.set(band,[...(groups.get(band)??[]),card.cents]);}
 const total=[...groups.keys()].reduce((sum,band)=>sum+weights[band as keyof typeof weights],0);
 const bands=[...groups].map(([band,prices])=>({band,mean:prices.reduce((sum,price)=>sum+price,0)/prices.length,typical:auctionReferencePrice(prices),share:weights[band as keyof typeof weights]/total}));
 return {mean:bands.reduce((sum,band)=>sum+band.mean*band.share,0),bands};
}
export function priorMean(prior:AuctionMarketPrior|undefined,bands?:string[],typical=false){
 if(!prior)return 0;
 if(!bands)return prior.mean;
 const selected=prior.bands.filter(row=>bands.includes(row.band)),share=selected.reduce((sum,row)=>sum+row.share,0);
 return share?selected.reduce((sum,row)=>sum+(typical?row.typical??row.mean*.35:row.mean)*row.share,0)/share:0;
}
