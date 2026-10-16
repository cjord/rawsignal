import type {D1DatabaseLike} from './repository.ts';
import {readyCatalogRun} from './readiness.ts';
import type {AuctionCard} from '../core/domain/auction-types.ts';
import {riftboundRegularArtworkImage} from '../core/domain/riftbound-artwork.ts';

export async function loadDailyGameCatalog(db:D1DatabaseLike){
 const published=await readyCatalogRun(db);if(!published)throw new Error('Published catalog unavailable');
 const rows=await db.prepare(`select p.product_id productId,coalesce(p.printing,'Normal') printing,p.name,p.image_url image,p.card_number number,
  p.set_name "set",coalesce(p.rarity,'Unknown') rarity,coalesce(p.section,'all') section,cp.market_cents cents
  from catalog_products p join current_prices cp on cp.product_id=p.product_id
  where p.kind='single' and p.game='riftbound' and cp.market_cents>0 and (p.image_url like 'https://%' or p.image_url like 'http://%')
   and p.ingestion_run_id=? and cp.ingestion_run_id=? order by p.product_id`).bind(published.runId,published.runId).all<AuctionCard&{number:string|null}>();
 const catalog=(rows.results??[]).map(row=>{const {number,...card}=row;return {...card,image:riftboundRegularArtworkImage({game:'riftbound',name:card.name,number})??card.image}});
 return {catalog,source:published.runId};
}
