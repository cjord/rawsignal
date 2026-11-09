import type {D1DatabaseLike} from './repository.ts';
import {readPracticeGameCatalog} from './practice-game-catalog.ts';
import {createGameCatalogSnapshot} from '../core/domain/game-catalog-snapshot.ts';
import {pokemonDailyTheme,createPokemonDailyManifest,validPokemonDailyManifest,type PokemonDailyManifest} from '../core/domain/pokemon-showdown-daily.ts';
import {utcGameDate,validGameDate} from '../core/domain/daily-game.ts';
import {dailyGameArtworkCheck,failedGameArtwork,type GameArtworkCheck} from './game-artwork.ts';

const inFlight=new WeakMap<D1DatabaseLike,Map<string,Promise<PokemonDailyManifest|null>>>();
async function create(db:D1DatabaseLike,date:string,clock:()=>number,check:GameArtworkCheck,includeGameStock:boolean){
 const read=async()=>{
  const row=await db.prepare("SELECT manifest_json AS json FROM shared_game_manifests WHERE market='pokemon' AND challenge_kind='showdown' AND challenge_date=?").bind(date).first<{json:string}>();
  if(!row)return null;const value:unknown=JSON.parse(row.json);if(!validPokemonDailyManifest(value)||value.date!==date)throw new Error('Archived Pokémon lineup is invalid');return value;
 };
 const stored=await read();if(stored)return stored;if(date!==utcGameDate(clock()))return null;
 const catalog=await readPracticeGameCatalog(db,'pokemon',{includeGameStock}),theme=pokemonDailyTheme(catalog.cards,date);
 const snapshot=await createGameCatalogSnapshot(catalog.cards,theme.scope,catalog.source,catalog.asOf,catalog.publishedAt),failed=new Set<string>();
 let manifest=createPokemonDailyManifest(snapshot,date,theme);
 for(let attempt=0;attempt<8;attempt++){
  const bad=await failedGameArtwork([...manifest.normal.flat(),...manifest.hard.flat()],check);
  if(!bad.size)break;for(const image of bad)failed.add(image);
  if(attempt===7)throw new Error('Not enough verified daily artwork');manifest=createPokemonDailyManifest(snapshot,date,theme,failed);
 }
 if(date!==utcGameDate(clock()))throw new Error('Daily date changed during preparation');
 if(!validPokemonDailyManifest(manifest))throw new Error('Invalid prepared Pokémon lineup');
 await db.prepare("INSERT INTO shared_game_manifests(market,challenge_kind,challenge_date,manifest_json,created_at) VALUES('pokemon','showdown',?,?,?) ON CONFLICT(market,challenge_kind,challenge_date) DO NOTHING").bind(date,JSON.stringify(manifest),new Date(clock()).toISOString()).run();
 const winner=await read();if(!winner)throw new Error('Daily snapshot unavailable');return winner;
}
export async function loadPokemonDailyShowdown(db:D1DatabaseLike,{date,clock=Date.now,check=dailyGameArtworkCheck(),includeGameStock=false}:{date?:string;clock?:()=>number;check?:GameArtworkCheck;includeGameStock?:boolean}={}):Promise<PokemonDailyManifest|null>{
 const today=utcGameDate(clock()),requested=date??today;if(!validGameDate(requested)||requested>today)return null;
 const active=inFlight.get(db)??new Map();inFlight.set(db,active);const prior=active.get(requested);if(prior)return prior;
 const value=create(db,requested,clock,check,includeGameStock);active.set(requested,value);
 try{return await value}finally{if(active.get(requested)===value)active.delete(requested)}
}
