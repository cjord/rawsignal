import type {AuctionCard,AuctionKind} from './auction-types.ts';
import type {GameScope} from './game-scope.ts';
import {pokemonGameEra} from './game-scope.ts';

export const POKEMON_AUCTION_CATEGORIES={
 modern:{label:'Modern',eras:['swsh','sv','me']},
 legacy:{label:'Legacy',eras:['bw','xy','sm']},
 vintage:{label:'Vintage',eras:['wotc','ex','dp']},
} as const;
export type PokemonAuctionCategory=keyof typeof POKEMON_AUCTION_CATEGORIES;
export const POKEMON_VINTAGE_ENTRY=20000;
export const POKEMON_VINTAGE_UNLOCK=1000000;
export const POKEMON_VINTAGE_SIZE={min:25,max:55};
export function pokemonAuctionCategory(scope:GameScope):PokemonAuctionCategory|null{
 if(scope.market!=='pokemon'||!scope.eras.length)return null;
 return (Object.keys(POKEMON_AUCTION_CATEGORIES) as PokemonAuctionCategory[]).find(key=>scope.eras.every(era=>(POKEMON_AUCTION_CATEGORIES[key].eras as readonly string[]).includes(era)))??null;
}
export function pokemonVintagePool(catalog:AuctionCard[]){return catalog.length>0&&catalog.every(card=>card.market==='pokemon'&&POKEMON_AUCTION_CATEGORIES.vintage.eras.some(era=>era===pokemonGameEra({set:card.set,year:card.year??0})));}
export const pokemonEntryFee=(kind:AuctionKind,category?:PokemonAuctionCategory)=>category==='vintage'?POKEMON_VINTAGE_ENTRY:kind==='paid'?5000:0;
