import type {Auction,Investigation} from './auction-types.ts';
import {auctionValueBand} from './auction-value-band.ts';
import {auctionRarityLabel} from './auction-copy-policy.ts';

export function balancedClue(auction:Auction,option:Investigation){
 const base={known:[...auction.known],priced:[...auction.priced]};
 if(option.id==='highest-rarity'){
  const topCardSlot=auction.lot.findIndex(card=>card.cents===Math.max(...auction.lot.map(row=>row.cents)));
  return {...base,rarityKnown:[...new Set([...(auction.rarityKnown??[]),topCardSlot])],topCardSlot,clue:{id:option.id,label:option.label,text:`Top card rarity: ${auctionRarityLabel(auction.lot[topCardSlot])}. Its location is marked; no additional identity or price is revealed.`}};
 }
 let text:string;
 if(option.id==='common-count'||option.id==='uncommon-count'){
  const rarity=option.id==='common-count'?'common':'uncommon';
  text=`${auction.lot.filter(card=>card.rarity.toLowerCase()===rarity).length} ${rarity} copies.`;
 }else if(option.id==='value-band')text=auctionValueBand(auction.lot.reduce((sum,card)=>sum+card.cents,0));
 else return null;
 return {...base,clue:{id:option.id,label:option.label,text}};
}
