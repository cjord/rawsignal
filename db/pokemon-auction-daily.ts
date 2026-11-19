import type {D1DatabaseLike} from './repository.ts';
import {readPracticeGameCatalog} from './practice-game-catalog.ts';
import {createGameCatalogSnapshot} from '../core/domain/game-catalog-snapshot.ts';
import {pokemonAuctionCatalog} from '../core/domain/pokemon-auction.ts';
import {createPokemonDailyAuction,validPokemonDailyAuction} from '../core/domain/pokemon-auction-daily.ts';
import {utcGameDate,validGameDate} from '../core/domain/daily-game.ts';
import {dailyGameArtworkCheck,type GameArtworkCheck} from './game-artwork.ts';
import {verifiedDailyAuction} from './game-lineups.ts';
import type {DailyAuctionManifest} from '../core/domain/auction-types.ts';
const inFlight=new WeakMap<D1DatabaseLike,Map<string,Promise<DailyAuctionManifest|null>>>();
async function create(db:D1DatabaseLike,date:string,clock:()=>number,check:GameArtworkCheck,includeGameStock:boolean){
 const read=async()=>{const row=await db.prepare("SELECT manifest_json AS json FROM shared_game_manifests WHERE market='pokemon' AND challenge_kind='auction' AND challenge_date=?").bind(date).first<{json:string}>();if(!row)return null;const value:unknown=JSON.parse(row.json);if(!validPokemonDailyAuction(value)||value.date!==date)throw new Error('Invalid archived Pokémon auction');return value};
 const stored=await read();if(stored)return stored;if(date!==utcGameDate(clock()))return null;
 const catalog=await readPracticeGameCatalog(db,'pokemon',{includeGameStock});
 const snapshot=await createGameCatalogSnapshot(catalog.cards,{market:'pokemon',eras:['swsh','sv','me','bw','xy','sm'],sets:[]},catalog.source,catalog.asOf,catalog.publishedAt);
 const candidate=await createPokemonDailyAuction(snapshot,date);
 const manifest=await verifiedDailyAuction(pokemonAuctionCatalog(catalog.cards),date,candidate.source,check,candidate);
 if(!validPokemonDailyAuction(manifest)||date!==utcGameDate(clock()))throw new Error('Daily date changed or lineup invalid');
 await db.prepare("INSERT INTO shared_game_manifests(market,challenge_kind,challenge_date,manifest_json,created_at) VALUES('pokemon','auction',?,?,?) ON CONFLICT(market,challenge_kind,challenge_date) DO NOTHING").bind(date,JSON.stringify(manifest),new Date(clock()).toISOString()).run();
 const winner=await read();if(!winner)throw new Error('Daily snapshot unavailable');return winner;
}
export async function loadPokemonDailyAuction(db:D1DatabaseLike,{date,clock=Date.now,check=dailyGameArtworkCheck(),includeGameStock=false}:{date?:string;clock?:()=>number;check?:GameArtworkCheck;includeGameStock?:boolean}={}):Promise<DailyAuctionManifest|null>{
 const today=utcGameDate(clock()),requested=date??today;if(!validGameDate(requested)||requested>today)return null;
 const active=inFlight.get(db)??new Map();inFlight.set(db,active);const prior=active.get(requested);if(prior)return prior;
 const promise=create(db,requested,clock,check,includeGameStock);active.set(requested,promise);
 try{return await promise}finally{if(active.get(requested)===promise)active.delete(requested)}
}
