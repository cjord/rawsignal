import {auctionRandom,holdingKey,type AuctionCard} from './auction-types.ts';

export function auctionRarityBand(card:AuctionCard){
 if(/signature/i.test(card.section))return 'signature';
 if(/over.?number/i.test(card.section))return 'over';
 if(/alt/i.test(card.section))return 'alt';
 const rarity=card.rarity.toLowerCase();
 return rarity==='common'||rarity==='uncommon'||rarity==='rare'||rarity==='epic'?rarity:'other';
}
export function auctionRarityLabel(card:AuctionCard){return {common:'Common',uncommon:'Uncommon',rare:'Rare',epic:'Epic',alt:'Alt Art',over:'Overnumbered',signature:'Signature',other:card.rarity||'Unknown Rarity'}[auctionRarityBand(card)]}

// Per-printing game-generation limits, NOT real pack odds. Three copies is normal;
// extra copies require seeded rarity-scaled gates, each subsequent gate five times rarer.
export function auctionCopyLimit(card:AuctionCard,seed:number,maximum=8){
 let hash=2166136261;for(const char of holdingKey(card))hash=Math.imul(hash^char.charCodeAt(0),16777619);
 const random=auctionRandom(seed^hash),chance={common:.12,uncommon:.08,rare:.03,epic:.01,alt:.003,over:.001,signature:.00025,other:.01}[auctionRarityBand(card)];
 let cap=Math.min(3,maximum);
 while(cap<maximum&&random()<chance*.2**(cap-3))cap++;
 return cap;
}
