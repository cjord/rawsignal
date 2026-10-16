import {env} from 'cloudflare:workers';
import {dailyGameResponse} from '../../daily-game-response';
import {loadDailyShowdownManifest} from '../../../../db/showdown-daily.ts';
import type {D1DatabaseLike} from '../../../../db/repository.ts';
export async function GET(request:Request){
 return dailyGameResponse(request,async date=>{
  const db=env.DB as unknown as D1DatabaseLike|undefined;if(!db)throw new Error('Database unavailable');
  return loadDailyShowdownManifest(db,Date.now(),date);
 });
}
