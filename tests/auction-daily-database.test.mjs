import assert from 'node:assert/strict';
import test from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {loadDailyAuctionManifest} from '../db/auction-daily.ts';
import {createDailyAuctionManifest} from '../core/domain/auction-daily.ts';
import {loadDailyShowdownManifest} from '../db/showdown-daily.ts';

const catalog=Array.from({length:150},(_,index)=>({productId:index+1,printing:'Normal',name:`Card ${index}`,image:`https://images.example/${index}`,set:'Origins',rarity:'Rare',section:'rares',cents:200}));
const now=Date.parse('2026-10-16T12:00:00Z');
function database(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync(new URL('../drizzle/0022_daily_auction_manifest.sql',import.meta.url),'utf8'));
 sqlite.exec(readFileSync(new URL('../drizzle/0023_daily_showdown_manifest.sql',import.meta.url),'utf8'));
 sqlite.exec(`create table refresh_state(key text,ingestion_run_id text,last_success_at text);
 create table ingestion_runs(id text,status text,records_written integer,records_rejected integer,duplicate_decisions integer,schema_version integer,source_updated_at text,stats_json text);
 create table catalog_products(product_id integer primary key,printing text,name text,image_url text,set_name text,rarity text,section text,kind text,game text,ingestion_run_id text,card_number text default null);
 create table current_prices(product_id integer primary key,market_cents integer,ingestion_run_id text);
 insert into refresh_state values('daily-market','run-1','2026-10-16');
 insert into ingestion_runs values('run-1','succeeded',150,0,0,1,'2026-10-16','{}');`);
 for(const card of catalog){sqlite.prepare('insert into catalog_products(product_id,printing,name,image_url,set_name,rarity,section,kind,game,ingestion_run_id) values(?,?,?,?,?,?,?,?,?,?)').run(card.productId,card.printing,card.name,card.image,card.set,card.rarity,card.section,'single','riftbound','run-1');sqlite.prepare('insert into current_prices values(?,?,?)').run(card.productId,card.cents+card.productId,'run-1');}
 let winner=null;const statements=[];
 const db={prepare(sql){statements.push(sql);const statement=sqlite.prepare(sql);let values=[];return {bind(...args){values=args;return this},async first(){return statement.get(...values)??null},async all(){return {results:statement.all(...values)}},async run(){if(winner&&sql.startsWith('insert into daily_auction')){sqlite.prepare('insert into daily_auction_manifests values(?,?,?)').run('2026-10-16',JSON.stringify(winner),'2026-10-16');winner=null;}return statement.run(...values)}}}};
 return {sqlite,db,statements,race:value=>{winner=value}};
}
test('shared daily snapshots freeze across catalog changes, cached loads read one row and a race returns the persisted winner',async()=>{
 const {sqlite,db,statements}=database();try{
  const manifest=await loadDailyAuctionManifest(db,now);assert.equal(manifest.auctions.length,5);assert.equal(sqlite.prepare('select count(*) n from daily_auction_manifests').get().n,1);
  sqlite.exec('update current_prices set market_cents=999999');statements.length=0;
  assert.deepEqual(await loadDailyAuctionManifest(db,now),manifest);assert.equal(statements.length,1);
 }finally{sqlite.close()}
 const raced=database();try{const winner=createDailyAuctionManifest(catalog.map(card=>({...card,cents:999})),'2026-10-16','race-winner');raced.race(winner);assert.deepEqual(await loadDailyAuctionManifest(raced.db,now),winner)}finally{raced.sqlite.close()}
});
test('unpublished/partial catalogs cannot publish a daily lineup',async()=>{
 const {sqlite,db}=database();try{sqlite.exec('delete from catalog_products where product_id=1');await assert.rejects(()=>loadDailyAuctionManifest(db,now));assert.equal(sqlite.prepare('select count(*) n from daily_auction_manifests').get().n,0)}finally{sqlite.close()}
});
test('Showdown stores one shared row for both modes; archive reads never regenerate or write',async()=>{
 const {sqlite,db,statements}=database();try{
  const first=await loadDailyShowdownManifest(db,now);assert.equal(first.normal.length,10);assert.equal(first.hard.length,10);sqlite.exec('update current_prices set market_cents=999999');statements.length=0;
  assert.deepEqual(await loadDailyShowdownManifest(db,now),first);assert.equal(statements.length,1);
  assert.deepEqual(await loadDailyShowdownManifest(db,now+86400000,'2026-10-16'),first);
  assert.equal(await loadDailyShowdownManifest(db,now,'2026-10-15'),null);assert.equal(await loadDailyAuctionManifest(db,now,'2026-10-15'),null);
  assert.equal(sqlite.prepare('select count(*) n from daily_auction_manifests').get().n,0);assert.equal(sqlite.prepare('select count(*) n from daily_showdown_manifests').get().n,1);
 }finally{sqlite.close()}
});
