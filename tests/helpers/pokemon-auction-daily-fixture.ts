import type {Card} from '../../core/domain/types.ts';
import {createGameCatalogSnapshot} from '../../core/domain/game-catalog-snapshot.ts';
import {createPokemonDailyAuction} from '../../core/domain/pokemon-auction-daily.ts';

export const pokemonAuctionDailyCards:Card[]=[['SV01: Scarlet & Violet',2023],['XY01: XY',2014]].flatMap(([set,year],group)=>Array.from({length:96},(_,i)=>({game:'pokemon' as const,productId:975000+group*100+i,name:`Daily Collector Card ${group*100+i}`,set:String(set),year:Number(year),rarity:['Common','Uncommon','Rare','Ultra Rare'][i%4],section:['pokemon-commons','pokemon-uncommons','pokemon-rares','ultra-rares'][i%4],printing:'Normal',number:String(i),image:`https://tcgplayer-cdn.tcgplayer.com/product/${975000+group*100+i}_in_1000x1000.jpg`,url:'',marketPrice:8+i%12,lowPrice:null,midPrice:null,highPrice:null,priceChange:null})));
export async function pokemonAuctionDailyFixture(date='2026-11-19'){
 const snapshot=await createGameCatalogSnapshot(pokemonAuctionDailyCards,{market:'pokemon',eras:['swsh','sv','me','bw','xy','sm'],sets:[]},'database',date,date+'T00:00:00Z');
 return createPokemonDailyAuction(snapshot,date);
}
