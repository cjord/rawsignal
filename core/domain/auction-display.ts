import type {Auction,RoundBid} from './auction-types.ts';
import {addInventory,inventoryQuote} from './auction-market.ts';
export function auctionRevealQuote(auction:Auction,visible:number[]){
 const cards=[...new Set(visible)].map(index=>auction.lot[index]);
 const value=cards.reduce((sum,card)=>sum+card.cents,0);
 const proceeds=inventoryQuote(addInventory([],cards),cards,auction.feeBps).net;
 const result=auction.result;
 return {value,fee:value-proceeds,net:proceeds-(result?.bid??0)-(result?.winner==='You'?result.playerExpenses:0)};
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
 const known=new Set(visible);return [...visible,...auction.lot.map((_,index)=>index).filter(index=>!known.has(index))];
}
// Old saves with detailed NPC notes must also expose only information TYPES in the UI.
export function publicAuctionBidNotes(bid:RoundBid){
 if(bid.name==='You')return bid.notes;
 return bid.notes?.map(note=>({id:note.id,label:note.id==='reveal3'?'Public Starting Cards':'Private Inspection',text:note.id==='reveal3'?'Used the publicly revealed starting cards.':'Used personally inspected card information to estimate the collection. Exact identities, prices and estimates remain private.'}));
}
