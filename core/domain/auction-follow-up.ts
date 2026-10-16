import {auctionRandom,type Auction,type AuctionSave,type Investigation} from './auction-types.ts';
import {followUpSlots} from './auction-investigations-v2.ts';

export function pendingInspectionResult(auction:Auction,option:Investigation){
 return {known:auction.known,priced:auction.priced,pendingFollowUp:true as const,clue:{id:option.id,label:option.label,text:'Awaiting your card selection.'}};
}
function finishInspection(auction:Auction,slot:number):Auction{
 const next={...auction};delete next.pendingFollowUp;
 return {...next,known:[...new Set([...auction.known,slot])],priced:[...new Set([...auction.priced,slot])],clues:auction.clues.map(clue=>clue.id==='follow-up-v4'&&clue.round===auction.round?{...clue,text:'1 previously marked card revealed with its price.',reveals:[{slot,visibility:'price'}]}:clue)};
}
export function selectFollowUp(save:AuctionSave,slot:number,now:number):AuctionSave{
 const auction=save.auction;
 if(!auction?.pendingFollowUp||auction.stage!=='round'||now>=auction.deadline||!followUpSlots(auction).includes(slot))return save;
 return {...save,auction:finishInspection(auction,slot)};
}
export function settlePendingFollowUp(auction:Auction):Auction{
 if(!auction.pendingFollowUp)return auction;
 const slots=followUpSlots(auction),slot=slots[Math.floor(auctionRandom(auction.seed+auction.round*431)()*slots.length)];
 if(slot!==undefined)return finishInspection(auction,slot);
 const next={...auction};delete next.pendingFollowUp;return next;
}
