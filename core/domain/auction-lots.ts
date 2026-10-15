import {auctionRandom,holdingKey,type AuctionCard,type AuctionKind} from './auction-types.ts';

// Gameplay composition weights, NOT pack pull rates or an inferred real collection distribution.
export const AUCTION_LOT_PROFILES=[
 {name:'Casual Binder',min:36,max:60,bulk:.65,rare:.28,repeat:.35,copyCap:4},
 {name:'Player Collection',min:48,max:84,bulk:.48,rare:.42,repeat:.48,copyCap:4},
 {name:'Collector Binder',min:24,max:48,bulk:.25,rare:.45,repeat:.18,copyCap:3},
 {name:'Bulk Box',min:80,max:120,bulk:.85,rare:.13,repeat:.65,copyCap:8},
] as const;
export function auctionLotProfile(seed:number){const random=auctionRandom(seed+401);random();random();return AUCTION_LOT_PROFILES[Math.floor(random()*AUCTION_LOT_PROFILES.length)]}
function cardTier(card:AuctionCard){
 if(/alt|signature|over.?number/i.test(card.section))return 2;
 return /^(common|uncommon)$/i.test(card.rarity)?0:/^rare$/i.test(card.rarity)?1:2;
}
export const PAID_AUCTION_PROFILE={name:'Premium Collection',min:128,max:160,bulk:.25,rare:.45,repeat:.35,copyCap:8};
function minimumLotBudget(cheapest:AuctionCard[],copies:Map<string,number>,needed:number,cap:number){
 let value=0,ceiling=0;
 for(const card of cheapest){const take=Math.min(needed,cap-(copies.get(holdingKey(card))??0));value+=take*card.cents;if(take)ceiling=card.cents;needed-=take;if(!needed)break}
 return {value:needed?Infinity:value,ceiling};
}
export function generateAuctionLot(catalog:AuctionCard[],seed:number,kind:AuctionKind='free'):AuctionCard[]{
 const pool=[...new Map(catalog.filter(card=>card.image.trim()&&card.cents>0&&Number.isSafeInteger(card.cents)).map(card=>[holdingKey(card),card])).values()].sort((a,b)=>holdingKey(a).localeCompare(holdingKey(b)));
 if(pool.length<6)return [];
 const random=auctionRandom(seed),profile=kind==='paid'?PAID_AUCTION_PROFILE:auctionLotProfile(seed),target=profile.min+Math.floor(random()*(profile.max-profile.min+1));
 const tiers=[0,1,2].map(tier=>pool.filter(card=>cardTier(card)===tier)),copies=new Map<string,number>(),lot:AuctionCard[]=[],cheapestPool=[...pool].sort((a,b)=>a.cents-b.cents);
 const cheapest=Math.min(...pool.map(card=>card.cents));let value=0;
 for(let slot=0;slot<target;slot++){
  const roll=random(),tier=roll<profile.bulk?0:roll<profile.bulk+profile.rare?1:2;
  const floor=kind==='paid'?minimumLotBudget(cheapestPool,copies,target-slot,profile.copyCap):null;
  // Replacing the most expensive reserved copy keeps enough real stock/budget for every remaining slot.
  const remaining=floor?200000-value-floor.value+floor.ceiling:200000-value-cheapest*(target-slot-1);
  const eligible=(card:AuctionCard)=>(copies.get(holdingKey(card))??0)<profile.copyCap&&card.cents<=remaining;
  const candidates=(tiers[tier].length?tiers[tier]:pool).filter(eligible);
  const repeats=candidates.filter(card=>copies.has(holdingKey(card)));
  const choices=repeats.length&&random()<profile.repeat?repeats:candidates;
  if(!choices.length){const fallback=pool.filter(eligible);if(!fallback.length)break;choices.push(...fallback)}
  const card=choices[Math.floor(random()*choices.length)];lot.push({...card});value+=card.cents;copies.set(holdingKey(card),(copies.get(holdingKey(card))??0)+1);
 }
 // A shuffled slot order keeps starting reveals from favoring the source's catalog order.
 for(let index=lot.length-1;index>0;index--){const other=Math.floor(random()*(index+1));[lot[index],lot[other]]=[lot[other],lot[index]]}
 return lot.length>=6?lot:[];
}
