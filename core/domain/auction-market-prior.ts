import {auctionRarityBand} from './auction-copy-policy.ts';
import {auctionDrawBand,auctionDrawWeights,type AuctionDrawBand} from './auction-composition.ts';
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
 const weights=auctionDrawWeights(seed,kind),groups=new Map<AuctionDrawBand,AuctionCard[]>();
 for(const card of stock){const band=auctionDrawBand(card);groups.set(band,[...(groups.get(band)??[]),card]);}
 const total=[...groups.keys()].reduce((sum,band)=>sum+weights[band],0);
 // Collapse draw-only promo subgroups back to their real rarity cohorts, keeping
 // the eight-band save format and clues intact. Use the same admission weights
 // as generation, rather than the old uniform promo average.
 const bands=collapseDrawPrior(groups,weights,total);
 return {mean:bands.reduce((sum,band)=>sum+band.mean*band.share,0),bands};
}
function collapseDrawPrior(groups:Map<AuctionDrawBand,AuctionCard[]>,weights:Record<AuctionDrawBand,number>,total:number){
 const cohorts=new Map<string,{band:string;mean:number;typical:number;share:number}>();
 for(const [draw,cards] of groups){
  const rarities=new Set(cards.map(auctionRarityBand));
  for(const band of rarities){
   const prices=cards.filter(card=>auctionRarityBand(card)===band).map(card=>card.cents),share=weights[draw]/total*prices.length/cards.length;
   const cohort=cohorts.get(band)??{band,mean:0,typical:0,share:0};
   cohort.mean+=prices.reduce((sum,price)=>sum+price,0)/prices.length*share;cohort.typical+=auctionReferencePrice(prices)*share;cohort.share+=share;cohorts.set(band,cohort);
  }
 }
 return [...cohorts.values()].map(cohort=>({...cohort,mean:cohort.mean/cohort.share,typical:cohort.typical/cohort.share}));
}
export function priorMean(prior:AuctionMarketPrior|undefined,bands?:string[],typical=false){
 if(!prior)return 0;
 if(!bands)return prior.mean;
 const selected=prior.bands.filter(row=>bands.includes(row.band)),share=selected.reduce((sum,row)=>sum+row.share,0);
 return share?selected.reduce((sum,row)=>sum+(typical?row.typical??row.mean*.35:row.mean)*row.share,0)/share:0;
}
