import type {Auction,RoundBid} from './auction-types.ts';
import {addInventory,inventoryQuote} from './auction-market.ts';
import {INVESTIGATIONS} from './auction-information.ts';
export function auctionRevealQuote(auction:Auction,visible:number[]){
 const cards=[...new Set(visible)].map(index=>auction.lot[index]);
 const value=cards.reduce((sum,card)=>sum+card.cents,0);
 const proceeds=inventoryQuote(addInventory([],cards),cards,auction.feeBps).net;
 const result=auction.result;
 return {value,fee:value-proceeds,net:proceeds-(result?.bid??0)-(result?.winner==='You'?result.playerExpenses+(auction.entryFee??0):0)};
}
export function auctionRarity(card:{rarity?:string;section?:string}|null|undefined){
 if(/signature|over.?number/i.test(card?.section??''))return 'premium';
 if(/alt/i.test(card?.section??''))return 'epic';
 if(/promo/i.test(card?.section??'')||/^(promo|showcase)$/i.test(card?.rarity??''))return 'promo';
 return card?.rarity?.toLowerCase()??'unknown';
}
export function auctionMetricTone(value:number|null,kind:'signed'|'cost'|'info'='signed'){
 if(value===null||value===0)return '';
 return kind==='cost'?'is-cost':kind==='info'?'is-info':value>0?'is-gain':'is-loss';
}
export function orderedAuctionSlots(auction:Auction,visible:number[]){
 if(auction.stage==='result'&&visible.length===auction.lot.length)return [...visible].sort((a,b)=>auction.lot[b].cents-auction.lot[a].cents||a-b);
 const known=new Set(visible),hidden=auction.lot.map((_,index)=>index).filter(index=>!known.has(index));
 return [...visible,...hidden.filter(index=>auction.rarityKnown?.includes(index)),...hidden.filter(index=>!auction.rarityKnown?.includes(index))];
}
export const AUCTION_VALUE_EFFECTS={foil:5000,glow:25000} as const;
export function auctionValueEffect(cents:number,priceVisible:boolean){
 if(!priceVisible||!Number.isSafeInteger(cents)||cents<AUCTION_VALUE_EFFECTS.foil)return undefined;
 return cents>=AUCTION_VALUE_EFFECTS.glow?'glow':'foil';
}
// Detailed NPC notes, including older saves, stay private until final review.
export function publicAuctionBidNotes(bid:RoundBid,settled=false){
 if(bid.name==='You')return bid.notes;
 return bid.notes?.filter(note=>note.id!=='public-start'&&!(note.id==='reveal3'&&['Public Starting Cards','Shared Public Reveals'].includes(note.label))).map(note=>{
  if(settled)return note;
  const starting=note.id==='public-start'||note.id==='reveal3'&&note.label==='Public Starting Cards';
  const legacy=note.id==='legacy-inspection'||note.label==='Private Inspection';
  return {id:note.id,label:starting?'Shared Public Reveals':legacy?'Card Inspection (Legacy)':INVESTIGATIONS.find(option=>option.id===note.id)?.label??'Investigation Unavailable',text:starting?'Used the shared public cards and prices.':'Used this investigation to estimate the collection. Card identities, prices and findings remain private.'};
 });
}
// Older player history snapshots stored every clue so far. Preserve saves while
// displaying only this round's facts; untagged legacy clues use first appearance.
export function auctionRoundBid(auction:Auction,bid:RoundBid,round:number):RoundBid{
 const earlier=new Set(auction.bidHistory.slice(0,round-1).flatMap(bids=>bids.find(row=>row.name===bid.name)?.notes?.map(note=>note.id)??[]));
 const facts=bid.name==='You'?auction.clues:auction.npcs?.find(npc=>npc.name===bid.name)?.findings;
 const notes=bid.notes?.filter(note=>note.round===undefined?!earlier.has(note.id):note.round===round).map(note=>note.id==='delayed-gratification'&&(bid.name==='You'||auction.stage==='result')?facts?.find(clue=>clue.id===note.id&&clue.round===note.round)??note:note);
 return {...bid,notes};
}
export function auctionKnownSaleValue(auction:Auction,visible:number[]=[]){
 const slots=auction.stage==='result'?visible:auction.priced,groups=new Map<string,number>();
 for(const slot of slots){const card=auction.lot[slot],key=`${card.productId}:${card.printing}`;groups.set(key,(groups.get(key)??0)+card.cents)}
 return [...groups.values()].reduce((sum,gross)=>sum+gross-Math.round(gross*auction.feeBps/10000),0);
}
