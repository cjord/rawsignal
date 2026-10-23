import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {handleAdminManagement} from '../worker/admin-routes.ts';
import {handleAuctionCommunity} from '../worker/auction-community.ts';
import {writePublicAuctionSettings,publicAuctionProfile,auctionCommunityPage,ownAuctionProfile} from '../db/auction-community.ts';
import {writeAccountDocument} from '../db/account-documents.ts';
import {initialAuctionSave} from '../core/domain/auction-types.ts';
import {emptyAuctionStatistics} from '../core/domain/auction-statistics.ts';
const origin='https://staging.example',key='raw-signal-auction-house-v1',admin={id:'admin',email:'admin@private.test',emailVerified:true};
async function fixture(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');for(const file of readdirSync(new URL('../drizzle/',import.meta.url)).filter(file=>/^\d{4}.*\.sql$/.test(file)).sort())sqlite.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
 let reads=0;const db={prepare(sql){reads++;let args=[];return {bind(...values){args=values;return this},async first(){return sqlite.prepare(sql).get(...args)??null},async all(){const results=sqlite.prepare(sql).all(...args);return {results,meta:{changes:sqlite.prepare('SELECT changes() AS n').get().n}}},async run(){return sqlite.prepare(sql).run(...args)}}},async batch(statements){sqlite.exec('BEGIN');try{const rows=[];for(const statement of statements)rows.push(await statement.all());sqlite.exec('COMMIT');return rows}catch(cause){sqlite.exec('ROLLBACK');throw cause}}};
 const now=new Date().toISOString();for(const id of ['owner','admin'])sqlite.prepare('INSERT INTO auth_user(id,name,email,emailVerified,createdAt,updatedAt,public_username) VALUES(?,?,?,1,?,?,?)').run(id,'PRIVATE NAME',id+'@private.test',now,now,'Public Player');
 const save=initialAuctionSave();save.statistics={...emptyAuctionStatistics(),started:2,settled:2,won:1,profit:500};await writeAccountDocument(db,'owner',key,JSON.stringify(save),0);const profile=await writePublicAuctionSettings(db,'owner',{showcasePublic:true,leaderboardPublic:true});
 return {sqlite,db,profile,reads:()=>reads,env:{DB:db,AUTH_ENABLED:'true',AUTH_COMMUNITY_ENABLED:'true',AUTH_AUDIT_ENABLED:'true',AUTH_COMMUNITY_MODERATION_ENABLED:'true',AUTH_ADMIN_EMAILS:admin.email,AUTH_BASE_URL:origin}};
}
const request=(body,from=origin)=>new Request(origin+'/api/account/admin/community',{method:body?'PUT':'GET',headers:{Origin:from,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
test('moderation is admin/fresh-session/origin protected, revision checked, reversible and private-holdings neutral',async()=>{
 const f=await fixture();try{
  const body={id:f.profile.id,hidden:true,revision:0,reason:'suspected-manipulation'},call=(value=body,user=admin,time=new Date(),from=origin)=>handleAdminManagement(request(value,from),f.env,user,time),before=f.sqlite.prepare('SELECT value_json FROM account_documents').get().value_json;
  assert.equal((await call(body,{id:'owner',email:'owner@private.test',emailVerified:true})).status,403);assert.equal((await call(body,admin,new Date(Date.now()-660000))).status,403);assert.equal((await call(body,admin,new Date(),'https://evil.test')).status,403);assert.equal((await call({...body,reason:'arbitrary private text'})).status,400);
  const page=await call(null);assert.equal(page.headers.get('cache-control'),'private, no-store');const text=await page.text();assert.ok(!text.includes('private.test'));assert.ok(!text.includes('value_json'));assert.ok(!text.includes('wallet'));
  assert.equal((await call()).status,200);assert.equal((await call()).status,409);assert.equal(await publicAuctionProfile(f.db,f.profile.id,true),null);for(const view of ['leaderboard','showcases'])assert.equal((await auctionCommunityPage(f.db,view,null,true)).rows.length,0);
  await writePublicAuctionSettings(f.db,'owner',{showcasePublic:true,leaderboardPublic:true});assert.equal(await publicAuctionProfile(f.db,f.profile.id,true),null);assert.equal((await ownAuctionProfile(f.db,'owner',true)).moderationHidden,true);
  assert.equal((await call({...body,hidden:false,revision:1,reason:'review-complete'})).status,200);assert.ok(await publicAuctionProfile(f.db,f.profile.id,true));assert.equal(f.sqlite.prepare('SELECT value_json FROM account_documents').get().value_json,before);
  assert.deepEqual(f.sqlite.prepare("SELECT action FROM admin_audit_events WHERE action IN ('admin.community.hide','admin.community.restore') ORDER BY rowid").all().map(row=>row.action),['admin.community.hide','admin.community.restore']);
  await writePublicAuctionSettings(f.db,'owner',{showcasePublic:false,leaderboardPublic:false});assert.equal(await publicAuctionProfile(f.db,f.profile.id,true),null);
 }finally{f.sqlite.close()}
});
test('a failed audit rolls back moderation; rate-limited public reads perform no database lookup',async()=>{
 const f=await fixture();try{
  f.sqlite.exec("CREATE TRIGGER reject_moderation_audit BEFORE INSERT ON admin_audit_events WHEN NEW.action='admin.community.hide' BEGIN SELECT RAISE(ABORT,'audit unavailable'); END;");
  await assert.rejects(()=>handleAdminManagement(request({id:f.profile.id,hidden:true,revision:0,reason:'user-request'}),f.env,admin,new Date()),/audit unavailable/);assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM auction_profile_moderation').get().n,0);
  f.env.AUTH_COMMUNITY_LIMITS_ENABLED='true';f.env.COMMUNITY_READ_LIMITER={async limit(){return {success:false}}};const before=f.reads(),response=await handleAuctionCommunity(new Request(origin+'/api/games/auction-community',{headers:{'cf-connecting-ip':'192.0.2.1'}}),f.env);assert.equal(response.status,429);assert.equal(f.reads(),before);
 }finally{f.sqlite.close()}
});
