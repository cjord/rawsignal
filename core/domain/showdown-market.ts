import {GAME_PROFILES,type GameMarket} from './game-profile.ts';
import {initialDailyShowdown,parseDailyShowdown,validDailyShowdownManifest,type DailyShowdownSave,type DailyShowdownManifest} from './showdown-daily.ts';
import {initialPokemonDaily,parsePokemonDaily,validPokemonDailyManifest,type PokemonDailySave,type PokemonDailyManifest} from './pokemon-showdown-daily.ts';
export type MarketDailyManifest=DailyShowdownManifest|PokemonDailyManifest;
export type MarketDailySave=DailyShowdownSave|PokemonDailySave;
export const showdownDailyKey=(market:GameMarket)=>GAME_PROFILES[market].keys.daily;
export const showdownDailyPath=(market:GameMarket)=>market==='pokemon'?'/api/games/pokemon/showdown/daily':'/api/showdown/daily';
export const parseMarketDaily=(market:GameMarket,raw:string):MarketDailySave=>market==='pokemon'?parsePokemonDaily(raw):parseDailyShowdown(raw);
export function validMarketDailyManifest(market:GameMarket,value:unknown):value is MarketDailyManifest{return market==='pokemon'?validPokemonDailyManifest(value):validDailyShowdownManifest(value)}
export const initialMarketDaily=(manifest:MarketDailyManifest):MarketDailySave=>manifest.version===2?initialPokemonDaily(manifest):initialDailyShowdown(manifest);
