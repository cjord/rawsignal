import type {D1DatabaseLike} from './repository.ts';
import {readyCatalogRun} from './readiness.ts';
import type {Card} from '../core/domain/types.ts';
import type {GameMarket} from '../core/domain/game-profile.ts';
import {withRiftboundRegularArtwork} from '../core/domain/riftbound-artwork.ts';

export type PracticeCatalog={cards:Card[];source:'database'|'feed';asOf:string|null;publishedAt:string|null;bulkReady:boolean};
export async function readPracticeGameCatalog(db:D1DatabaseLike,market:GameMarket,{includeGameStock=false}:{includeGameStock?:boolean}={}):Promise<PracticeCatalog>{
 const published=await readyCatalogRun(db);if(!published)throw new Error('Published catalog unavailable.');
 const stock=includeGameStock&&market==='pokemon';
 // The publication guard and both catalog branches share one SQL snapshot. Game
 // stock is admitted only from a fully completed run that explicitly enabled it.
 const stockGuard=stock?`AND NOT EXISTS(SELECT 1 FROM game_catalog_stock q LEFT JOIN ingestion_runs n ON n.id=q.ingestion_run_id WHERE q.game=? AND q.ingestion_run_id<>? AND (n.status IS NULL OR n.status<>'succeeded')) AND (COALESCE(json_extract(r.stats_json,'$.gameStockEnabled'),0)<>1 OR (json_type(r.stats_json,'$.gameStockWritten')='integer' AND (SELECT COUNT(*) FROM game_catalog_stock WHERE ingestion_run_id=r.id)>=json_extract(r.stats_json,'$.gameStockWritten')))` :'';
 const stockRows=stock?`UNION ALL SELECT g.product_id,g.name,g.set_name,g.section,g.rarity,g.printing,g.release_year,g.card_number,g.image_url,g.source_url,g.market_cents FROM game_catalog_stock g WHERE g.game=? AND g.ingestion_run_id IN (SELECT id FROM ready WHERE json_extract(stats_json,'$.gameStockEnabled')=1)`:'';
 const result=await db.prepare(`WITH ready AS (
 SELECT r.id,r.stats_json FROM ingestion_runs r WHERE r.id=? AND r.status='succeeded'
 AND EXISTS(SELECT 1 FROM refresh_state WHERE key='daily-market' AND ingestion_run_id=r.id)
 AND (SELECT COUNT(*) FROM catalog_products WHERE ingestion_run_id=r.id)>=?
 AND NOT EXISTS(SELECT 1 FROM catalog_products q LEFT JOIN current_prices v ON v.product_id=q.product_id AND v.ingestion_run_id=q.ingestion_run_id WHERE q.kind='single' AND q.game=? AND q.ingestion_run_id=r.id AND v.product_id IS NULL)
 AND NOT EXISTS(SELECT 1 FROM catalog_products q LEFT JOIN ingestion_runs n ON n.id=q.ingestion_run_id WHERE q.kind='single' AND q.game=? AND q.ingestion_run_id<>r.id AND (n.status IS NULL OR n.status<>'succeeded')) ${stockGuard}
 ), stock AS (
 SELECT p.product_id AS productId,p.name,p.set_name AS "set",p.section,p.rarity,p.printing,p.release_year AS year,p.card_number AS number,p.image_url AS image,p.source_url AS url,c.market_cents AS cents
 FROM catalog_products p JOIN current_prices c ON c.product_id=p.product_id AND c.ingestion_run_id=p.ingestion_run_id WHERE p.kind='single' AND p.game=? AND p.ingestion_run_id IN (SELECT id FROM ready)
 ${stockRows}
 ) SELECT *,COALESCE((SELECT json_extract(stats_json,'$.gameStockEnabled') FROM ready),0) AS bulkReady FROM stock ORDER BY productId LIMIT 50001`).bind(published.runId,published.recordsWritten,market,market,...(stock?[market,published.runId]:[]),market,...(stock?[market]:[])).all<Omit<Card,'game'|'marketPrice'|'lowPrice'|'midPrice'|'highPrice'|'priceChange'>&{cents:number|null;bulkReady:number}>();
 if(!result.results?.length||result.results.length>50000)throw new Error('Published game catalog unavailable or too large.');
 const cards=result.results.map(({cents,...row})=>withRiftboundRegularArtwork({...row,game:market,set:row.set??'',section:row.section??'',rarity:row.rarity??'',printing:row.printing??'',year:row.year??0,number:row.number??'',image:row.image??'',url:row.url??'',marketPrice:cents===null?null:cents/100,lowPrice:null,midPrice:null,highPrice:null,priceChange:null}));
 return {cards,source:'database',asOf:published.sourceUpdatedAt,publishedAt:published.lastSuccessAt,bulkReady:stock&&result.results[0].bulkReady===1};
}
