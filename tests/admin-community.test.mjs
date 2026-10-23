import assert from 'node:assert/strict';
import test from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {writeAccountDocument} from '../db/account-documents.ts';
import {initialAuctionSave} from '../core/domain/auction-types.ts';
import {emptyAuctionStatistics} from '../core/domain/auction-statistics.ts';
import {ownAuctionProfile,writePublicAuctionSettings,auctionCommunityPage,publicAuctionProfile} from '../db/auction-community.ts';
import {handleOwnAuctionProfile,handleAuctionCommunity} from '../worker/auction-community.ts';
import {adminAccountHealth,adminCatalogQuality,adminJobs,recordSyncHealth} from '../db/admin-health.ts';
import {handleAdminManagement} from '../worker/admin-routes.ts';
import {prepareDeploymentConfig} from '../scripts/cloudflare/prepare-deployment.mjs';
import {handleAccountProfile} from '../worker/account-profile.ts';
import {AUCTION_APPEARANCE_KEY} from '../core/domain/auction-appearance.ts';
const origin='https://staging.example',key='raw-signal-auction-house-v1',now=new Date().toISOString();
function fixture(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');
 for(const file of readdirSync(new URL('../drizzle/',import.meta.url)).filter(name=>/^\d{4}.*\.sql$/.test(name)).sort())sqlite.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
 const statements=[],db={prepare(sql){statements.push(sql);let args=[];return {bind(...values){args=values;return this},async first(){return sqlite.prepare(sql).get(...args)??null},async all(){return {results:sqlite.prepare(sql).all(...args)}},async run(){return sqlite.prepare(sql).run(...args)}}}};
 for(const id of ['owner-a','owner-b','admin'])sqlite.prepare('INSERT INTO auth_user(id,name,email,emailVerified,createdAt,updatedAt) VALUES(?,?,?,1,?,?)').run(id,'PRIVATE REAL NAME',id+'@private.test',now,now);
 sqlite.exec("UPDATE auth_user SET public_username='Public Player'");
 return {sqlite,db,statements,env:{DB:db,AUTH_ENABLED:'true',AUTH_BASE_URL:origin,AUTH_AUDIT_ENABLED:'true',AUTH_COMMUNITY_ENABLED:'true',AUTH_ADMIN_EMAILS:'admin@private.test'}};
}
const stats=(profit=1000)=>({...emptyAuctionStatistics(),started:2,settled:2,won:1,profit});
const save=(profit=1000)=>({...initialAuctionSave(),statistics:stats(profit),showcase:[{productId:1,printing:'Normal',quantity:1},{productId:1,printing:'Normal',quantity:1}],profileName:'PRIVATE SNAPSHOT NAME'});
const settings={showcasePublic:true,leaderboardPublic:false};
const req=(path,body,method=body?'PUT':'GET',from=origin)=>new Request(origin+path,{method,headers:{Origin:from,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});

test('profile username updates are owner-scoped, origin-checked and reject control characters or foreign fields',async()=>{
 const f=fixture();try{
  const call=(body,from=origin)=>handleAccountProfile(req('/api/account/profile',body,'PUT',from),f.env,'owner-a');
  assert.equal((await call({username:'Name'},'https://evil.test')).status,403);
  for(const body of [{username:''},{username:'x\n'},{username:'x'.repeat(41)},{username:'Name',userId:'owner-b'}])assert.equal((await call(body)).status,400);
  assert.equal((await call({username:'  Chosen Player  '})).status,200);
  assert.equal(f.sqlite.prepare('SELECT public_username FROM auth_user WHERE id=?').get('owner-a').public_username,'Chosen Player');
  assert.equal(f.sqlite.prepare('SELECT public_username FROM auth_user WHERE id=?').get('owner-b').public_username,'Public Player');
 }finally{f.sqlite.close()}
});

test('public username is explicit, live profile names follow it and publishing without one fails closed',async()=>{
 const f=fixture();try{
  f.sqlite.prepare('UPDATE auth_user SET public_username=NULL WHERE id=?').run('owner-a');
  assert.equal((await handleOwnAuctionProfile(req('/api/account/auction-profile',settings),f.env,'owner-a')).status,409);
  assert.equal((await ownAuctionProfile(f.db,'owner-a')).displayName,'');
  f.sqlite.prepare('UPDATE auth_user SET public_username=? WHERE id=?').run('Chosen Name','owner-a');
  const profile=await writePublicAuctionSettings(f.db,'owner-a',settings);
  assert.equal((await publicAuctionProfile(f.db,profile.id)).displayName,'Chosen Name');
  f.sqlite.prepare('UPDATE auth_user SET public_username=? WHERE id=?').run('New Name','owner-a');
  assert.equal((await auctionCommunityPage(f.db,'showcases',null)).rows[0].displayName,'New Name');
  f.sqlite.prepare('UPDATE auth_user SET public_username=NULL WHERE id=?').run('owner-a');
  assert.equal(await publicAuctionProfile(f.db,profile.id),null);
 }finally{f.sqlite.close()}
});
test('leaderboard metadata is optional, never scans card prices and cannot hide scores on a metadata failure',async()=>{
 const f=fixture();try{
  await writeAccountDocument(f.db,'owner-a',key,JSON.stringify(save()),0);
  await writePublicAuctionSettings(f.db,'owner-a',{...settings,leaderboardPublic:true});
  f.statements.length=0;
  const page=await auctionCommunityPage(f.db,'leaderboard',null);assert.equal(page.marketSnapshot,null);assert.equal(page.rows.length,1);
  assert.ok(!f.statements.some(sql=>/catalog_products|current_prices/.test(sql)));
  const unavailable={prepare(sql){if(sql.includes('from refresh_state r'))throw new Error('Metadata unavailable');return f.db.prepare(sql)}};
  const recovered=await auctionCommunityPage(unavailable,'leaderboard',null);assert.equal(recovered.marketSnapshot,null);assert.deepEqual(recovered.rows,page.rows);
 }finally{f.sqlite.close()}
});

test('showcase ranks use live exact-printing values, count duplicate slots and sort incomplete prices last',async()=>{
 const f=fixture();try{
  await writeAccountDocument(f.db,'owner-a',key,JSON.stringify(save()),0);
  const one={...save(),showcase:[{productId:2,printing:'Normal',quantity:1}]};
  await writeAccountDocument(f.db,'owner-b',key,JSON.stringify(one),0);
  const a=await writePublicAuctionSettings(f.db,'owner-a',settings),b=await writePublicAuctionSettings(f.db,'owner-b',settings);
  f.sqlite.exec(`INSERT INTO ingestion_runs(id,source,status,started_at,completed_at,records_written,source_updated_at) VALUES('published','tcgcsv','succeeded','${now}','${now}',2,'${now}');INSERT INTO refresh_state(key,ingestion_run_id,last_success_at) VALUES('daily-market','published','${now}');`);
  for(const id of [1,2]){
   f.sqlite.prepare("INSERT INTO catalog_products(product_id,kind,game,name,set_name,rarity,printing,source_updated_at,ingestion_run_id) VALUES(?,'single','riftbound','Card','Origins','Rare','Normal',?,'published')").run(id,now);
   f.sqlite.prepare("INSERT INTO current_prices(product_id,market_cents,observed_at,source,ingestion_run_id) VALUES(?,?,?,'tcgcsv','published')").run(id,id===1?1000:1500,now);
  }
  let page=await auctionCommunityPage(f.db,'showcases',null);assert.deepEqual(page.marketSnapshot,{source:'database',asOf:now});assert.deepEqual((await auctionCommunityPage(f.db,'leaderboard',null)).marketSnapshot,page.marketSnapshot);assert.deepEqual(page.rows.map(row=>row.id),[a.id,b.id]);assert.equal(page.rows[0].showcaseValue,2000);assert.equal(page.rows[0].cardCount,2);
  f.sqlite.prepare('UPDATE current_prices SET market_cents=3000 WHERE product_id=2').run();
  page=await auctionCommunityPage(f.db,'showcases',null);assert.equal(page.rows[0].id,b.id);
  await writeAccountDocument(f.db,'owner-b',key,JSON.stringify({...one,showcase:[{productId:2,printing:'Foil',quantity:1}]}),1);
  page=await auctionCommunityPage(f.db,'showcases',null);assert.equal(page.rows[1].id,b.id);assert.equal(page.rows[1].showcaseValue,null);assert.equal(page.rows[1].unpriced,1);
  assert.ok(!f.statements.some(sql=>/INSERT INTO current_prices|UPDATE current_prices/.test(sql)));
 }finally{f.sqlite.close()}
});

test('public profiles are private by default, independently opted in and use random public IDs',async()=>{
 const f=fixture();try{
  assert.deepEqual(await ownAuctionProfile(f.db,'owner-a'),{id:null,displayName:'Public Player',showcasePublic:false,leaderboardPublic:false,updatedAt:null});
  await writeAccountDocument(f.db,'owner-a',key,JSON.stringify(save()),0);const profile=await writePublicAuctionSettings(f.db,'owner-a',settings);
  assert.match(profile.id,/^[a-f0-9-]{36}$/);assert.notEqual(profile.id,'owner-a');assert.equal((await auctionCommunityPage(f.db,'leaderboard',null)).rows.length,0);assert.equal((await auctionCommunityPage(f.db,'showcases',null)).rows.length,1);
  const publicData=await publicAuctionProfile(f.db,profile.id),text=JSON.stringify(publicData);assert.equal(publicData.cards.length,2);assert.equal(publicData.cards[0].cents,null);for(const privateField of ['owner-a','private.test','PRIVATE','wallet','cash','inventory','drafts','daily'])assert.ok(!text.includes(privateField));
  await writePublicAuctionSettings(f.db,'owner-a',{...settings,showcasePublic:false,leaderboardPublic:true});assert.equal((await auctionCommunityPage(f.db,'showcases',null)).rows.length,0);assert.equal((await auctionCommunityPage(f.db,'leaderboard',null)).rows[0].profit,1000);assert.equal((await publicAuctionProfile(f.db,profile.id)).cards.length,0);
  await writePublicAuctionSettings(f.db,'owner-a',{...settings,showcasePublic:false});assert.equal(await publicAuctionProfile(f.db,profile.id),null);
 }finally{f.sqlite.close()}
});
test('cloud saves, resets and account deletion atomically update or remove public rankings',async()=>{
 const f=fixture();try{
  await writeAccountDocument(f.db,'owner-a',key,JSON.stringify(save()),0);const profile=await writePublicAuctionSettings(f.db,'owner-a',{...settings,leaderboardPublic:true});
  await writeAccountDocument(f.db,'owner-a',key,JSON.stringify(save(2500)),1);assert.equal((await auctionCommunityPage(f.db,'leaderboard',null)).rows[0].profit,2500);
  assert.equal(await writeAccountDocument(f.db,'owner-a',key,JSON.stringify(save(999999)),1),null);assert.equal((await auctionCommunityPage(f.db,'leaderboard',null)).rows[0].profit,2500);
  await writeAccountDocument(f.db,'owner-a',key,JSON.stringify(initialAuctionSave()),2);assert.equal((await auctionCommunityPage(f.db,'leaderboard',null)).rows.length,0);
  f.sqlite.prepare('DELETE FROM auth_user WHERE id=?').run('owner-a');assert.equal(await publicAuctionProfile(f.db,profile.id),null);
 }finally{f.sqlite.close()}
});
test('public output allowlists statistics, resolves artwork only from published catalog, and never substitutes a printing price',async()=>{
 const f=fixture();try{
  const state=save();state.statistics.extra='PRIVATE STAT PAYLOAD';state.showcase.push({productId:1,printing:'Foil',quantity:1});await writeAccountDocument(f.db,'owner-a',key,JSON.stringify(state),0);const profile=await writePublicAuctionSettings(f.db,'owner-a',settings);
  f.sqlite.exec(`INSERT INTO ingestion_runs(id,source,status,started_at,completed_at,records_written,source_updated_at) VALUES('published','tcgcsv','succeeded','${now}','${now}',1,'${now}');INSERT INTO refresh_state(key,ingestion_run_id,last_success_at) VALUES('daily-market','published','${now}');INSERT INTO catalog_products(product_id,kind,game,section,name,set_name,rarity,printing,image_url,source_updated_at,ingestion_run_id) VALUES(1,'single','riftbound','rares','Canonical Card','Origins','Rare','Normal','https://images.example/canonical','${now}','published');INSERT INTO current_prices(product_id,market_cents,observed_at,source,ingestion_run_id) VALUES(1,1200,'${now}','tcgcsv','published');`);
  const data=await publicAuctionProfile(f.db,profile.id);assert.equal(data.cards[0].name,'Canonical Card');assert.equal(data.cards[0].cents,1200);assert.equal(data.cards[2].cents,null);assert.ok(!JSON.stringify(data).includes('PRIVATE STAT PAYLOAD'));assert.equal(data.priceSource,now);
 }finally{f.sqlite.close()}
});
test('community pagination is deterministic and never includes private or zero-game accounts',async()=>{
 const f=fixture();try{
  for(let i=0;i<30;i++){const id='p'+i;f.sqlite.prepare('INSERT INTO auth_user(id,name,email,createdAt,updatedAt) VALUES(?,?,?,?,?)').run(id,id,id+'@private.test',now,now);f.sqlite.prepare('UPDATE auth_user SET public_username=? WHERE id=?').run(id,id);await writeAccountDocument(f.db,id,key,JSON.stringify(save(i<5?1000:1000+i)),0);await writePublicAuctionSettings(f.db,id,{...settings,leaderboardPublic:true})}
  const first=await auctionCommunityPage(f.db,'leaderboard',null),second=await auctionCommunityPage(f.db,'leaderboard',first.nextCursor);assert.equal(first.rows.length,25);assert.equal(second.rows.length,5);assert.equal(new Set([...first.rows,...second.rows].map(row=>row.id)).size,30);assert.equal(first.rows[0].profit,1029);assert.equal(second.offset,25);assert.equal(second.nextCursor,null);
  await assert.rejects(()=>auctionCommunityPage(f.db,'showcases',first.nextCursor),/Invalid community cursor/);await assert.rejects(()=>auctionCommunityPage(f.db,'leaderboard','{}'),/Invalid community cursor/);
 }finally{f.sqlite.close()}
});
test('public APIs are no-store, visibility changes revoke future reads and settings reject foreign origins and fields',async()=>{
 const f=fixture();try{
  assert.equal((await handleOwnAuctionProfile(req('/api/account/auction-profile',settings,'PUT','https://evil.test'),f.env,'owner-a')).status,403);
  for(const body of [{...settings,userId:'owner-b'},{...settings,displayName:'x\n'},{...settings,displayName:''}])assert.equal((await handleOwnAuctionProfile(req('/api/account/auction-profile',body),f.env,'owner-a')).status,400);
  const response=await handleOwnAuctionProfile(req('/api/account/auction-profile',settings),f.env,'owner-a'),profile=await response.json();assert.equal(response.status,200);assert.equal((await ownAuctionProfile(f.db,'owner-b')).id,null);
  const url='/api/games/auction-community/'+profile.id,publicResponse=await handleAuctionCommunity(req(url),f.env);assert.equal(publicResponse.status,200);assert.equal(publicResponse.headers.get('cache-control'),'private, no-store');
  assert.equal((await handleAuctionCommunity(req(url),{...f.env,AUTH_COMMUNITY_ENABLED:'false'})).status,503);
  await handleOwnAuctionProfile(req('/api/account/auction-profile',{...settings,showcasePublic:false}),f.env,'owner-a');assert.equal((await handleAuctionCommunity(req(url),f.env)).status,404);
 }finally{f.sqlite.close()}
});
test('support lookup needs admin, exact ID and purpose; audit stores target/reason but no private payload',async()=>{
 const f=fixture();try{
  await writeAccountDocument(f.db,'owner-a','raw-signal-theme','dark',0);await recordSyncHealth(f.db,'owner-a','raw-signal-theme','saved');await recordSyncHealth(f.db,'owner-a','raw-signal-theme','conflict');
  const user={id:'admin',email:'admin@private.test',emailVerified:true},lookup=body=>handleAdminManagement(req('/api/account/admin/accounts',body,'POST'),f.env,user);
  assert.equal((await lookup({accountId:'owner-a'})).status,400);assert.equal((await handleAdminManagement(req('/api/account/admin/accounts',{accountId:'owner-a',purpose:'sync-support'},'POST'),f.env,{...user,email:'member@private.test'})).status,403);
  const response=await lookup({accountId:'owner-a',purpose:'sync-support'}),data=await response.json();assert.equal(response.status,200);assert.equal(data.documents[0].revision,1);assert.equal(data.sync.length,2);assert.ok(!JSON.stringify(data).includes('value_json'));assert.ok(!JSON.stringify(data).includes('private.test'));
  const event=f.sqlite.prepare("SELECT target_id,reason_code FROM admin_audit_events WHERE action='admin.accounts.read'").get();assert.equal(event.target_id,'owner-a');assert.equal(event.reason_code,'sync-support');
  const absent=await adminAccountHealth(f.db,'absent');assert.equal(absent.account,null);
  f.sqlite.exec('DROP TABLE admin_audit_events');await assert.rejects(()=>lookup({accountId:'owner-a',purpose:'sync-support'}));
 }finally{f.sqlite.close()}
});
test('catalog/jobs tools read published rows and safe bounded diagnostics without external activity',async()=>{
 const f=fixture();try{
  f.sqlite.exec(`INSERT INTO ingestion_runs(id,source,status,started_at,completed_at,records_written,error_message) VALUES('published','tcgcsv','succeeded','${now}','${now}',2,NULL),('failed','tcgcsv','failed','${now}',NULL,0,'PRIVATE TOKEN IN RAW LOG');INSERT INTO refresh_state(key,ingestion_run_id,last_success_at) VALUES('daily-market','published','${now}');INSERT INTO catalog_products(product_id,kind,game,name,set_name,rarity,printing,source_updated_at,ingestion_run_id) VALUES(1,'single','riftbound','Card','Origins','Rare','Normal','${now}','published'),(2,'single','riftbound','Card','Origins','Rare','Normal','${now}','published'),(3,'single','riftbound','Other','Origins','Rare','Normal','${now}','failed');`);
  const quality=await adminCatalogQuality(f.db);assert.equal(quality.groups[0].total,2);assert.equal(quality.groups[0].missingPrice,2);assert.equal(quality.groups[0].missingArtwork,2);assert.equal(quality.candidates[0].count,2);
  const jobs=await adminJobs(f.db,100);assert.equal(jobs.runs.length,2);assert.equal(jobs.runs.find(row=>row.runId==='failed').hasError,true);assert.ok(!JSON.stringify(jobs).includes('PRIVATE TOKEN'));assert.ok(jobs.migrations.every(row=>row.applied===null));
  const user={id:'admin',email:'admin@private.test',emailVerified:true};for(const route of ['quality','jobs'])assert.equal((await handleAdminManagement(req('/api/account/admin/'+route),f.env,user)).status,200);
  assert.ok(!f.statements.some(sql=>/UPDATE catalog|DELETE FROM catalog/.test(sql)));
 }finally{f.sqlite.close()}
});
test('community configuration is default-off and never inherited from another release',()=>{
 const options={environment:'staging',databaseId:'00000000-0000-4000-8000-000000000001',databaseName:'test',workerName:'test'};
 assert.equal(prepareDeploymentConfig({vars:{AUTH_COMMUNITY_ENABLED:'true'}},options).vars.AUTH_COMMUNITY_ENABLED,'false');
 assert.throws(()=>prepareDeploymentConfig({}, {...options,accountCommunity:true}));
 assert.equal(prepareDeploymentConfig({}, {...options,accounts:true,accountTools:true,accountCommunity:true,authBaseUrl:origin}).vars.AUTH_COMMUNITY_ENABLED,'true');
});

test('malformed public community queries are rejected before profile/catalog reads',async()=>{
 const f=fixture();try{for(const query of ['?view=showcases&view=leaderboard','?cursor='+('x'.repeat(513)),'?unknown=1']){
  const before=f.statements.length,response=await handleAuctionCommunity(req('/api/games/auction-community'+query),f.env);assert.equal(response.status,400);assert.equal(f.statements.length,before);
 }}finally{f.sqlite.close()}
});

test('public cosmetic backgrounds resolve canonical exact-printing artwork only and disappear with private showcases',async()=>{
 const f=fixture();try{
  const appearance={version:1,cards:[{productId:7,printing:'Normal'},{productId:8,printing:'Foil'}]};
  await writeAccountDocument(f.db,'owner-a',AUCTION_APPEARANCE_KEY,JSON.stringify(appearance),0);
  const profile=await writePublicAuctionSettings(f.db,'owner-a',{...settings,leaderboardPublic:true});
  f.sqlite.exec(`INSERT INTO ingestion_runs(id,source,status,started_at,completed_at,records_written,source_updated_at) VALUES('published','tcgcsv','succeeded','${now}','${now}',2,'${now}');INSERT INTO refresh_state(key,ingestion_run_id,last_success_at) VALUES('daily-market','published','${now}');`);
  for(const id of [7,8])f.sqlite.prepare("INSERT INTO catalog_products(product_id,kind,game,name,set_name,rarity,printing,image_url,source_updated_at,ingestion_run_id) VALUES(?,'single','riftbound','Not Owned','Origins','Rare','Normal',?,?,'published')").run(id,'https://images.example/'+id,now);
  const data=await publicAuctionProfile(f.db,profile.id);assert.deepEqual(data.backdrop,[{image:'https://images.example/7',rarity:'Rare',section:''}]);assert.equal(data.cards.length,0);assert.ok(!JSON.stringify(data).includes('owner-a'));
  await writePublicAuctionSettings(f.db,'owner-a',{showcasePublic:false,leaderboardPublic:true});assert.deepEqual((await publicAuctionProfile(f.db,profile.id)).backdrop,[]);
  f.sqlite.prepare('UPDATE account_documents SET value_json=? WHERE user_id=? AND document_key=?').run('{"version":1,"cards":[{"image":"https://untrusted.test"}]}','owner-a',AUCTION_APPEARANCE_KEY);
  await writePublicAuctionSettings(f.db,'owner-a',{...settings,leaderboardPublic:true});assert.deepEqual((await publicAuctionProfile(f.db,profile.id)).backdrop,[]);
 }finally{f.sqlite.close()}
});
