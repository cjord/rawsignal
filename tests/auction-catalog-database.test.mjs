import assert from 'node:assert/strict';
import test from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {readAuctionCatalogSnapshot} from '../db/auction-catalog.ts';
import {handleAuctionCatalog,loadAuctionCatalog} from '../worker/auction-catalog.ts';
import {allowedRarities} from '../core/market-state.ts';
import {unpackAuctionCatalog} from '../core/domain/auction-catalog-snapshot.ts';
function database(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(`CREATE TABLE refresh_state(key TEXT,ingestion_run_id TEXT,last_success_at TEXT);
 CREATE TABLE ingestion_runs(id TEXT,status TEXT,records_written INTEGER,records_rejected INTEGER,duplicate_decisions INTEGER,schema_version INTEGER,source_updated_at TEXT,stats_json TEXT);
 CREATE TABLE catalog_products(product_id INTEGER PRIMARY KEY,printing TEXT,name TEXT,image_url TEXT,set_name TEXT,rarity TEXT,section TEXT,kind TEXT,game TEXT,ingestion_run_id TEXT,card_number TEXT);
 CREATE TABLE current_prices(product_id INTEGER PRIMARY KEY,market_cents INTEGER,ingestion_run_id TEXT);
 INSERT INTO refresh_state VALUES('daily-market','private-run-1','2026-10-19T01:00:00Z');
 INSERT INTO ingestion_runs VALUES('private-run-1','succeeded',2,0,0,1,'2026-10-19T00:00:00Z','{}');
 INSERT INTO catalog_products VALUES(1,'Normal','First','https://art.example/1','Origins','Rare','rares','single','riftbound','private-run-1','1'),(2,'Foil','Missing Price','https://art.example/2','Origins','Promo','metal-promos','single','riftbound','private-run-1','2');
 INSERT INTO current_prices VALUES(1,101,'private-run-1'),(2,NULL,'private-run-1');`);
 const reads=[];let beforeQuery=()=>{};
 const db={prepare(sql){reads.push(sql);return {values:[],bind(...values){this.values=values;return this},async first(){beforeQuery(sql);return sqlite.prepare(sql).get(...this.values)??null},async all(){beforeQuery(sql);return {results:sqlite.prepare(sql).all(...this.values)}},async run(){throw new Error('No writes allowed')}}},batch(){throw new Error('No writes allowed')}};
 return {sqlite,db,reads,onQuery:callback=>beforeQuery=callback};
}
test('catalog snapshot reads three statements, retains null prices and excludes internal IDs/private data',async()=>{
 const {sqlite,db,reads}=database();try{const snapshot=await readAuctionCatalogSnapshot(db);assert.equal(reads.length,3);assert.equal(snapshot.count,2);assert.equal(snapshot.source,'database');assert.equal(snapshot.asOf,'2026-10-19T00:00:00Z');assert.equal(unpackAuctionCatalog(snapshot).find(row=>row.productId===2).marketPrice,null);assert.ok(!JSON.stringify(snapshot).includes('private-run-1'));assert.ok(reads.every(sql=>!/(auth_|account_|history|UPDATE|INSERT)/.test(sql)))}finally{sqlite.close()}
});
test('partial rows, missing current price rows and a publication/ingestion race fail instead of serializing a mixed snapshot',async()=>{
 for(const mutation of ["DELETE FROM catalog_products WHERE product_id=2","DELETE FROM current_prices WHERE product_id=2","UPDATE current_prices SET ingestion_run_id='new' WHERE product_id=2"]){const {sqlite,db}=database();try{sqlite.exec(mutation);await assert.rejects(()=>readAuctionCatalogSnapshot(db))}finally{sqlite.close()}}
 for(const mutation of ["UPDATE catalog_products SET ingestion_run_id='new' WHERE product_id=2","UPDATE refresh_state SET ingestion_run_id='new' WHERE key='daily-market'"]){const setup=database();try{setup.onQuery(sql=>{if(sql.startsWith('SELECT p.product_id'))setup.sqlite.exec(mutation)});await assert.rejects(()=>readAuctionCatalogSnapshot(setup.db))}finally{setup.sqlite.close()}}
});
test('server memo deduplicates manifest/body reads and expires without adding database writes',async()=>{
 const {sqlite,db,reads}=database(),env={DB:db,ENVIRONMENT:'staging',AUCTION_CATALOG_CACHE_ENABLED:'true'},url='https://example.test/api/auction/catalog';
 try{const [first,second]=await Promise.all([loadAuctionCatalog(new Request(url),env,100),loadAuctionCatalog(new Request(url),env,100)]);assert.equal(first,second);assert.equal(reads.length,3);const manifest=await handleAuctionCatalog(new Request(url),env);assert.equal(manifest.status,200);const body=await manifest.json();assert.ok(!('rows' in body));const count=reads.length;const response=await handleAuctionCatalog(new Request(`${url}?version=${body.version}`),env);assert.equal(response.status,200);assert.equal(reads.length,count);assert.equal(response.headers.get('X-Raw-Signal-Source'),'database');assert.match(response.headers.get('cache-control'),/s-maxage=600/);assert.equal(response.headers.get('set-cookie'),null);assert.equal((await handleAuctionCatalog(new Request(`${url}?version=${'0'.repeat(64)}`),env)).status,409);await loadAuctionCatalog(new Request(url),env,Date.now()+61_000);assert.equal(reads.length,count+3)}finally{sqlite.close()}
});
test('duplicate-retry undercounts cannot hide a running or failed replacement of the published catalog',async()=>{
 for(const status of ['running','failed']){
  const {sqlite,db}=database();try{
   // The gate permits recordsWritten below actual count after a duplicate retry.
   sqlite.exec(`UPDATE ingestion_runs SET records_written=1 WHERE id='private-run-1';
   INSERT INTO ingestion_runs VALUES('new-run','${status}',1,0,0,1,'2026-10-20T00:00:00Z','{}');
   UPDATE catalog_products SET ingestion_run_id='new-run' WHERE product_id=2;
   UPDATE current_prices SET ingestion_run_id='new-run' WHERE product_id=2;`);
   await assert.rejects(()=>readAuctionCatalogSnapshot(db),/incomplete/);
  }finally{sqlite.close()}
 }
});
test('endpoint fails closed when off/production and validates requests before reading D1',async()=>{
 const {sqlite,db,reads}=database(),url='https://example.test/api/auction/catalog';try{
  for(const env of [{DB:db},{DB:db,ENVIRONMENT:'production',AUCTION_CATALOG_CACHE_ENABLED:'true'}])assert.equal((await handleAuctionCatalog(new Request(url),env)).status,404);
  const env={DB:db,ENVIRONMENT:'staging',AUCTION_CATALOG_CACHE_ENABLED:'true'};
  assert.equal((await handleAuctionCatalog(new Request(url,{method:'POST'}),env)).status,405);
  assert.equal((await handleAuctionCatalog(new Request(url+'?version=wrong'),env)).status,400);assert.equal((await handleAuctionCatalog(new Request(url+'?owner=anything'),env)).status,400);assert.equal(reads.length,0);
 }finally{sqlite.close()}
});
test('bundled fallback requires every section and is labeled without inventing a source date',async()=>{
 const requested=[],card={game:'riftbound',productId:1,name:'Fallback',set:'Origins',year:2025,rarity:'Rare',number:'1',printing:'Normal',section:'rares',image:'https://art.example/1',url:'',marketPrice:null,lowPrice:null,midPrice:null,highPrice:null,priceChange:null};
 const env={ENVIRONMENT:'staging',AUCTION_CATALOG_CACHE_ENABLED:'true',ASSETS:{async fetch(request){requested.push(request.url);return Response.json([card])}}};
 const result=await handleAuctionCatalog(new Request('https://example.test/api/auction/catalog'),env),value=await result.json();assert.equal(result.status,200);assert.equal(value.source,'feed');assert.equal(value.asOf,null);assert.equal(requested.length,allowedRarities.riftbound.length);
 let broken=true;const retryEnv={...env,ASSETS:{async fetch(){return broken?new Response(null,{status:404}):Response.json([card])}}};assert.equal((await handleAuctionCatalog(new Request('https://example.test/api/auction/catalog'),retryEnv)).status,503);broken=false;assert.equal((await handleAuctionCatalog(new Request('https://example.test/api/auction/catalog'),retryEnv)).status,200);
});
