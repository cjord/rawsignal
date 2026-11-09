import type {Card} from '../../core/domain/types.ts';
import {pokemonDailyTheme,createPokemonDailyManifest} from '../../core/domain/pokemon-showdown-daily.ts';
import {createGameCatalogSnapshot} from '../../core/domain/game-catalog-snapshot.ts';
export const pokemonDailyCards:Card[]=Array.from({length:180},(_,i)=>({game:'pokemon',productId:970001+i,name:'Pokémon Daily '+i,set:i<60?'SV01: Scarlet & Violet':i<120?'SV04: Paradox Rift':'Base Set',year:i<120?2023:1999,rarity:i<120?'Illustration Rare':'Rare',section:i<120?'illustration-rares':'vintage',printing:'Holofoil',number:(i+1)+'/200',image:`https://tcgplayer-cdn.tcgplayer.com/product/${970001+i}_in_1000x1000.jpg`,url:'',marketPrice:1+i*1.17,lowPrice:null,midPrice:null,highPrice:null,priceChange:null}));
export async function pokemonDailyFixture(date='2026-11-09'){
 const theme=pokemonDailyTheme(pokemonDailyCards,date),snapshot=await createGameCatalogSnapshot(pokemonDailyCards,theme.scope,'database',date,date+'T00:00:00Z');return createPokemonDailyManifest(snapshot,date,theme);
}
