import {env} from 'cloudflare:workers';
import {dailyGameResponse} from '../../../../daily-game-response';
import {loadPokemonDailyShowdown} from '../../../../../../db/pokemon-showdown-daily.ts';
import type {D1DatabaseLike} from '../../../../../../db/repository.ts';
export async function GET(request:Request){
 return dailyGameResponse(request,async date=>{
  const options=env as unknown as {DB?:D1DatabaseLike;POKEMON_GAME_CATALOG_ENABLED?:string};if(!options.DB)throw new Error('Database unavailable');
  return loadPokemonDailyShowdown(options.DB,{date,includeGameStock:options.POKEMON_GAME_CATALOG_ENABLED==='true'});
 });
}
