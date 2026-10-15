import {auctionRandom,sampleIndices} from './auction-types.ts';

export const AUCTION_NPCS=[
 {name:'The Dealer',participation:.85,margin:0.84,noise:0.04,portrait:'dealer',description:'Cautious reseller looking for a margin.'},
 {name:'The Collector',participation:.92,margin:0.98,noise:0.06,portrait:'collector',description:'Pays a premium for a promising collection.'},
 {name:'The Opportunist',participation:.72,margin:0.9,noise:0.07,portrait:'opportunist',description:'Unpredictable bargain hunter who sometimes passes.'},
 {name:'The Analyst',participation:.96,margin:0.92,noise:0.03,portrait:'dealer',description:'Careful estimator with a narrow bidding range.'},
 {name:'The Gambler',participation:.78,margin:0.98,noise:0.08,portrait:'opportunist',description:'Takes larger risks on limited information.'},
 {name:'The Bargain Hunter',participation:.65,margin:0.8,noise:0.04,portrait:'player',description:'Often passes, but bids low when a deal looks possible.'},
 {name:'The Follower',participation:.88,margin:0.9,noise:0.05,portrait:'collector',description:'Uses personal inspection with a cautious valuation margin.'},
] as const;
export function auctionNpcRoster(seed:number){return sampleIndices(AUCTION_NPCS.length,3,seed+907).map(index=>AUCTION_NPCS[index])}
export function auctionNpcMood(seed:number,name:string){
 const index=AUCTION_NPCS.findIndex(npc=>npc.name===name),random=auctionRandom(seed+index*719+311);
 return {confidence:.97+random()*.06,participation:(random()-.5)*.12};
}
