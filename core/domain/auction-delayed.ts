import {sampleIndices,type Auction,type Clue,type Investigation} from './auction-types.ts';

export const DELAYED_INVESTIGATION:Investigation={id:'delayed-gratification',label:'Delayed Gratification',cost:1500,tier:'targeted',description:'Rounds 1–2 only. Two rounds later, reveal 2 random cards among the 5 most valuable still-unpriced cards. No immediate information or refund if the auction ends early.'};
export function delayedResult(auction:Auction){return {known:auction.known,priced:auction.priced,clue:{id:DELAYED_INVESTIGATION.id,label:DELAYED_INVESTIGATION.label,text:`Pending — reveals cards at the start of round ${auction.round+2}.`,dueRound:auction.round+2}};}
export function matureDelayedInformation(auction:Auction,salt=0):Auction{
 const known=new Set(auction.known),priced=new Set(auction.priced);let changed=false;
 const clues=auction.clues.map(clue=>{
  if(clue.id!==DELAYED_INVESTIGATION.id||clue.dueRound!==auction.round||clue.resolvedRound!==undefined)return clue;
  const candidates=auction.lot.map((_,slot)=>slot).filter(slot=>!priced.has(slot)).sort((a,b)=>auction.lot[b].cents-auction.lot[a].cents||a-b).slice(0,5);
  const slots=sampleIndices(candidates.length,2,auction.seed+auction.round*977+salt*191).map(index=>candidates[index]);
  slots.forEach(slot=>{known.add(slot);priced.add(slot)});changed=true;
  return {...clue,resolvedRound:auction.round,text:`Round ${auction.round}: ${slots.length} ${slots.length===1?'card':'cards'} revealed from the top five remaining unpriced cards.`,reveals:slots.map(slot=>({slot,visibility:'price' as const}))};
 });
 return changed?{...auction,known:[...known],priced:[...priced],clues}:auction;
}
export function validDelayedClue(clue:Clue){
 if(clue.id!==DELAYED_INVESTIGATION.id)return clue.dueRound===undefined&&clue.resolvedRound===undefined;
 return clue.id===DELAYED_INVESTIGATION.id&&(clue.round===1||clue.round===2)&&clue.dueRound===clue.round+2&&(clue.resolvedRound===undefined||clue.resolvedRound===clue.dueRound);
}
