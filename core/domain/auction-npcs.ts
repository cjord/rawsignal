import {auctionRandom,sampleIndices} from './auction-types.ts';

export const AUCTION_NPCS=[
 {name:'The Dealer',participation:.85,margin:.72,noise:.16,prior:.12,portrait:'dealer',description:'Cautious reseller looking for a margin.'},
 {name:'The Collector',participation:.92,margin:1.08,noise:.2,prior:.08,portrait:'collector',description:'Pays a premium for a promising collection.'},
 {name:'The Opportunist',participation:.72,margin:.87,noise:.28,prior:.16,portrait:'opportunist',description:'Unpredictable bargain hunter who sometimes passes.'},
 {name:'The Analyst',participation:.96,margin:.94,noise:.08,prior:.05,portrait:'dealer',description:'Careful estimator with a narrow bidding range.'},
 {name:'The Gambler',participation:.78,margin:1.05,noise:.42,prior:.1,portrait:'opportunist',description:'Takes larger risks on limited information.'},
 {name:'The Bargain Hunter',participation:.65,margin:.58,noise:.18,prior:.08,portrait:'player',description:'Often passes, but bids low when a deal looks possible.'},
 {name:'The Follower',participation:.88,margin:.96,noise:.18,prior:.4,portrait:'collector',description:'Leans more heavily on already-revealed bids.'},
] as const;
export function auctionNpcRoster(seed:number){return sampleIndices(AUCTION_NPCS.length,3,seed+907).map(index=>AUCTION_NPCS[index])}
export function auctionNpcMood(seed:number,name:string){
 const index=AUCTION_NPCS.findIndex(npc=>npc.name===name),random=auctionRandom(seed+index*719+311);
 return {confidence:.88+random()*.24,participation:(random()-.5)*.12};
}
