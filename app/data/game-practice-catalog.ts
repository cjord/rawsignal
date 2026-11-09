import {requestJson} from './request-json';
import {gameScopeKey,parseGameScope,type GameScope} from '../../core/domain/game-scope';
import {verifyGameCatalogSnapshot,type GameCatalogSnapshot} from '../../core/domain/game-catalog-snapshot';
import {parseGameScopeMetadata} from '../../core/domain/game-scope-metadata';
import type {GameMarket} from '../../core/domain/game-profile';
const pools=new Map<string,{at:number;snapshot:GameCatalogSnapshot}>();
async function read(path:string,signal:AbortSignal){
 const {response,data}=await requestJson(path,{signal,credentials:'omit',cache:'no-store'});
 if(!response.ok)throw new Error((data as {error?:string})?.error??'Game prices are unavailable. Retry the price check.');
 return data;
}
export async function readGameScopeMetadata(market:GameMarket,signal:AbortSignal){
 const data=parseGameScopeMetadata(await read(`/api/games/${market}/catalog?view=scopes`,signal));
 if(data.market!==market)throw new Error('The game catalog belongs to another market.');return data;
}
export async function readGamePracticePool(input:GameScope,signal:AbortSignal){
 const scope=parseGameScope(input),key=gameScopeKey(scope),cached=pools.get(key);
 if(cached&&Date.now()-cached.at<300000)return cached.snapshot;
 const query=new URLSearchParams({eras:JSON.stringify(scope.eras),sets:JSON.stringify(scope.sets)});
 const snapshot=await verifyGameCatalogSnapshot(await read(`/api/games/${scope.market}/catalog?${query}`,signal),scope);
 if(signal.aborted)throw new DOMException('Cancelled','AbortError');
 pools.delete(key);pools.set(key,{at:Date.now(),snapshot});while(pools.size>4)pools.delete(pools.keys().next().value!);
 return snapshot;
}
