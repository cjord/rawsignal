import type {D1DatabaseLike} from './repository.ts';
import {readyCatalogRun} from './readiness.ts';
import type {Card} from '../core/domain/types.ts';
import {withRiftboundRegularArtwork} from '../core/domain/riftbound-artwork.ts';
import {createAuctionCatalogSnapshot} from '../core/domain/auction-catalog-snapshot.ts';

export async function readAuctionCatalogSnapshot(db:D1DatabaseLike){
 const published=await readyCatalogRun(db);if(!published)throw new Error('Published catalog unavailable');
 // Recheck readiness and price coverage in the SAME SQL snapshot as the rows. In-place
 // ingestion can begin after readyCatalogRun; never serialize a partially replaced run.
 const result=await db.prepare(`SELECT p.product_id AS productId,COALESCE(p.printing,'Normal') AS printing,p.name,p.set_name AS "set",COALESCE(p.rarity,'Unknown') AS rarity,COALESCE(p.section,'all') AS section,COALESCE(p.image_url,'') AS image,p.card_number AS number,c.market_cents AS cents
 FROM catalog_products p JOIN current_prices c ON c.product_id=p.product_id AND c.ingestion_run_id=p.ingestion_run_id
 WHERE p.kind='single' AND p.game='riftbound' AND p.ingestion_run_id=?
 AND EXISTS(SELECT 1 FROM refresh_state WHERE key='daily-market' AND ingestion_run_id=?)
 AND (SELECT COUNT(*) FROM catalog_products WHERE ingestion_run_id=?)>=?
 AND NOT EXISTS(SELECT 1 FROM catalog_products q LEFT JOIN current_prices v ON v.product_id=q.product_id AND v.ingestion_run_id=q.ingestion_run_id WHERE q.kind='single' AND q.game='riftbound' AND q.ingestion_run_id=? AND v.product_id IS NULL)
 AND NOT EXISTS(SELECT 1 FROM catalog_products q LEFT JOIN ingestion_runs n ON n.id=q.ingestion_run_id WHERE q.kind='single' AND q.game='riftbound' AND q.ingestion_run_id<>? AND (n.status IS NULL OR n.status<>'succeeded'))
 ORDER BY p.product_id,p.printing`).bind(published.runId,published.runId,published.runId,published.recordsWritten,published.runId,published.runId).all<{productId:number;printing:string;name:string;set:string;rarity:string;section:string;image:string;number:string|null;cents:number|null}>();
 if(!result.results?.length)throw new Error('Published auction catalog incomplete');
 const cards:Card[]=result.results.map(({cents,number,...card})=>withRiftboundRegularArtwork({...card,game:'riftbound',number:number??'',year:0,url:'',marketPrice:cents===null?null:cents/100,lowPrice:null,midPrice:null,highPrice:null,priceChange:null}));
 return createAuctionCatalogSnapshot(cards,'database',published.sourceUpdatedAt,published.lastSuccessAt);
}
