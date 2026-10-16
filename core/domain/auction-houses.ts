import type {AuctionKind} from './auction-types.ts';
export const AUCTION_HOUSE_NAMES={free:'Bilgewater Auction House',paid:'Piltover Auction House'} as const;
export const auctionHouseName=(kind:AuctionKind='free')=>AUCTION_HOUSE_NAMES[kind];
