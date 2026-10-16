import {auctionRandom,type Auction} from './auction-types.ts';
// One shared coin flip per auction; otherwise each personality skips one round.
// No hidden lot attributes or current sealed bids influence this schedule.
export function npcInvestigationRounds(seed:number,name:string):number[]{
 if(auctionRandom(seed+62831)()<.5)return [1,2,3,4];
 const code=[...name].reduce((sum,char)=>sum+char.charCodeAt(0),0),roll=auctionRandom(seed+code*331)();
 const skipped=name==='The Closer'?1:1+Math.floor(roll*4);
 return [1,2,3,4].filter(round=>round!==skipped);
}
export const npcCanInvestigate=(auction:Auction,name:string)=>!auction.npcInvestigationSchedule||npcInvestigationRounds(auction.seed,name).includes(auction.round);
