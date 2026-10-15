import type {AuctionCard,RoundBid} from './auction-types.ts';

export function auctionSaleRarity(card:AuctionCard){
 if(/signature/i.test(card.section))return 'Signatures';
 if(/over.?number/i.test(card.section))return 'Over-Numbered';
 if(/alt/i.test(card.section))return 'Alt Arts';
 const rarity=card.rarity.trim();
 return ({common:'Commons',uncommon:'Uncommons',rare:'Rares',epic:'Epics'} as Record<string,string>)[rarity.toLowerCase()]||rarity||'Other';
}

// Whole cents are conserved; seeded recipient order allocates any remainder fairly.
export function auctionLossShares(winner:string|null,net:number,bids:RoundBid[],seed:number){
 if(!winner||winner==='You'||net>=0)return [];
 const others=bids.filter(bid=>bid.name!==winner).map(bid=>bid.name).sort();
 if(!others.length)return [];
 const loss=-net,base=Math.floor(loss/others.length),remainder=loss%others.length;
 return others.map((name,index)=>({name,cents:base+((index+seed%others.length)%others.length<remainder?1:0)}));
}
