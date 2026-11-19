import {unpackGameCatalog,createGameCatalogSnapshot,type GameCatalogSnapshot} from './game-catalog-snapshot.ts';
import {pokemonAuctionCatalog} from './pokemon-auction.ts';
import {POKEMON_AUCTION_CATEGORIES} from './pokemon-auction-houses.ts';
import {generateAuctionLot} from './auction-lots.ts';
import {auctionMarketPrior} from './auction-market-prior.ts';
import {auctionNpcRoster} from './auction-npcs.ts';
import {dailyGameSeed,validGameDate} from './daily-game.ts';
import {validDailyManifest} from './auction-save.ts';
import type {DailyAuctionManifest,AuctionCard} from './auction-types.ts';
import {sampleIndices,holdingKey} from './auction-types.ts';
import {gameCardEligible,gameScopeIncludes} from './game-scope.ts';
import type {Card} from './types.ts';

// At most 400 distinct candidate cards are checked once per new UTC lineup.
// Retain a seeded spread of real stock; broken art never rerolls an entire lot.
export function pokemonDailyAuctionCandidates(cards:Card[],date:string):Card[]{
 if(!validGameDate(date))throw new Error('Invalid Pokémon daily auction date');
 return (['modern','legacy'] as const).flatMap(category=>{
  const scope={market:'pokemon' as const,eras:[...POKEMON_AUCTION_CATEGORIES[category].eras],sets:[]};
  const ordered=cards.filter(card=>gameCardEligible(card,'pokemon')&&gameScopeIncludes(card,scope)).toSorted((a,b)=>holdingKey(a).localeCompare(holdingKey(b)));
  if(ordered.length<25)throw new Error('Not enough cards for the daily category');
  return sampleIndices(ordered.length,Math.min(200,ordered.length),dailyGameSeed(`pokemon-auction-art-v1-${category}`,date)).map(index=>ordered[index]);
 });
}

export function validPokemonDailyAuction(value:unknown):value is DailyAuctionManifest{
 return validDailyManifest(value)&&value.version===2&&value.market==='pokemon';
}
export async function createPokemonDailyAuction(snapshot:GameCatalogSnapshot,date:string):Promise<DailyAuctionManifest>{
 if(snapshot.market!=='pokemon'||!validGameDate(date))throw new Error('Invalid Pokémon daily auction source');
 const cards=unpackGameCatalog(snapshot),scopes=new Map<'modern'|'legacy',{snapshot:GameCatalogSnapshot;catalog:AuctionCard[]}>();
 for(const category of ['modern','legacy'] as const){
  const selected=await createGameCatalogSnapshot(cards,{market:'pokemon',eras:[...POKEMON_AUCTION_CATEGORIES[category].eras],sets:[]},snapshot.source,snapshot.asOf,snapshot.publishedAt);
  const catalog=pokemonAuctionCatalog(unpackGameCatalog(selected));if(catalog.length<25)throw new Error('Not enough cards for the daily category');scopes.set(category,{snapshot:selected,catalog});
 }
 // A shared progression, never gated Vintage: 3 free, then 2 paid. Every visitor
 // sees these same selected pools, exact lots, rivals and source prices today.
 const categories=['modern','modern','legacy','modern','legacy'] as const;
 const auctions=categories.map((category,index)=>{
  const {snapshot:selected,catalog}=scopes.get(category)!,kind=index<3?'free' as const:'paid' as const,seed=dailyGameSeed(`pokemon-auction-v1-${index}`,date),lot=generateAuctionLot(catalog,seed,kind);
  if(lot.length<(index<3?25:50))throw new Error('Not enough eligible daily auction stock');
  return {market:'pokemon' as const,rulesVersion:1 as const,category,scope:selected.scope,catalogVersion:selected.version,seed,kind,lot,marketPrior:auctionMarketPrior(catalog,seed,kind),rivals:auctionNpcRoster(seed).map(npc=>npc.name)};
 });
 const manifest:DailyAuctionManifest={version:2,market:'pokemon',catalogVersion:snapshot.version,date,source:snapshot.asOf??`catalog:${snapshot.version}`,auctions};
 if(!validPokemonDailyAuction(manifest))throw new Error('Invalid prepared Pokémon daily auction');return manifest;
}
