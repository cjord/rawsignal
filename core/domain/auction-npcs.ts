import {auctionRandom,sampleIndices} from './auction-types.ts';

export const AUCTION_NPCS=[
 {name:'The Dealer',participation:.85,margin:.84,noise:.03,risk:0,portrait:'dealer',strategy:'Bulk-First Reseller',cluePriority:['bulk','rares','appraisal','common3'],description:'Checks bulk value first, then regular rares and overall resale value.'},
 {name:'The Collector',participation:.92,margin:.9,noise:.03,risk:.025,portrait:'collector',strategy:'Premium Specialist',cluePriority:['rare2','alt1','chase1','top5'],description:'Inspects premium cards but keeps a resale margin; occasionally stretches for a promising lot.'},
 {name:'The Opportunist',participation:.72,margin:.88,noise:.04,risk:.05,portrait:'opportunist',strategy:'Targeted Scout',cluePriority:['rare2','epic2','top5','reveal3'],description:'Targets rare and epic copies, with an occasional speculative bid.'},
 {name:'The Analyst',participation:.96,margin:.88,noise:.02,risk:0,portrait:'dealer',strategy:'Aggregate Valuation',cluePriority:['rares','bulk','appraisal','top5'],description:'Favors category totals and a conservative collection appraisal.'},
 {name:'The Gambler',participation:.78,margin:.98,noise:.06,risk:.1,portrait:'opportunist',strategy:'Chase Hunter',cluePriority:['reveal3','alt1','chase1','top5'],description:'Hunts chase cards and occasionally stretches beyond a comfortable resale margin.'},
 {name:'The Bargain Hunter',participation:.65,margin:.8,noise:.03,risk:0,portrait:'player',strategy:'Everyday Value',cluePriority:['common3','uncommon3','bulk','rares'],description:'Looks for value in everyday stock before committing to the rarer cards.'},
 {name:'The Follower',participation:.88,margin:.86,noise:.03,risk:.02,portrait:'collector',strategy:'Sample Checker',cluePriority:['reveal3','rare2','epic2','appraisal'],description:'Builds on shared reveals with personal scans, then checks the overall appraisal.'},
 {name:'The Archivist',participation:.9,margin:.86,noise:.02,risk:0,portrait:'archivist',strategy:'Collection Census',cluePriority:['sets','rarities','bulk','appraisal'],description:'Maps expansions and rarities before using grouped price estimates.'},
 {name:'The Playset Builder',participation:.84,margin:.88,noise:.03,risk:.01,portrait:'playset-builder',strategy:'Repeat-Card Specialist',cluePriority:['duplicates','identity3','rarities','rares'],description:'Checks duplicate density and identities, then values regular-card stock.'},
 {name:'The Skeptic',participation:.76,margin:.78,noise:.02,risk:0,portrait:'skeptic',strategy:'Cautious Cross-Check',cluePriority:['reveal3','bulk','rares','appraisal'],description:'Cross-checks samples and passes more often when information is uncertain.'},
] as const;
export function auctionNpcRoster(seed:number){return sampleIndices(AUCTION_NPCS.length,3,seed+907).map(index=>AUCTION_NPCS[index])}
export function auctionNpcMood(seed:number,name:string){
 const index=AUCTION_NPCS.findIndex(npc=>npc.name===name),random=auctionRandom(seed+index*719+311);
 return {confidence:.98+random()*.04,participation:(random()-.5)*.12};
}
