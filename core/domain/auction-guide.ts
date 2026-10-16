import {AUCTION_RARITY_TARGETS,AUCTION_PROMO_TARGETS} from './auction-composition.ts';
import type {AuctionKind} from './auction-types.ts';

export const AUCTION_DRAW_LABELS={common:'Common',uncommon:'Uncommon',rare:'Rare',epic:'Epic',alt:'Alt Art',over:'Overnumbered',signature:'Signature',other:'Other / Ordinary Promos',metal:'Metal / Best Of','ultra-promo':'T1 / $1,000+ Promos'} as const;
// Disjoint admission groups: never add the promo budgets on top of "other".
export function auctionGuideTargets(kind:AuctionKind){
 const base=AUCTION_RARITY_TARGETS[kind],promo=AUCTION_PROMO_TARGETS[kind];
 return {common:1-Object.values(base).reduce((sum,n)=>sum+n,0),...base,other:base.other-promo.metal-promo['ultra-promo'],...promo};
}
