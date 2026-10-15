import {sampleIndices,type Auction} from './auction-types.ts';

export function openingRevealCount(length:number,seed:number){
 const extra=[0,0,0,1,2][sampleIndices(5,1,seed+719)[0]];
 return Math.min(length,Math.ceil(length*.05)+1+extra);
}
export function publicAuctionSlots(auction:Auction){return [...new Set(auction.publicReveals?.flatMap(reveal=>reveal.slots)??[0,2])]}
export function revealPublicRound(auction:Auction):Auction{
 if(auction.publicReveals?.some(reveal=>reveal.round===auction.round))return auction;
 const count=auction.round===1?openingRevealCount(auction.lot.length,auction.seed):1+sampleIndices(3,1,auction.seed+auction.round*373)[0];
 const slots=sampleIndices(auction.lot.length,count,auction.seed+auction.round*239,auction.round===1?[]:publicAuctionSlots(auction));
 const previous=auction.publicReveals??(auction.round>1?[{round:1,slots:[0,2]}]:[]);
 return {...auction,publicReveals:[...previous,{round:auction.round,slots}],known:[...new Set([...auction.known,...slots])],priced:[...new Set([...auction.priced,...slots])]};
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
