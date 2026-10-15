import {auctionRandom,sampleIndices} from './auction-types.ts';

export const AUCTION_NPCS=[
 {name:'The Dealer',participation:.97,margin:.84,noise:.03,risk:0,portrait:'dealer',strategy:'Bulk-First Reseller',cluePriority:['bulk','rares','top2','common-count'],description:'Checks bulk value first, then regular rares and overall resale value.'},
 {name:'The Collector',participation:.98,margin:.9,noise:.03,risk:.025,portrait:'collector',strategy:'Premium Specialist',cluePriority:['rare8','alt3','chase1','top2'],description:'Inspects premium cards but keeps a resale margin; occasionally stretches for a promising lot.'},
 {name:'The Opportunist',participation:.95,margin:.88,noise:.04,risk:.05,portrait:'opportunist',strategy:'Targeted Scout',cluePriority:['rare8','epic5','top2','reveal3'],description:'Targets rare and epic copies, with an occasional speculative bid.'},
 {name:'The Analyst',participation:.99,margin:.88,noise:.02,risk:0,portrait:'dealer',strategy:'Aggregate Valuation',cluePriority:['rares','bulk','rarities','top2'],description:'Favors category totals and a conservative cross-check of premium stock.'},
 {name:'The Gambler',participation:.97,margin:.98,noise:.06,risk:.1,portrait:'opportunist',strategy:'Chase Hunter',cluePriority:['reveal3','alt3','chase1','top2'],description:'Hunts chase cards and occasionally stretches beyond a comfortable resale margin.'},
 {name:'The Bargain Hunter',participation:.94,margin:.8,noise:.03,risk:0,portrait:'player',strategy:'Everyday Value',cluePriority:['common-count','uncommon-count','bulk','rares'],description:'Counts everyday stock before checking category values.'},
 {name:'The Follower',participation:.97,margin:.86,noise:.03,risk:.02,portrait:'collector',strategy:'Sample Checker',cluePriority:['reveal3','rare8','epic5','top2'],description:'Builds on shared reveals and personal scans; follows previous public bids more often than other rivals.'},
 {name:'The Archivist',participation:.97,margin:.86,noise:.02,risk:0,portrait:'archivist',strategy:'Collection Census',cluePriority:['sets','rarities','bulk','top2'],description:'Maps expansions and rarities before using grouped price estimates.'},
 {name:'The Playset Builder',participation:.96,margin:.88,noise:.03,risk:.01,portrait:'playset-builder',strategy:'Repeat-Card Specialist',cluePriority:['duplicates','identity3','rarities','rares'],description:'Checks duplicate density and identities, then values regular-card stock.'},
 {name:'The Skeptic',participation:.95,margin:.78,noise:.02,risk:0,portrait:'skeptic',strategy:'Cautious Cross-Check',cluePriority:['reveal3','bulk','rares','top2'],description:'Cross-checks samples and usually bids cautiously rather than sitting out.'},
] as const;
export function auctionNpcRoster(seed:number){return sampleIndices(AUCTION_NPCS.length,3,seed+907).map(index=>AUCTION_NPCS[index])}
export function auctionNpcMood(seed:number,name:string){
 const index=AUCTION_NPCS.findIndex(npc=>npc.name===name),random=auctionRandom(seed+index*719+311);
 return {confidence:.98+random()*.04,participation:(random()-.5)*.12};
}
