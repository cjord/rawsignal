import {sampleIndices,type Auction} from './auction-types.ts';

export function publicAuctionSlots(auction:Auction){return [...new Set([0,2,...(auction.publicReveals??[]).flatMap(reveal=>reveal.slots)])]}
export function revealPublicRound(auction:Auction):Auction{
 if(auction.publicReveals?.some(reveal=>reveal.round===auction.round))return auction;
 const slots=auction.round===1?[0,2]:sampleIndices(auction.lot.length,1+sampleIndices(3,1,auction.seed+auction.round*373)[0],auction.seed+auction.round*239,publicAuctionSlots(auction));
 return {...auction,publicReveals:[...(auction.publicReveals??[]),{round:auction.round,slots}],known:[...new Set([...auction.known,...slots])],priced:[...new Set([...auction.priced,...slots])]};
}

// Robust small-sample estimate: a single chase price is not the price of every unseen card.
export function auctionSampleValue(prices:number[]){
 if(!prices.length)return 0;
 const sorted=[...prices].sort((a,b)=>a-b),median=sorted[Math.floor((sorted.length-1)/2)];
 const clipped=sorted.reduce((sum,value)=>sum+Math.min(value,median*3),0)/sorted.length;
 const mean=sorted.reduce((sum,value)=>sum+value,0)/sorted.length;
 // Retain some observed chase value rather than treating genuine hits as bulk.
 return mean*.35+clipped*.45+median*.2;
}
