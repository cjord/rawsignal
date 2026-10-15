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
 return card?.rarity?.toLowerCase()??'unknown';
}
export function auctionMetricTone(value:number|null,kind:'signed'|'cost'|'info'='signed'){
 if(value===null||value===0)return '';
 return kind==='cost'?'is-cost':kind==='info'?'is-info':value>0?'is-gain':'is-loss';
}
export function orderedAuctionSlots(auction:Auction,visible:number[]){
 if(auction.stage==='result'&&visible.length===auction.lot.length)return [...visible].sort((a,b)=>auction.lot[b].cents-auction.lot[a].cents||a-b);
 const known=new Set(visible);return [...visible,...auction.lot.map((_,index)=>index).filter(index=>!known.has(index))];
}
// Old saves with detailed NPC notes must also expose only information TYPES in the UI.
export function publicAuctionBidNotes(bid:RoundBid){
 if(bid.name==='You')return bid.notes;
 return bid.notes?.map(note=>{
  const starting=note.id==='public-start'||note.id==='reveal3'&&note.label==='Public Starting Cards';
  const legacy=note.id==='legacy-inspection'||note.label==='Private Inspection';
  return {id:note.id,label:starting?'Shared Public Reveals':legacy?'Card Inspection (Legacy)':INVESTIGATIONS.find(option=>option.id===note.id)?.label??'Investigation Unavailable',text:starting?'Used the shared public cards and prices.':'Used this investigation to estimate the collection. Card identities, prices and findings remain private.'};
 });
}
