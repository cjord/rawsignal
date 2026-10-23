import type {D1DatabaseLike} from './repository.ts';
import {readyCatalogRun} from './readiness.ts';
import type {CollectionProduct,ProductRef} from '../core/domain/owned-collections.ts';
import {riftboundRegularArtworkImage} from '../core/domain/riftbound-artwork.ts';
export async function collectionMarket(db:D1DatabaseLike,refs:ProductRef[]):Promise<CollectionProduct[]|null>{
 const published=await readyCatalogRun(db);if(!published)return null;
 const rows=await db.prepare(`SELECT p.product_id AS productId,p.kind,p.game,p.name,p.set_name AS "set",COALESCE(p.rarity,p.product_type,'Sealed') AS rarity,p.image_url AS image,p.card_number AS number,CASE WHEN p.kind='sealed' THEN 'Sealed' ELSE COALESCE(p.printing,'Normal') END AS printing,c.market_cents AS cents FROM catalog_products p JOIN json_each(?) j ON p.product_id=json_extract(j.value,'$.productId') AND p.kind=json_extract(j.value,'$.kind') AND p.game=json_extract(j.value,'$.game') AND (CASE WHEN p.kind='sealed' THEN 'Sealed' ELSE COALESCE(p.printing,'Normal') END)=json_extract(j.value,'$.printing') LEFT JOIN current_prices c ON c.product_id=p.product_id AND c.ingestion_run_id=p.ingestion_run_id WHERE p.ingestion_run_id=?`).bind(JSON.stringify(refs),published.runId).all<CollectionProduct&{number:string|null}>();
 if(!rows.results)throw new Error('Collection prices unavailable');
 return rows.results.map(({number,...row})=>({...row,image:riftboundRegularArtworkImage({game:row.game,name:row.name,number})??row.image,source:'database',asOf:published.sourceUpdatedAt}));
}
