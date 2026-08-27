import type {Card,CatalogDetailEnrichment,MarketSignal,PriceHistory,PricePoint,SealedProduct,SignalStrictness} from "../app/domain/types";

type Statement = {
  bind(...values: unknown[]): Statement;
  run(): Promise<unknown>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>;
};

export type D1DatabaseLike = {
  prepare(sql: string): Statement;
  batch(statements: Statement[]): Promise<unknown[]>;
};

const toCents = (value: number | null) => value == null ? null : Math.round(value * 100);
const toBasisPoints = (value: number | null) => value == null ? null : Math.round(value * 100);

const productSql = `insert into catalog_products (
  product_id, kind, game, section, name, set_name, release_year, rarity,
  card_number, printing, product_type, image_url, source_url, source_updated_at, ingestion_run_id
) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
on conflict(product_id) do update set
  kind=excluded.kind, game=excluded.game, section=excluded.section, name=excluded.name,
  set_name=excluded.set_name, release_year=excluded.release_year, rarity=excluded.rarity,
  card_number=excluded.card_number, printing=excluded.printing, product_type=excluded.product_type,
  image_url=excluded.image_url, source_url=excluded.source_url,
  source_updated_at=excluded.source_updated_at, ingestion_run_id=excluded.ingestion_run_id`;

const priceSql = `insert into current_prices (
  product_id, market_cents, listing_low_cents, median_cents, listing_high_cents,
  currency, observed_at, source, ingestion_run_id
) values (?, ?, ?, ?, ?, 'USD', ?, ?, ?)
on conflict(product_id) do update set
  market_cents=excluded.market_cents, listing_low_cents=excluded.listing_low_cents,
  median_cents=excluded.median_cents, listing_high_cents=excluded.listing_high_cents,
  currency=excluded.currency, observed_at=excluded.observed_at, source=excluded.source,
  ingestion_run_id=excluded.ingestion_run_id`;

export type IngestionMetadata={schemaVersion?:number;sourceUpdatedAt?:string|null;stats?:Record<string,unknown>};

export async function startIngestion(db:D1DatabaseLike,id:string,source:string,startedAt:string,metadata:IngestionMetadata={}){
  await db.prepare(`insert into ingestion_runs (id,source,status,started_at,records_seen,records_written,records_rejected,duplicate_decisions,schema_version,source_updated_at,stats_json)
    values (?,?,'running',?,0,0,0,0,?,?,?)
    on conflict(id) do update set source=excluded.source,status='running',started_at=excluded.started_at,
    completed_at=null,records_seen=0,records_written=0,records_rejected=0,duplicate_decisions=0,
    schema_version=excluded.schema_version,source_updated_at=excluded.source_updated_at,stats_json=excluded.stats_json,error_message=null`)
    .bind(id,source,startedAt,metadata.schemaVersion??1,metadata.sourceUpdatedAt??null,metadata.stats?JSON.stringify(metadata.stats):null).run();
}

export async function upsertCard(db:D1DatabaseLike,card:Card,observedAt:string,runId:string){
  await db.batch([
    db.prepare(productSql).bind(card.productId,"single",card.game,card.section,card.name,card.set,card.year,card.rarity,card.number,card.printing,null,card.image,card.url,observedAt,runId),
    db.prepare(priceSql).bind(card.productId,toCents(card.marketPrice),toCents(card.lowPrice),toCents(card.midPrice),toCents(card.highPrice),observedAt,"tcgcsv",runId),
  ]);
}

export async function upsertSealedProduct(db:D1DatabaseLike,product:SealedProduct,observedAt:string,runId:string){
  await db.batch([
    db.prepare(productSql).bind(product.productId,"sealed",product.game,null,product.name,product.set,null,null,null,null,product.category,product.image,product.url,observedAt,runId),
    db.prepare(priceSql).bind(product.productId,toCents(product.marketPrice),null,toCents(product.midPrice),null,observedAt,"tcgcsv",runId),
    db.prepare(`insert into sealed_details (product_id,msrp_cents,msrp_source) values (?,?,?)
      on conflict(product_id) do update set msrp_cents=excluded.msrp_cents,msrp_source=excluded.msrp_source`).bind(product.productId,toCents(product.msrp),product.msrpSource),
  ]);
}

