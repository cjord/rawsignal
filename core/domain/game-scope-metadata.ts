import {POKEMON_GAME_ERAS} from './game-scope.ts';
import {parseGameMarket,type GameMarket} from './game-profile.ts';
export type GameScopeMetadata={market:GameMarket;source:'database'|'feed';asOf:string|null;publishedAt:string|null;bulkReady:boolean;sets:{name:string;era:string;count:number}[]};
export function parseGameScopeMetadata(value:unknown):GameScopeMetadata{
 if(!value||typeof value!=='object')throw new Error('Invalid game pool metadata.');
 const row=value as GameScopeMetadata,market=parseGameMarket(row.market);
 const date=(v:unknown)=>v===null||typeof v==='string'&&v.length<=40&&Number.isFinite(Date.parse(v));
 if(!['database','feed'].includes(row.source)||!date(row.asOf)||!date(row.publishedAt)||typeof row.bulkReady!=='boolean'||!Array.isArray(row.sets)||row.sets.length>5000)throw new Error('Invalid game pool metadata.');
 const sets=row.sets.map(set=>{
  if(!set||typeof set.name!=='string'||!set.name.trim()||set.name.length>300||!Number.isSafeInteger(set.count)||set.count<1||set.count>50000||(market==='pokemon'?!POKEMON_GAME_ERAS.some(era=>era.key===set.era):set.era!==''))throw new Error('Invalid game set metadata.');
  return {name:set.name,era:set.era,count:set.count};
 });
 if(new Set(sets.map(set=>set.name)).size!==sets.length)throw new Error('Conflicting game set metadata.');
 return {market,source:row.source,asOf:row.asOf,publishedAt:row.publishedAt,bulkReady:row.bulkReady,sets};
}
