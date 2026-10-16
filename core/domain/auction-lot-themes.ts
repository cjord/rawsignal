import {auctionRandom,type AuctionCard,type AuctionKind} from './auction-types.ts';

// Game-generation themes, not real deck lists, pull rates or guaranteed contents.
export const AUCTION_LOT_THEMES=[
 {id:'bulk-seller',name:'Bulk Seller',collectionName:"Bulk Seller's Collection",description:'A stock clear-out leaning toward commons and uncommons, with occasional higher-rarity cards.',bulk:.85,rare:.13,repeat:.65,copyCap:8,setFocus:0},
 {id:'deck-builder',name:'Deck Builder',collectionName:"Deck Builder's Collection",description:'A player-style collection favoring regular rares and repeated copies. Not a verified competitive deck.',bulk:.42,rare:.5,repeat:.65,copyCap:4,setFocus:.65},
 {id:'trade-binder',name:'Trade Binder',collectionName:'Trade Binder Collection',description:'A varied mix of everyday cards, regular rares and a few premium treatments.',bulk:.6,rare:.3,repeat:.25,copyCap:4,setFocus:0},
 {id:'set-collector',name:'Set Collector',collectionName:"Set Collector's Collection",description:'A broad binder leaning toward one expansion and fewer repeated printings.',bulk:.38,rare:.42,repeat:.08,copyCap:3,setFocus:.85},
 {id:'chase-collector',name:'Chase Collector',collectionName:"Chase Collector's Collection",description:'A showcase-style binder with a stronger premium-treatment bias. Valuable hits are not guaranteed.',bulk:.25,rare:.4,repeat:.12,copyCap:3,setFocus:0},
 {id:'store-clearout',name:'Store Clear-Out',collectionName:"Store Clear-Out Collection",description:'A larger stockroom clear-out with everyday inventory, regular rares and occasional premium surprises.',bulk:.68,rare:.25,repeat:.45,copyCap:8,setFocus:.15},
 {id:'curated-binder',name:'Curated Binder',collectionName:"Curated Binder Collection",description:'A carefully varied binder spanning expansions, with at most two copies of a printing and a premium-treatment lean.',bulk:.35,rare:.4,repeat:.02,copyCap:2,setFocus:0},
] as const;
export function auctionLotTheme(seed:number){const random=auctionRandom(seed+401);random();random();return AUCTION_LOT_THEMES[Math.floor(random()*AUCTION_LOT_THEMES.length)]}
export function auctionThemeProfile(seed:number,kind:AuctionKind){
 const theme=auctionLotTheme(seed);
 // Paid themes reduce bulk/rare factors; auction-composition calibrates the final
 // rarity mix while these relative factors preserve each collection's identity.
 return {...theme,bulk:theme.bulk*(kind==='paid'?.8:1),rare:theme.rare*(kind==='paid'?.8:1)};
}
export function auctionThemeChoices(choices:AuctionCard[],focus:string,profile:ReturnType<typeof auctionThemeProfile>,random:()=>number){
 const focused=choices.filter(card=>card.set===focus);
 return focused.length&&random()<profile.setFocus?focused:choices;
}
export function auctionThemeSet(pool:AuctionCard[],seed:number){
 const counts=new Map<string,number>();
 for(const card of pool)counts.set(card.set,(counts.get(card.set)??0)+1);
 const sets=[...counts].filter(([,count])=>count>=12).map(([set])=>set).sort();
 return sets.length?sets[Math.floor(auctionRandom(seed+613)()*sets.length)]:'';
}
