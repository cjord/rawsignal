import type {AuctionKind} from './auction-types.ts';
import type {AUCTION_LOT_THEMES} from './auction-lot-themes.ts';
export const AUCTION_LOT_SIZES={free:{min:25,max:90},paid:{min:50,max:130}} as const;
export function auctionThemeSize(kind:AuctionKind,theme:typeof AUCTION_LOT_THEMES[number]){
 const size=AUCTION_LOT_SIZES[kind];
 return {min:theme.id==='store-clearout'?size.min+Math.ceil((size.max-size.min)*.7):size.min,max:size.max};
}
