import {auctionRandom,sampleIndices} from './auction-types.ts';

export const AUCTION_NPCS=[
 {name:'The Dealer',participation:.97,margin:.84,noise:.03,risk:0,portrait:'dealer',strategy:'Bulk-First Reseller',cluePriority:['bulk','rares','top2','common-count'],description:'Checks ordinary Common-through-Epic stock first, then Alt-Art value and premium exposure.'},
 {name:'The Collector',participation:.98,margin:.9,noise:.03,risk:.025,portrait:'collector',strategy:'Premium Specialist',cluePriority:['rare8','alt3','chase1','top2'],description:'Inspects premium cards but keeps a resale margin; occasionally stretches for a promising lot.'},
 {name:'The Opportunist',participation:.95,margin:.88,noise:.04,risk:.05,portrait:'opportunist',strategy:'Targeted Scout',cluePriority:['rare8','epic5','top2','reveal3'],description:'Targets rare and epic copies, with an occasional speculative bid.'},
 {name:'The Analyst',participation:.99,margin:.88,noise:.02,risk:0,portrait:'dealer',strategy:'Aggregate Valuation',cluePriority:['rares','bulk','rarities','top2'],description:'Favors category totals and a conservative cross-check of premium stock.'},
 {name:'The Gambler',participation:.97,margin:.98,noise:.06,risk:.1,portrait:'opportunist',strategy:'Chase Hunter',cluePriority:['reveal3','alt3','chase1','top2'],description:'Hunts chase cards and occasionally stretches beyond a comfortable resale margin.'},
 {name:'The Bargain Hunter',participation:.94,margin:.8,noise:.03,risk:0,portrait:'player',strategy:'Everyday Value',cluePriority:['common-count','uncommon-count','bulk','rares'],description:'Counts everyday stock before checking category values.'},
 {name:'The Follower',participation:.97,margin:.86,noise:.03,risk:.02,portrait:'collector',strategy:'Sample Checker',cluePriority:['reveal3','rare8','epic5','top2'],description:'Builds on shared reveals and personal scans; follows previous public bids more often than other rivals.'},
 {name:'The Archivist',participation:.97,margin:.86,noise:.02,risk:0,portrait:'archivist',strategy:'Collection Census',cluePriority:['sets','rarities','bulk','top2'],description:'Maps expansions and rarities before using grouped price estimates.'},
 {name:'The Playset Builder',participation:.96,margin:.88,noise:.03,risk:.01,portrait:'playset-builder',strategy:'Repeat-Card Specialist',cluePriority:['duplicates','identity3','rarities','rares'],description:'Checks duplicate density and identities, then values regular-card stock.'},
 {name:'The Skeptic',participation:.95,margin:.78,noise:.02,risk:0,portrait:'skeptic',strategy:'Cautious Cross-Check',cluePriority:['reveal3','bulk','rares','top2'],description:'Cross-checks samples and usually bids cautiously rather than sitting out.'},
 {name:'The Closer',participation:.98,margin:.91,noise:.03,risk:.025,portrait:'closer',strategy:'Late-Round Conviction',cluePriority:['rarities','identity3','rares','top2'],description:'Starts reserved, surveys the collection, then bids more assertively as later investigations sharpen the estimate.'},
 {name:'The Trust Fund Kid',participation:.99,margin:1,noise:.08,risk:.18,portrait:'trust-fund-kid',strategy:'Win-First Spender',cluePriority:['reveal3','alt3','chase1','top2'],description:'A rare wealthy guest who prioritizes winning over resale margin. Pays a large premium on a personal estimate, even when that estimate is wrong.'},
] as const;
export const AUCTION_RARE_GUEST_CHANCE=.08;
export function auctionNpcRoster(seed:number,pinned?:readonly string[]){
 if(pinned?.length===3&&new Set(pinned).size===3&&pinned.every(name=>AUCTION_NPCS.some(profile=>profile.name===name)))return pinned.map(name=>AUCTION_NPCS.find(profile=>profile.name===name)!);
 const ordinary=AUCTION_NPCS.filter(npc=>npc.name!=='The Trust Fund Kid');
 const guest=auctionRandom(seed+1207)()<AUCTION_RARE_GUEST_CHANCE;
 const roster:typeof AUCTION_NPCS[number][]=sampleIndices(ordinary.length,guest?2:3,seed+907).map(index=>ordinary[index]);
 if(guest)roster.splice(Math.floor(auctionRandom(seed+1607)()*3),0,AUCTION_NPCS[AUCTION_NPCS.length-1]);
 return roster;
}
// Intentional personality premiums, applied to the NPC's own information only.
// Neither this nor roster selection can inspect the true collection value.
export function auctionNpcAmbition(name:string,round:number,random:()=>number){
 if(name==='The Trust Fund Kid')return 1.35+random()*.45;
 if(name==='The Closer')return [.9,.98,1.08,1.18][Math.max(0,Math.min(3,round-1))];
 return 1;
}
export function auctionNpcMood(seed:number,name:string){
 const index=AUCTION_NPCS.findIndex(npc=>npc.name===name),random=auctionRandom(seed+index*719+311);
 return {confidence:.98+random()*.04,participation:(random()-.5)*.12};
}
