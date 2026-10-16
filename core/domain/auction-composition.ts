import {auctionRarityBand} from './auction-copy-policy.ts';
import {AUCTION_LOT_THEMES,auctionThemeProfile} from './auction-lot-themes.ts';
import type {AuctionKind} from './auction-types.ts';

type RarityBand=ReturnType<typeof auctionRarityBand>;
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

export function chooseAuctionRarity(available:RarityBand[],weights:Record<RarityBand,number>,random:()=>number):RarityBand{
 const total=available.reduce((sum,band)=>sum+weights[band],0);
 let roll=random()*total;
 for(const band of available){roll-=weights[band];if(roll<0)return band;}
 return available[available.length-1];
}
