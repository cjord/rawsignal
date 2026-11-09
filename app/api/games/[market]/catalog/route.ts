import {env} from 'cloudflare:workers';
import {handlePracticeGameCatalog,type PracticeCatalogEnv} from '../../../game-catalog-service';
export async function GET(request:Request,{params}:{params:Promise<{market:string}>}){
 const {market}=await params;return handlePracticeGameCatalog(request,env as unknown as PracticeCatalogEnv,market);
}
