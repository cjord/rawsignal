import type {Card} from './types.ts';
import {auctionRandom} from './auction-types.ts';
import {dailyGameSeed,validGameDate} from './daily-game.ts';
import {gameCardEligible,gameScopeIncludes,parseGameScope,pokemonGameEra,POKEMON_GAME_ERAS,type GameScope} from './game-scope.ts';
import {priceGamePool,drawPriceRound,type PriceGameCard,type PriceGameDifficulty} from './price-game.ts';
import {pokemonPriceRoundRules} from './pokemon-game-rarity.ts';
import {unpackGameCatalog,type GameCatalogSnapshot} from './game-catalog-snapshot.ts';
import {validDailyShowdownManifest,validDailyShowdownRun,type DailyShowdownManifestBase,type DailyShowdownProgress} from './showdown-daily.ts';

export type PokemonDailyTheme={kind:'era'|'set';label:string;scope:GameScope};
export type PokemonDailyManifest=DailyShowdownManifestBase&{version:2;market:'pokemon';rulesVersion:1;catalogVersion:string;sourceAsOf:string|null;theme:PokemonDailyTheme};
export type PokemonDailySave=DailyShowdownProgress&{version:2;manifest:PokemonDailyManifest};
export const POKEMON_DAILY_MIN_POOL=60;
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);

export function pokemonDailyTheme(cards:Card[],date:string):PokemonDailyTheme{
 if(!validGameDate(date))throw new Error('Invalid daily date');
 const eras=new Map<string,Card[]>(),sets=new Map<string,Card[]>();
 for(const card of cards){if(!gameCardEligible(card,'pokemon'))continue;const era=pokemonGameEra(card);for(const [map,key]of [[eras,era],[sets,card.set]] as const){const group=map.get(key);if(group)group.push(card);else map.set(key,[card])}}
 const viable=([,group]:[string,Card[]])=>{const pool=priceGamePool(group,'pokemon');return pool.length>=POKEMON_DAILY_MIN_POOL&&drawPriceRound(pool,'hard',[],()=>.5,pokemonPriceRoundRules).length===3};
 const spotlight=Math.floor(Date.parse(date+'T00:00:00Z')/86400000)%7===0;
 const eraGroups=[...eras].filter(([key])=>key!=='unknown'&&key!=='cross-era').filter(viable),setGroups=spotlight?[...sets].filter(viable):[];
 const kind=setGroups.length?'set':'era',groups=kind==='set'?setGroups:eraGroups;groups.sort(([a],[b])=>a<b?-1:a>b?1:0);
 if(!groups.length)throw new Error('No eligible daily theme');
 const random=auctionRandom(dailyGameSeed('pokemon-showdown-theme-v1',date)),key=groups[Math.floor(random()*groups.length)][0];
 return {kind,label:kind==='set'?key:POKEMON_GAME_ERAS.find(era=>era.key===key)!.label,scope:{market:'pokemon',eras:kind==='era'?[key]:[],sets:kind==='set'?[key]:[]}};
}
const identity=(card:PriceGameCard):PriceGameCard=>({productId:card.productId,name:card.name,image:card.image,printing:card.printing,section:card.section,rarity:card.rarity,marketPrice:card.marketPrice,set:card.set,number:card.number,game:'pokemon',year:card.year});
export function createPokemonDailyManifest(snapshot:GameCatalogSnapshot,date:string,theme:PokemonDailyTheme,failed:ReadonlySet<string>=new Set()):PokemonDailyManifest{
 if(snapshot.market!=='pokemon'||JSON.stringify(parseGameScope(theme.scope))!==JSON.stringify(snapshot.scope)||!validGameDate(date))throw new Error('Invalid Pokémon daily catalog');
 const pool=priceGamePool(unpackGameCatalog(snapshot).filter(card=>!failed.has(card.image)),'pokemon'),used=new Set<number>();
 const rounds=(mode:PriceGameDifficulty)=>{
  const random=auctionRandom(dailyGameSeed(`pokemon-showdown-v1-${mode}`,date));
  return Array.from({length:10},()=>{const round=drawPriceRound(pool.filter(card=>!used.has(card.productId)),mode,[],random,pokemonPriceRoundRules);if(round.length!==(mode==='hard'?3:2))throw new Error('Not enough distinct daily cards');for(const card of round)used.add(card.productId);return round.map(identity)});
 };
 return {version:2,market:'pokemon',rulesVersion:1,date,source:snapshot.source,catalogVersion:snapshot.version,sourceAsOf:snapshot.asOf,theme,normal:rounds('normal'),hard:rounds('hard')};
}
export function validPokemonDailyManifest(value:unknown):value is PokemonDailyManifest{
 try{
  if(!object(value)||value.version!==2||value.market!=='pokemon'||value.rulesVersion!==1||typeof value.catalogVersion!=='string'||! /^[a-f0-9]{64}$/.test(value.catalogVersion)||!object(value.theme)||!['era','set'].includes(String(value.theme.kind))||typeof value.theme.label!=='string'||!value.theme.label.trim()||value.theme.label.length>300)return false;
  if(value.sourceAsOf!==null&&(typeof value.sourceAsOf!=='string'||value.sourceAsOf.length>40||!Number.isFinite(Date.parse(value.sourceAsOf))))return false;
  const scope=parseGameScope(value.theme.scope);if(scope.market!=='pokemon'||!validDailyShowdownManifest({...value,version:1}))return false;
  if(value.theme.kind==='era'?(scope.eras.length!==1||scope.sets.length!==0):(scope.sets.length!==1||scope.eras.length!==0))return false;
  const rounds=[...(value.normal as PriceGameCard[][]),...(value.hard as PriceGameCard[][])];
  return new Set(rounds.flat().map(card=>card.productId)).size===50&&rounds.flat().every(card=>card.game==='pokemon'&&typeof card.set==='string'&&card.set.length<=300&&typeof card.number==='string'&&card.number.length<=100&&Number.isInteger(card.year)&&gameScopeIncludes({game:'pokemon',set:card.set,year:card.year!},scope));
 }catch{return false}
}
export const initialPokemonDaily=(manifest:PokemonDailyManifest):PokemonDailySave=>({version:2,revision:0,manifest,normal:{picks:[],cursor:0},hard:{picks:[],cursor:0}});
export function parsePokemonDaily(raw:string):PokemonDailySave{
 if(raw.length>100000)throw new Error('Saved challenge too large');const value=JSON.parse(raw) as PokemonDailySave;
 if(value?.version!==2||!Number.isSafeInteger(value.revision)||value.revision<0||!validPokemonDailyManifest(value.manifest)||!validDailyShowdownRun(value.normal,'normal')||!validDailyShowdownRun(value.hard,'hard'))throw new Error('Invalid Pokémon daily save');return value;
}
