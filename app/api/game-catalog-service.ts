import type {D1DatabaseLike} from '../../db/repository.ts';
import {readPracticeGameCatalog,type PracticeCatalog} from '../../db/practice-game-catalog.ts';
import {allowedRarities} from '../../core/market-state.ts';
import {parseCards} from '../../core/domain/contracts.ts';
import {gameCardEligible,gameScopeKey,parseGameScope,pokemonGameEra,type GameScope} from '../../core/domain/game-scope.ts';
import {parseGameMarket,type GameMarket} from '../../core/domain/game-profile.ts';
import {createGameCatalogSnapshot,type GameCatalogSnapshot} from '../../core/domain/game-catalog-snapshot.ts';
import type {GameScopeMetadata} from '../../core/domain/game-scope-metadata.ts';

export type PracticeCatalogEnv={DB?:D1DatabaseLike;ASSETS?:{fetch:(request:Request)=>Promise<Response>};POKEMON_GAME_CATALOG_ENABLED?:string};
const cache=new WeakMap<object,Map<string,{expires:number;value:Promise<PracticeCatalog>}>>();
// One prepared scope per short-lived base catalog: repeated starts coalesce without
// retaining an unbounded set of user-selected combinations in the Worker isolate.
const prepared=new WeakMap<PracticeCatalog,{scope:string;value:Promise<GameCatalogSnapshot>}>();
const metadata=new WeakMap<PracticeCatalog,GameScopeMetadata>();
function preparePool(catalog:PracticeCatalog,scope:GameScope){
 const key=gameScopeKey(scope),previous=prepared.get(catalog);if(previous?.scope===key)return previous.value;
 const value=createGameCatalogSnapshot(catalog.cards,scope,catalog.source,catalog.asOf,catalog.publishedAt);
 prepared.set(catalog,{scope:key,value});void value.catch(()=>{if(prepared.get(catalog)?.value===value)prepared.delete(catalog)});return value;
}
async function readFallback(request:Request,env:PracticeCatalogEnv,market:GameMarket):Promise<PracticeCatalog>{
 if(!env.ASSETS)throw new Error('Game catalog unavailable.');
 const sources=allowedRarities[market].filter(section=>section!=='japanese-promos');
 const groups=await Promise.all(sources.map(async section=>{
  const response=await env.ASSETS!.fetch(new Request(new URL(`/data/${section}.json`,request.url)));
  if(!response.ok)throw new Error('The bundled game catalog is incomplete.');
  return parseCards(await response.json());
 }));
 const cards=[...new Map(groups.flat().filter(card=>card.game===market).map(card=>[`${card.productId}:${card.printing}`,card])).values()];
 return {cards,source:'feed',asOf:null,publishedAt:null,bulkReady:false};
}
async function load(request:Request,env:PracticeCatalogEnv,market:GameMarket,now:number){
 const key=env.DB??env.ASSETS;if(!key)throw new Error('Game catalog unavailable.');
 const includeGameStock=env.POKEMON_GAME_CATALOG_ENABLED==='true',cacheKey=`${market}:${includeGameStock}`;
 const markets=cache.get(key)??new Map();cache.set(key,markets);const old=markets.get(cacheKey);
 if(old&&old.expires>now)return old.value;
 const value=(async()=>{if(env.DB){try{return await readPracticeGameCatalog(env.DB,market,{includeGameStock})}catch{/* A feed fallback remains explicitly dated as unavailable. */}}return readFallback(request,env,market)})();
 markets.set(cacheKey,{expires:now+60000,value});
 void value.catch(()=>{if(markets.get(cacheKey)?.value===value)markets.delete(cacheKey)});
 return value;
}
export function practiceCatalogQuery(url:URL,market:GameMarket){
 const keys=[...url.searchParams.keys()];
 if(keys.some(key=>!['view','eras','sets'].includes(key))||new Set(keys).size!==keys.length)throw new RangeError('Invalid game catalog query.');
 const view=url.searchParams.get('view')??'pool';if(!['pool','scopes'].includes(view))throw new RangeError('Invalid game catalog view.');
 const list=(key:string)=>{const raw=url.searchParams.get(key);if(!raw)return [];if(raw.length>16000)throw new RangeError('Game pool selection too large.');try{return JSON.parse(raw)}catch{throw new RangeError('Invalid game pool selection.')}};
 const scope=parseGameScope({market,eras:list('eras'),sets:list('sets')});
 if(view==='scopes'&&(scope.eras.length||scope.sets.length))throw new RangeError('Scope metadata cannot be filtered.');
 return {view,scope};
}
function scopeMetadata(catalog:PracticeCatalog,market:GameMarket){
 const cached=metadata.get(catalog);if(cached)return cached;
 const sets=new Map<string,{name:string;era:string;count:number}>();
 for(const card of catalog.cards){if(!gameCardEligible(card,market))continue;const era=market==='pokemon'?pokemonGameEra(card):'',key=`${era}:${card.set}`,row=sets.get(key)??{name:card.set,era,count:0};row.count++;sets.set(key,row)}
 const result={market,source:catalog.source,asOf:catalog.asOf,publishedAt:catalog.publishedAt,bulkReady:catalog.bulkReady,sets:[...sets.values()].sort((a,b)=>a.name.localeCompare(b.name))};
 metadata.set(catalog,result);return result;
}
export async function handlePracticeGameCatalog(request:Request,env:PracticeCatalogEnv,marketValue:unknown,now=Date.now()){
 const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 if(request.method!=='GET')return json({error:'Method not allowed.'},405);
 try{
  const market=parseGameMarket(marketValue),{view,scope}=practiceCatalogQuery(new URL(request.url),market),catalog=await load(request,env,market,now);
  return json(view==='scopes'?scopeMetadata(catalog,market):await preparePool(catalog,scope));
 }catch(cause){return cause instanceof RangeError?json({error:cause.message},400):json({error:'Game prices are temporarily unavailable. Please retry.'},503)}
}
