import type {D1DatabaseLike} from './repository.ts';
import {loadDailyGameCatalog} from './game-catalog.ts';
import type {DailyShowdownManifest} from '../core/domain/showdown-daily.ts';
import {dailyGameArtworkCheck,type GameArtworkCheck} from './game-artwork.ts';
import {verifiedDailyShowdown} from './game-lineups.ts';
import {utcGameDate,validGameDate} from '../core/domain/daily-game.ts';

export async function loadDailyShowdownManifest(db:D1DatabaseLike,now=Date.now(),requested?:string,check:GameArtworkCheck=dailyGameArtworkCheck()):Promise<DailyShowdownManifest|null>{
 const today=utcGameDate(now),date=requested??today;if(!validGameDate(date)||date>today)return null;
 const read=()=>db.prepare('select manifest_json json from daily_showdown_manifests where challenge_date=?').bind(date).first<{json:string}>();
 const stored=await read();if(stored)return JSON.parse(stored.json) as DailyShowdownManifest;
 if(date!==today)return null;
 const {catalog,source}=await loadDailyGameCatalog(db),manifest=await verifiedDailyShowdown(catalog,date,source,check);
 await db.prepare('insert into daily_showdown_manifests(challenge_date,manifest_json,created_at) values(?,?,?) on conflict(challenge_date) do nothing').bind(date,JSON.stringify(manifest),new Date(now).toISOString()).run();
 const winner=await read();if(!winner)throw new Error('Daily snapshot unavailable');
 return JSON.parse(winner.json) as DailyShowdownManifest;
}
