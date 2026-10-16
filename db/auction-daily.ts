import type {D1DatabaseLike} from './repository.ts';
import {dailyAuctionDate} from '../core/domain/auction-daily.ts';
import {dailyGameArtworkCheck,type GameArtworkCheck} from './game-artwork.ts';
import {verifiedDailyAuction} from './game-lineups.ts';
import type {DailyAuctionManifest} from '../core/domain/auction-types.ts';
import {validGameDate} from '../core/domain/daily-game.ts';
import {loadDailyGameCatalog} from './game-catalog.ts';

export async function loadDailyAuctionManifest(db:D1DatabaseLike,now=Date.now(),requested?:string,check:GameArtworkCheck=dailyGameArtworkCheck()):Promise<DailyAuctionManifest|null>{
 const today=dailyAuctionDate(now),date=requested??today;if(!validGameDate(date)||date>today)return null;
 const stored=await db.prepare('select manifest_json json from daily_auction_manifests where challenge_date=?').bind(date).first<{json:string}>();
 if(stored)return JSON.parse(stored.json) as DailyAuctionManifest;
 if(date!==today)return null;
 const {catalog,source}=await loadDailyGameCatalog(db),manifest=await verifiedDailyAuction(catalog,date,source,check);
 await db.prepare('insert into daily_auction_manifests(challenge_date,manifest_json,created_at) values(?,?,?) on conflict(challenge_date) do nothing').bind(date,JSON.stringify(manifest),new Date(now).toISOString()).run();
 // Concurrent first visitors must all receive the row that won the insert.
 const winner=await db.prepare('select manifest_json json from daily_auction_manifests where challenge_date=?').bind(date).first<{json:string}>();
 if(!winner)throw new Error('Daily snapshot unavailable');
 return JSON.parse(winner.json) as DailyAuctionManifest;
}
