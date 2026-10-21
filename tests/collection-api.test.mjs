import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {handleAccountRoute} from '../worker/account-routes.ts';
import {COLLECTIONS_KEY} from '../core/domain/owned-collections.ts';
const origin='http://localhost:3000',ref={kind:'single',game:'riftbound',productId:1,printing:'Normal'};
function fixture(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');for(const name of ['0024_accounts.sql','0025_recovery_and_admin_audit.sql','0026_admin_health_and_auction_profiles.sql','0027_public_profile_username.sql'])sqlite.exec(readFileSync(new URL('../drizzle/'+name,import.meta.url),'utf8'));
 sqlite.exec(`CREATE TABLE ingestion_runs(id TEXT PRIMARY KEY,status TEXT,records_written INTEGER,records_rejected INTEGER,duplicate_decisions INTEGER,schema_version INTEGER,source_updated_at TEXT,stats_json TEXT); CREATE TABLE refresh_state(key TEXT PRIMARY KEY,ingestion_run_id TEXT,last_success_at TEXT); CREATE TABLE catalog_products(product_id INTEGER PRIMARY KEY,kind TEXT,game TEXT,name TEXT,set_name TEXT,rarity TEXT,product_type TEXT,image_url TEXT,card_number TEXT,printing TEXT,ingestion_run_id TEXT); CREATE TABLE current_prices(product_id INTEGER PRIMARY KEY,market_cents INTEGER,ingestion_run_id TEXT);
 INSERT INTO ingestion_runs VALUES('run','succeeded',1,0,0,1,'2026-10-21T00:00:00Z',NULL); INSERT INTO refresh_state VALUES('daily-market','run','2026-10-21T01:00:00Z'); INSERT INTO catalog_products VALUES(1,'single','riftbound','Canonical Card','Origins','Rare',NULL,NULL,'1','Normal','run'); INSERT INTO current_prices VALUES(1,1000,'run');`);
 const db={async exec(sql){sqlite.exec(sql)},prepare(sql){let args=[];return {bind(...values){args=values;return this},async first(){return sqlite.prepare(sql).get(...args)??null},async all(){return {success:true,results:sqlite.prepare(sql).all(...args),meta:{changes:sqlite.prepare('SELECT changes() n').get().n,last_row_id:sqlite.prepare('SELECT last_insert_rowid() n').get().n}}},async run(){return sqlite.prepare(sql).run(...args)}}},async batch(statements){return Promise.all(statements.map(row=>row.all()))}};
 const sent=[],env={DB:db,AUTH_ENABLED:'true',AUTH_COLLECTIONS_ENABLED:'true',AUTH_BASE_URL:origin,AUTH_SECRET:'local-collection-api-test-secret-more-than-thirty-two-characters',AUTH_EMAIL:{async send(message){sent.push(message)}}};return {sqlite,env,sent};
}
const req=(path,body,cookie='',from=origin,method=body===undefined?'GET':'POST')=>new Request(origin+path,{method,headers:{Origin:from,'Content-Type':'application/json',Cookie:cookie,'cf-connecting-ip':'192.0.2.1'},...(body===undefined?{}:{body:JSON.stringify(body)})});
const route=(f,path,body,cookie,from,method)=>handleAccountRoute(req(path,body,cookie,from,method),f.env);
async function login(f,email){f.sqlite.exec('DELETE FROM auth_rate_limit');const sent=await route(f,'/api/auth/email-otp/send-verification-otp',{email,type:'sign-in'});assert.equal(sent.status,200);const otp=f.sent.at(-1).text.match(/\b\d{6}\b/)[0],response=await route(f,'/api/auth/sign-in/email-otp',{email,otp});assert.equal(response.status,200);return {owner:(await response.json()).user.id,cookie:response.headers.getSetCookie().map(row=>row.split(';')[0]).join('; ')}}
const change=(f,user,revision,action,from=origin)=>route(f,'/api/account/collections',{owner:user.owner,revision,action},user.cookie,from);
test('collection actions are account-only, owner-isolated and revision protected; server snapshots cannot be forged',async()=>{
 const f=fixture();try{
  assert.equal((await route(f,'/api/account/collections')).status,401);const a=await login(f,'a@example.test'),b=await login(f,'b@example.test');
  let response=await change(f,a,0,{type:'create',name:'Personal'});assert.equal(response.status,200);const first=await response.json(),collectionId=first.state.collections[0].id;
  assert.equal((await change(f,a,1,{type:'create',name:'No'},'https://evil.example')).status,403);
  response=await change(f,a,1,{type:'add',collectionId,items:[{...ref,quantity:2,cents:1,name:'Forged'}]});assert.equal(response.status,200,await response.clone().text());const added=await response.json();assert.equal(added.state.lots[0].product.cents,1000);assert.equal(added.state.lots[0].product.name,'Canonical Card');assert.equal(added.prices[0].source,'database');assert.equal(added.owner,a.owner);
  assert.equal((await change(f,a,1,{type:'add',collectionId,items:[{...ref,quantity:2}]})).status,409);
  const other=await(await route(f,'/api/account/collections?owner='+a.owner,undefined,b.cookie)).json();assert.equal(other.owner,b.owner);assert.equal(other.state.lots.length,0);
  assert.equal((await route(f,'/api/account/collections',{owner:a.owner,revision:0,action:{type:'create',name:'No'}},b.cookie)).status,401);
  const bootstrap=await(await route(f,'/api/account/session',undefined,a.cookie)).json();assert.ok(!bootstrap.documents.some(row=>row.key===COLLECTIONS_KEY));
  const exported=await(await route(f,'/api/account/export',undefined,a.cookie)).json();assert.equal(exported.documents.find(row=>row.key===COLLECTIONS_KEY).revision,2);
  assert.equal((await route(f,'/api/account/data',{owner:a.owner,revision:2,key:COLLECTIONS_KEY,value:JSON.stringify(added.state)},a.cookie,origin,'PUT')).status,400);
  assert.equal((await route(f,'/api/auth/delete-user',{},a.cookie)).status,200);assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM account_documents WHERE user_id=?').get(a.owner).n,0);
 }finally{f.sqlite.close()}
});
test('preview never saves; review points are explicit and unknown printings are not silently substituted',async()=>{
 const f=fixture();try{
  const user=await login(f,'preview@example.test'),created=await(await change(f,user,0,{type:'create',name:'Show'})).json(),collectionId=created.state.collections[0].id;
  const preview=await(await change(f,user,1,{type:'preview',items:[ref,{...ref,printing:'Foil'}]})).json();assert.equal(preview.prices.length,1);assert.equal(f.sqlite.prepare('SELECT revision FROM account_documents').get().revision,1);
  assert.equal((await change(f,user,1,{type:'add',collectionId,items:[{...ref,printing:'Foil',quantity:1}]})).status,400);assert.equal(f.sqlite.prepare('SELECT revision FROM account_documents').get().revision,1);
  await change(f,user,1,{type:'add',collectionId,items:[{...ref,quantity:1}]});const before=await(await route(f,'/api/account/collections',undefined,user.cookie)).json();assert.equal(before.state.reviews.length,0);
  const reviewed=await(await change(f,user,2,{type:'review',collectionId:'all'})).json();assert.equal(reviewed.state.reviews.length,1);assert.equal(reviewed.state.reviews[0].lots[0].cents,1000);
  const again=await(await route(f,'/api/account/collections',undefined,user.cookie)).json();assert.deepEqual(again.state.reviews,reviewed.state.reviews);assert.equal(again.revision,3);
  f.env.AUTH_COLLECTIONS_ENABLED='false';assert.equal((await route(f,'/api/account/collections',undefined,user.cookie)).status,404);
 }finally{f.sqlite.close()}
});