export async function upsertProductDetail(db:D1DatabaseLike,detail:CatalogDetailEnrichment){
 const source=detail.source;
 await db.prepare(`insert into product_details (product_id,category_id,group_id,set_abbreviation,published_on,modified_on,image_count,is_presale,presale_note,metadata_json,price_variants_json,source_updated_at)
   values (?,?,?,?,?,?,?,?,?,?,?,?) on conflict(product_id) do update set category_id=excluded.category_id,group_id=excluded.group_id,
   set_abbreviation=excluded.set_abbreviation,published_on=excluded.published_on,modified_on=excluded.modified_on,image_count=excluded.image_count,
   is_presale=excluded.is_presale,presale_note=excluded.presale_note,metadata_json=excluded.metadata_json,price_variants_json=excluded.price_variants_json,
   source_updated_at=excluded.source_updated_at`).bind(detail.productId,source.categoryId,source.groupId,source.setAbbreviation,source.publishedOn,source.modifiedOn,source.imageCount,source.isPresale==null?null:Number(source.isPresale),source.presaleNote,JSON.stringify(detail.metadata),JSON.stringify(detail.priceVariants),source.sourceUpdatedAt).run();
}

export async function upsertHistory(db:D1DatabaseLike,productId:number,variant:string,condition:string,points:PricePoint[],fetchedAt:string,source="tcgplayer"){
  const sql=`insert into price_observations (product_id,variant,condition,observed_date,market_cents,source,fetched_at)
    values (?,?,?,?,?,?,?) on conflict(product_id,variant,condition,observed_date) do update set
    market_cents=excluded.market_cents,source=excluded.source,fetched_at=excluded.fetched_at`;
  for(let offset=0;offset<points.length;offset+=50){
    const statements=points.slice(offset,offset+50).map(point=>db.prepare(sql).bind(productId,variant,condition,point.date,toCents(point.price),source,fetchedAt));
    await db.batch(statements);
  }
}

export async function upsertMarketMetrics(db:D1DatabaseLike,productId:number,variant:string,condition:string,asOfDate:string,history:PriceHistory,updatedAt:string){
  await db.prepare(`insert into market_metrics (product_id,variant,condition,as_of_date,coverage,
    change_7_bps,change_30_bps,change_90_bps,low_30_cents,high_30_cents,historic_low_cents,historic_high_cents,updated_at)
    values (?,?,?,?,?,?,?,?,?,?,?,?,?) on conflict(product_id,variant,condition) do update set
    as_of_date=excluded.as_of_date,coverage=excluded.coverage,change_7_bps=excluded.change_7_bps,
    change_30_bps=excluded.change_30_bps,change_90_bps=excluded.change_90_bps,
    low_30_cents=excluded.low_30_cents,high_30_cents=excluded.high_30_cents,
    historic_low_cents=excluded.historic_low_cents,historic_high_cents=excluded.historic_high_cents,
    updated_at=excluded.updated_at`).bind(productId,variant,condition,asOfDate,history.coverage,
      toBasisPoints(history.change7),toBasisPoints(history.change30),toBasisPoints(history.change90),
      toCents(history.low30),toCents(history.high30),toCents(history.historyLow),toCents(history.historyHigh),updatedAt).run();
}

export async function upsertMarketSignal(db:D1DatabaseLike,productId:number,strictness:SignalStrictness,signal:MarketSignal,asOfDate:string,coverage:PriceHistory["coverage"]="none",observationDate=asOfDate){
  await db.prepare(`insert into market_signals (product_id,side,strictness,score,confidence,reason,detail,distance_bps,cutoff_bps,as_of_date,observation_date,coverage)
    values (?,?,?,?,?,?,?,?,?,?,?,?) on conflict(product_id,side,strictness) do update set
    score=excluded.score,confidence=excluded.confidence,reason=excluded.reason,detail=excluded.detail,
    distance_bps=excluded.distance_bps,cutoff_bps=excluded.cutoff_bps,as_of_date=excluded.as_of_date,
    observation_date=excluded.observation_date,coverage=excluded.coverage`).bind(
      productId,signal.side,strictness,signal.score,signal.confidence,signal.reason,signal.detail,
      toBasisPoints(signal.distance),toBasisPoints(signal.cutoff),asOfDate,observationDate,coverage).run();
}

