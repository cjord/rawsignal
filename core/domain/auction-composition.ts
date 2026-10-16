import {auctionRarityBand} from './auction-copy-policy.ts';
import {AUCTION_LOT_THEMES,auctionThemeProfile} from './auction-lot-themes.ts';
import type {AuctionCard,AuctionKind} from './auction-types.ts';

type RarityBand=ReturnType<typeof auctionRarityBand>;
export type AuctionDrawBand=RarityBand|'metal'|'ultra-promo';
// Sub-budgets of "other", not extra probability or real pack odds. Metal/Best Of
// treatment takes precedence over price; ordinary promos are not price-restricted.
export const AUCTION_PROMO_TARGETS={free:{metal:.0005,'ultra-promo':.0001},paid:{metal:.001,'ultra-promo':.0002}} as const;
export function auctionDrawBand(card:AuctionCard):AuctionDrawBand{
 if(card.section==='metal-promos'||/\((?:metal|best of)\)/i.test(card.name))return 'metal';
 // T1's bundle printings are labelled Showcase by the catalog, not Promo.
 // Every T1 printing shares this budget, including the less expensive ones.
 if(/\bT1\b.*\bWorlds Champion\b/i.test(`${card.set} ${card.name}`)||card.cents>100000&&(/promo/i.test(card.section)||/^promo$/i.test(card.rarity)))return 'ultra-promo';
 return auctionRarityBand(card);
}
// Aggregate gameplay targets across equally likely themes, not real pack pull rates.
// Common is the remainder: extra epics/alt arts replace commons, not uncommons/rares.
export const AUCTION_RARITY_TARGETS={
 free:{uncommon:.2464,rare:.348,epic:.08,alt:.05,over:.0185,signature:.0037,other:.0312},
 paid:{uncommon:.1779,rare:.3044,epic:.12,alt:.08,over:.0412,signature:.005,other:.0475},
} as const;
const mean=(key:'bulk'|'rare')=>AUCTION_LOT_THEMES.reduce((sum,theme)=>sum+theme[key],0)/AUCTION_LOT_THEMES.length;

export function auctionRarityWeights(seed:number,kind:AuctionKind):Record<RarityBand,number>{
 const profile=auctionThemeProfile(seed,kind),scale=kind==='paid'?.8:1;
 const bulkMean=mean('bulk')*scale,rareMean=mean('rare')*scale,premiumMean=1-bulkMean-rareMean;
 const targets=AUCTION_RARITY_TARGETS[kind],premium=(1-profile.bulk-profile.rare)/premiumMean;
 const weights={common:0,uncommon:targets.uncommon*profile.bulk/bulkMean,rare:targets.rare*profile.rare/rareMean,
  epic:targets.epic*premium,alt:targets.alt*premium,over:targets.over*premium,signature:targets.signature*premium,other:targets.other*premium};
 weights.common=Math.max(0,1-Object.values(weights).reduce((sum,value)=>sum+value,0));
 return weights;
}

export function auctionDrawWeights(seed:number,kind:AuctionKind):Record<AuctionDrawBand,number>{
 const weights=auctionRarityWeights(seed,kind),scale=weights.other/AUCTION_RARITY_TARGETS[kind].other,targets=AUCTION_PROMO_TARGETS[kind];
 const metal=targets.metal*scale,ultra=targets['ultra-promo']*scale;
 return {...weights,other:weights.other-metal-ultra,metal,'ultra-promo':ultra};
}

export function chooseAuctionRarity<Band extends string>(available:Band[],weights:Record<Band,number>,random:()=>number):Band{
 const total=available.reduce((sum,band)=>sum+weights[band],0);
 let roll=random()*total;
 for(const band of available){roll-=weights[band];if(roll<0)return band;}
 return available[available.length-1];
}
