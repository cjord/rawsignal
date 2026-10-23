import {auctionCatalogCacheEnabled} from '../../core/domain/auction-catalog-snapshot.ts';
// Server-only caller; no database read or private account state.
export async function auctionCatalogFeature(){
 try{const {env}=await import('cloudflare:workers');return auctionCatalogCacheEnabled(env as Parameters<typeof auctionCatalogCacheEnabled>[0])}catch{return false}
}