export async function deleteMarketSignal(db:D1DatabaseLike,productId:number,side:"buy"|"sell",strictness:SignalStrictness){
  await db.prepare("delete from market_signals where product_id=? and side=? and strictness=?").bind(productId,side,strictness).run();
}

export async function completeIngestion(db:D1DatabaseLike,id:string,refreshKey:string,completedAt:string,recordsSeen:number,recordsWritten:number,recordsRejected=0,duplicateDecisions=0,stats:Record<string,unknown>|null=null){
  await db.batch([
    db.prepare(`update ingestion_runs set status='succeeded',completed_at=?,records_seen=?,records_written=?,records_rejected=?,duplicate_decisions=?,stats_json=coalesce(?,stats_json) where id=?`).bind(completedAt,recordsSeen,recordsWritten,recordsRejected,duplicateDecisions,stats?JSON.stringify(stats):null,id),
    db.prepare(`insert into refresh_state (key,last_success_at,ingestion_run_id) values (?,?,?)
      on conflict(key) do update set last_success_at=excluded.last_success_at,ingestion_run_id=excluded.ingestion_run_id`).bind(refreshKey,completedAt,id),
  ]);
}

export async function failIngestion(db:D1DatabaseLike,id:string,completedAt:string,errorMessage:string){
  await db.prepare(`update ingestion_runs set status='failed',completed_at=?,error_message=? where id=?`).bind(completedAt,errorMessage,id).run();
}

export async function checkpointIngestion(db:D1DatabaseLike,id:string,refreshKey:string,recordsSeen:number,recordsWritten:number,cursor:string,stats:Record<string,unknown>|null=null){
  await db.batch([
    db.prepare("update ingestion_runs set status='running',completed_at=null,error_message=null,records_seen=?,records_written=?,stats_json=coalesce(?,stats_json) where id=?")
      .bind(recordsSeen,recordsWritten,stats?JSON.stringify(stats):null,id),
    db.prepare(`insert into refresh_state (key,ingestion_run_id,cursor) values (?,?,?)
      on conflict(key) do update set ingestion_run_id=excluded.ingestion_run_id,cursor=excluded.cursor`).bind(refreshKey,id,cursor),
  ]);
}

export async function readRefreshCursor(db:D1DatabaseLike,key:string){
  return db.prepare(`select r.cursor,r.ingestion_run_id as ingestionRunId,i.stats_json as statsJson
    from refresh_state r left join ingestion_runs i on i.id=r.ingestion_run_id where r.key=?`).bind(key).first<{cursor:string|null;ingestionRunId:string|null;statsJson:string|null}>();
}

export async function publishedIngestion(db:D1DatabaseLike,refreshKey="daily-market"){
  return db.prepare(`select r.ingestion_run_id as runId,r.last_success_at as lastSuccessAt,i.records_written as recordsWritten,
    i.records_rejected as recordsRejected,i.duplicate_decisions as duplicateDecisions,i.schema_version as schemaVersion,
    i.source_updated_at as sourceUpdatedAt,i.stats_json as statsJson
    from refresh_state r join ingestion_runs i on i.id=r.ingestion_run_id
    where r.key=? and i.status='succeeded'`).bind(refreshKey).first<{runId:string;lastSuccessAt:string;recordsWritten:number;recordsRejected:number;duplicateDecisions:number;schemaVersion:number;sourceUpdatedAt:string|null;statsJson:string|null}>();
}

export async function readProductSnapshot(db:D1DatabaseLike,productId:number){
  return db.prepare(`select p.product_id as productId,p.kind,p.game,p.name,p.set_name as setName,
    cp.market_cents as marketCents,cp.median_cents as medianCents,sd.msrp_cents as msrpCents
    from catalog_products p left join current_prices cp on cp.product_id=p.product_id
    left join sealed_details sd on sd.product_id=p.product_id where p.product_id=?`).bind(productId).first();
}
