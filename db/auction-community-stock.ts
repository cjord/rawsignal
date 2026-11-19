import type {GameMarket} from '../core/domain/game-profile.ts';
// Both branches pin exact printings to the same completed publication. Bulk stock
// is never copied into the market-board tables or exposed as guessed prices.
export function auctionCommunityStock(market:GameMarket,runId:string|null){
 const regular=`SELECT p.product_id,p.printing,p.name,p.image_url,p.card_number,p.set_name,p.rarity,p.section,p.release_year,c.market_cents FROM catalog_products p LEFT JOIN current_prices c ON c.product_id=p.product_id AND c.ingestion_run_id=p.ingestion_run_id WHERE p.kind='single' AND p.game=? AND p.ingestion_run_id=?`;
 const bulk=market==='pokemon'?` UNION ALL SELECT g.product_id,g.printing,g.name,g.image_url,g.card_number,g.set_name,g.rarity,g.section,g.release_year,g.market_cents FROM game_catalog_stock g JOIN ingestion_runs r ON r.id=g.ingestion_run_id WHERE g.game='pokemon' AND g.ingestion_run_id=? AND r.status='succeeded' AND json_extract(r.stats_json,'$.gameStockEnabled')=1 AND json_type(r.stats_json,'$.gameStockWritten')='integer' AND (SELECT COUNT(*) FROM game_catalog_stock WHERE ingestion_run_id=r.id)>=json_extract(r.stats_json,'$.gameStockWritten')`:'';
 return {sql:`community_stock AS (${regular}${bulk})`,args:[market,runId,...(market==='pokemon'?[runId]:[])]};
}
