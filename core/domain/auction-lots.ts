import {auctionRandom,holdingKey,type AuctionCard,type AuctionKind} from './auction-types.ts';
import {auctionCopyLimit} from './auction-copy-policy.ts';
import {auctionDrawBand,auctionDrawWeights,chooseAuctionRarity,type AuctionDrawBand} from './auction-composition.ts';
import {AUCTION_LOT_THEMES,auctionLotTheme,auctionThemeProfile,auctionThemeChoices,auctionThemeSet} from './auction-lot-themes.ts';
import {AUCTION_LOT_SIZES,auctionThemeSize} from './auction-lot-size.ts';

export {AUCTION_LOT_SIZES} from './auction-lot-size.ts';
// Gameplay composition weights, NOT pack pull rates or an inferred real collection distribution.
export const AUCTION_LOT_PROFILES=AUCTION_LOT_THEMES.map(theme=>({...theme,...AUCTION_LOT_SIZES.free}));
export function auctionLotProfile(seed:number){const theme=auctionLotTheme(seed);return {...theme,...auctionThemeSize('free',theme)}}
export function generateAuctionLot(catalog:AuctionCard[],seed:number,kind:AuctionKind='free'):AuctionCard[]{
 const pool=[...new Map(catalog.filter(card=>card.image.trim()&&card.cents>0&&Number.isSafeInteger(card.cents)).map(card=>[holdingKey(card),card])).values()].sort((a,b)=>holdingKey(a).localeCompare(holdingKey(b)));
 if(pool.length<6)return [];
 const random=auctionRandom(seed),profile={...auctionThemeProfile(seed,kind),...auctionThemeSize(kind,auctionLotTheme(seed))},focus=auctionThemeSet(pool,seed),weights=auctionDrawWeights(seed,kind);
 const limits=new Map(pool.map(card=>[holdingKey(card),auctionCopyLimit(card,seed,profile.copyCap)])),cap=(card:AuctionCard)=>limits.get(holdingKey(card))!;
 const target=Math.min(profile.min+Math.floor(random()*(profile.max-profile.min+1)),pool.reduce((sum,card)=>sum+cap(card),0));
 if(target<AUCTION_LOT_SIZES[kind].min)return [];
 const bands=Object.keys(weights) as AuctionDrawBand[];
 const stock=new Map(bands.map(band=>[band,pool.filter(card=>auctionDrawBand(card)===band)])),copies=new Map<string,number>(),lot:AuctionCard[]=[];
 for(let slot=0;slot<target;slot++){
  // Premium promo sub-budgets are selected before set focus/repeats, so neither
  // can promote Metal/ultra-promos back into ordinary stock. No price/value cap.
  const available=stock.get(chooseAuctionRarity(bands.filter(band=>stock.get(band)!.length>0),weights,random))!;
  const candidates=auctionThemeChoices(available,focus,profile,random);
  const repeats=candidates.filter(card=>copies.has(holdingKey(card)));
  const choices=repeats.length&&random()<profile.repeat?repeats:candidates;
  const card=choices[Math.floor(random()*choices.length)],key=holdingKey(card);lot.push({...card});copies.set(key,(copies.get(key)??0)+1);
  if(copies.get(key)!>=cap(card))available.splice(available.indexOf(card),1);
 }
 // A shuffled slot order keeps starting reveals from favoring the source's catalog order.
 for(let index=lot.length-1;index>0;index--){const other=Math.floor(random()*(index+1));[lot[index],lot[other]]=[lot[other],lot[index]]}
 return lot.length===target?lot:[];
}
