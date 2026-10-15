import type {RoundBid} from './auction-types.ts';

// Shared seeded tie order for winning bids and displayed 1st–4th placements.
export function rankAuctionBids(bids:RoundBid[],seed:number){
 const priority=['You',...bids.map(bid=>bid.name).filter(name=>name!=='You').sort()],offset=seed%4;
 return [...bids].sort((a,b)=>b.cents-a.cents||((priority.indexOf(a.name)+offset)%4)-((priority.indexOf(b.name)+offset)%4));
}
export const auctionPlacementLabel=(place:number)=>['1st','2nd','3rd','4th'][place-1]??String(place);
