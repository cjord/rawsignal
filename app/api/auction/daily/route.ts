import {env} from 'cloudflare:workers';
import {loadDailyAuctionManifest} from '../../../../db/auction-daily.ts';
import type {D1DatabaseLike} from '../../../../db/repository.ts';
import {dailyGameResponse} from '../../daily-game-response';

// Historical dates are read-only; only today's absent row can be initialized.
export async function GET(request:Request){
 return dailyGameResponse(request,async date=>{
  const db=env.DB as unknown as D1DatabaseLike|undefined;if(!db)throw new Error('Database unavailable');
  return loadDailyAuctionManifest(db,Date.now(),date);
 });
}
