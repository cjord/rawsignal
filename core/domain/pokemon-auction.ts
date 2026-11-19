import type {Card} from './types.ts';
import type {AuctionCard,AuctionKind} from './auction-types.ts';
import {holdingKey,sampleIndices} from './auction-types.ts';
import {gameCardEligible} from './game-scope.ts';
import {POKEMON_AUCTION_WEIGHTS,POKEMON_VINTAGE_WEIGHTS} from './pokemon-auction-rarity.ts';
import {auctionThemeProfile} from './auction-lot-themes.ts';
import type {AuctionDrawBand} from './auction-composition.ts';
import {GAME_PROFILES} from './game-profile.ts';
import {pokemonVintagePool} from './pokemon-auction-houses.ts';

export const POKEMON_AUCTION_STORAGE_KEY=GAME_PROFILES.pokemon.keys.auction;
export const POKEMON_AUCTION_RULES_VERSION=1;
export function pokemonAuctionCatalog(cards:Card[]):AuctionCard[]{
 return [...new Map(cards.filter(card=>gameCardEligible(card,'pokemon')).map(card=>[holdingKey(card),{
  productId:card.productId,printing:card.printing,name:card.name,image:card.image,set:card.set,rarity:card.rarity,section:card.section,cents:Math.round(card.marketPrice!*100),market:'pokemon' as const,number:card.number,year:card.year,
 }])).values()];
}
export function pokemonAuctionDrawWeights(seed:number,kind:AuctionKind,vintage=false):Record<AuctionDrawBand,number>{
 const base=vintage?POKEMON_VINTAGE_WEIGHTS:POKEMON_AUCTION_WEIGHTS[kind],theme=auctionThemeProfile(seed,kind);
 const weights={...base,common:base.common*theme.bulk/.5,uncommon:base.uncommon*theme.bulk/.5,rare:base.rare*theme.rare/.35,metal:0,'ultra-promo':0};
 const premium=Math.max(.1,(1-theme.bulk-theme.rare)/.15);
 for(const band of ['epic','alt','over','signature','other'] as const)weights[band]*=premium;
 return weights;
}
export const pokemonPoolWeights=(catalog:AuctionCard[],seed:number,kind:AuctionKind)=>pokemonAuctionDrawWeights(seed,kind,pokemonVintagePool(catalog));
// Freeze a small, reproducible preparation pool, never a 5 MB catalog in a save.
// Actual price observations and exact printings are retained, not fabricated.
export function pokemonAuctionPreparationPool(catalog:AuctionCard[],seed:number){
 const ordered=catalog.filter(card=>card.market==='pokemon').toSorted((a,b)=>holdingKey(a).localeCompare(holdingKey(b)));
 return sampleIndices(ordered.length,Math.min(600,ordered.length),seed+2731).map(index=>({...ordered[index]}));
}
