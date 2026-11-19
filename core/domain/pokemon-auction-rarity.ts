import type {AuctionCard,AuctionKind} from './auction-types.ts';
import {pokemonGameRarity} from './pokemon-game-rarity.ts';

// Internal effect cohorts reuse the existing eight-band engine. Display the
// original Pokémon rarity; these aliases are never claims about pack odds.
export type PokemonAuctionBand='common'|'uncommon'|'rare'|'epic'|'alt'|'over'|'signature'|'other';
export function pokemonAuctionBand(card:AuctionCard):PokemonAuctionBand{
 const rarity=pokemonGameRarity({...card,number:card.number??''});
 if(rarity==='common'||rarity==='uncommon'||rarity==='rare')return rarity;
 if(rarity==='holo')return 'epic';
 if(rarity==='double'||rarity==='ultra')return 'alt';
 if(rarity==='illustration'||rarity==='gallery'||rarity==='shiny-radiant')return 'over';
 if(['special-illustration','alternate-art','secret'].includes(rarity))return 'signature';
 return 'other';
}
export const POKEMON_AUCTION_COHORTS={common:'Common',uncommon:'Uncommon',rare:'Rare',epic:'Holo Rare',alt:'Double / Ultra Rare',over:'Illustration / Gallery / Shiny',signature:'Special Illustration / Alternate Art / Secret',other:'Promo / Other'} as const;
// Starting gameplay mix, renormalized over cohorts actually present in the
// selected scope. No prices or hidden generated cards determine these weights.
export const POKEMON_AUCTION_WEIGHTS:Record<AuctionKind,Record<PokemonAuctionBand,number>>={
 free:{common:.24,uncommon:.23,rare:.22,epic:.12,alt:.10,over:.055,signature:.02,other:.015},
 paid:{common:.14,uncommon:.17,rare:.20,epic:.14,alt:.17,over:.10,signature:.055,other:.025},
};
export function pokemonAuctionCopyChance(card:AuctionCard){
 return {common:.1,uncommon:.06,rare:.025,epic:.01,alt:.004,over:.001,signature:.00025,other:.002}[pokemonAuctionBand(card)];
}
