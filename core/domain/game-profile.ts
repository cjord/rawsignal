export const GAME_MARKETS=['riftbound','pokemon'] as const;
export type GameMarket=typeof GAME_MARKETS[number];
export function parseGameMarket(value:unknown):GameMarket{
 if(value==='riftbound'||value==='pokemon')return value;
 throw new RangeError('Unsupported game market.');
}
export const GAME_PROFILES={
 riftbound:{market:'riftbound',label:'Riftbound',pricePath:'/games/riftbound-price',auctionPath:'/games/riftbound-auction',houses:{free:'Bilgewater Auction House',paid:'Piltover Auction House'},keys:{auction:'raw-signal-auction-house-v1',practice:'raw-signal-showdown-practice-v1',daily:'raw-signal-showdown-daily-v1'}},
 pokemon:{market:'pokemon',label:'Pokémon',pricePath:'/games/pokemon-price',auctionPath:'/games/pokemon-auction',houses:{free:'Pewter Auction House',paid:'Celadon Auction House'},keys:{auction:'raw-signal-pokemon-auction-v1',practice:'raw-signal-pokemon-showdown-practice-v1',daily:'raw-signal-pokemon-showdown-daily-v1'}},
} as const;
