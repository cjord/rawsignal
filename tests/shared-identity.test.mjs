import assert from 'node:assert/strict';
import test from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {handleAccountRoute} from '../worker/account-routes.ts';
import {createAccountAuth} from '../worker/account-auth.ts';
import {reconcileDeletedIdentities} from '../db/account-identity.ts';
import {prepareDeploymentConfig} from '../scripts/cloudflare/prepare-deployment.mjs';
import {adminAccountSummary} from '../db/admin-management.ts';
import {publicAuctionProfile,writePublicAuctionSettings,auctionCommunityPage} from '../db/auction-community.ts';

function database(identity=false){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');
 for(const name of identity?['identity/0000_shared_identity.sql']:['0024_accounts.sql','0025_recovery_and_admin_audit.sql','0026_admin_health_and_auction_profiles.sql','0027_public_profile_username.sql','0028_auction_profile_moderation.sql'])sqlite.exec(readFileSync(new URL('../drizzle/'+name,import.meta.url),'utf8'));
 const db={async exec(sql){sqlite.exec(sql)},prepare(sql){let args=[];return {bind(...values){args=values;return this},async first(){return sqlite.prepare(sql).get(...args)??null},async all(){return {success:true,results:sqlite.prepare(sql).all(...args),meta:{changes:sqlite.prepare('SELECT changes() n').get().n,last_row_id:sqlite.prepare('SELECT last_insert_rowid() n').get().n}}},async run(){return sqlite.prepare(sql).run(...args)}}},async batch(statements){return Promise.all(statements.map(statement=>statement.all()))}};
 return {db,sqlite};
}
function fixture(){
 const identity=database(true),staging=database(),production=database(),sent=[];
 const common={AUTH_ENABLED:'true',AUTH_SHARED_IDENTITY_ENABLED:'true',IDENTITY_DB:identity.db,IDENTITY_AUTH_SECRET:'shared-test-identity-only-secret-more-than-32-characters',AUTH_ADMIN_EMAILS:'admin@example.test',AUTH_COMMUNITY_ENABLED:'true',AUTH_RECOVERY_ENABLED:'true',AUTH_EMAIL:{async send(message){sent.push(message)}}};
 for(const [realm,target] of Object.entries({staging,production}))target.env={...common,DB:target.db,ENVIRONMENT:realm,AUTH_BASE_URL:`http://localhost:${realm==='staging'?3000:3001}`,AUTH_SECRET:`separate-${realm}-recovery-wrapping-key-more-than-32-characters`};
 return {identity,staging,production,sent,close(){for(const target of [identity,staging,production])target.sqlite.close()}};
}
const request=(target,path,body,cookie='')=>new Request(target.env.AUTH_BASE_URL+path,{method:body===undefined?'GET':'POST',headers:{Origin:target.env.AUTH_BASE_URL,'Content-Type':'application/json',Cookie:cookie,'cf-connecting-ip':'192.0.2.1'},...(body===undefined?{}:{body:JSON.stringify(body)})});
const route=(target,path,body,cookie)=>handleAccountRoute(request(target,path,body,cookie),target.env);
async function login(f,target,email='admin@example.test'){
 f.identity.sqlite.exec('DELETE FROM auth_rate_limit'); // Fixture-only reset between environments, never a production behavior.
 const send=await route(target,'/api/auth/email-otp/send-verification-otp',{email,type:'sign-in'});assert.equal(send.status,200,await send.clone().text());
 const otp=f.sent.at(-1).text.match(/\b\d{6}\b/)[0],response=await route(target,'/api/auth/sign-in/email-otp',{email,otp});assert.equal(response.status,200,await response.clone().text());
 const cookie=response.headers.getSetCookie().map(value=>value.split(';')[0]).join('; '),user=(await response.json()).user;
 assert.equal((await route(target,'/api/account/session',undefined,cookie)).status,200);return {cookie,user};
}
const save=(target,login,value)=>handleAccountRoute(new Request(target.env.AUTH_BASE_URL+'/api/account/data',{method:'PUT',headers:{Origin:target.env.AUTH_BASE_URL,'Content-Type':'application/json',Cookie:login.cookie},body:JSON.stringify({owner:login.user.id,key:'raw-signal-theme',value,revision:0})}),target.env);

test('shared verified identity keeps separate saves, public names and recovery keys',async()=>{
 const f=fixture();try{
  const s=await login(f,f.staging),p=await login(f,f.production);assert.equal(s.user.id,p.user.id);assert.notEqual(s.cookie,p.cookie);
  assert.equal(f.identity.sqlite.prepare('SELECT COUNT(*) n FROM auth_user').get().n,1);
  assert.equal((await save(f.staging,s,'light')).status,200);assert.equal((await save(f.production,p,'dark')).status,200);
  for(const [target,login,value] of [[f.staging,s,'light'],[f.production,p,'dark']]){
   const data=await(await route(target,'/api/account/session',undefined,login.cookie)).json();assert.equal(data.documents[0].value,value);assert.equal(data.user.role,'admin');assert.equal(data.features.identityReadOnly,target===f.staging);
  }
  const key=async(target,cookie)=>(await(await route(target,'/api/account/recovery-key',{},cookie)).json());
  const sk=await key(f.staging,s.cookie),pk=await key(f.production,p.cookie);assert.notEqual(sk.key,pk.key);assert.notEqual(sk.keyId,pk.keyId);
  f.staging.sqlite.prepare('UPDATE auth_user SET public_username=?,name=? WHERE id=?').run('Stage Player','Stage Player',s.user.id);
  await route(f.staging,'/api/account/session',undefined,s.cookie);assert.equal(f.staging.sqlite.prepare('SELECT name FROM auth_user').get().name,'Stage Player');assert.equal(f.production.sqlite.prepare('SELECT public_username FROM auth_user').get().public_username,null);
  const summary=await adminAccountSummary(f.staging.db,f.identity.db);assert.equal(summary.accounts,1);assert.equal(summary.activeSessions,2);assert.equal(summary.documents,1);
 }finally{f.close()}
});

test('staging denies member signup and rechecks admin authorization on every existing session',async()=>{
 const f=fixture();try{
  const denied=await route(f.staging,'/api/auth/email-otp/send-verification-otp',{email:'member@example.test',type:'sign-in'});assert.equal(denied.status,403);assert.equal(f.sent.length,0);
  const member=await login(f,f.production,'member@example.test');assert.equal(member.user.emailVerified,true);
  f.identity.sqlite.exec('DELETE FROM auth_rate_limit');assert.equal((await route(f.staging,'/api/auth/email-otp/send-verification-otp',{email:'member@example.test',type:'sign-in'})).status,403);
  const admin=await login(f,f.staging);f.staging.env.AUTH_ADMIN_EMAILS='';
  for(const path of ['/api/account/session','/api/account/data','/api/auth/list-accounts','/api/auth/get-session'])assert.equal((await route(f.staging,path,undefined,admin.cookie)).status,403,path);
  assert.equal((await route(f.staging,'/api/auth/sign-out',{},admin.cookie)).status,200);
  assert.equal(f.staging.sqlite.prepare('SELECT COUNT(*) n FROM account_documents').get().n,0);
 }finally{f.close()}
});

test('cookie replay cannot cross environments; staging cannot mutate shared identity or revoke production sessions',async()=>{
 const f=fixture();try{
  const s=await login(f,f.staging),p=await login(f,f.production);
  for(const path of ['/api/auth/link-social','/api/auth/unlink-account','/api/auth/delete-user','/api/auth/update-user','/api/auth/revoke-other-sessions','/api/auth/revoke-session'])assert.equal((await route(f.staging,path,{},s.cookie)).status,403,path);
  assert.equal((await route(f.staging,'/api/account/devices',undefined,s.cookie)).status,403);
  assert.equal((await route(f.staging,'/api/account/session',undefined,p.cookie)).status,200); // Host-specific cookie is not accepted; guest only.
  assert.equal((await(await route(f.staging,'/api/account/session',undefined,p.cookie)).json()).user,null);
  const forged=p.cookie.replaceAll('raw-signal-production','raw-signal-staging');
  for(const path of ['/api/account/session','/api/auth/get-session','/api/auth/list-accounts'])assert.equal((await route(f.staging,path,undefined,forged)).status,403,path);
  assert.equal((await route(f.staging,'/api/auth/sign-out',{},forged)).status,403);
  assert.equal((await route(f.production,'/api/account/data',undefined,p.cookie)).status,200);
  const auth=createAccountAuth(f.production.env);await auth.$context;assert.equal(auth.options.account.accountLinking.disableImplicitLinking,true);
 }finally{f.close()}
});

test('deletion removes canonical identity and local data, queues staging cleanup and immediately hides public profiles',async()=>{
 const f=fixture();try{
  const s=await login(f,f.staging),p=await login(f,f.production);await save(f.staging,s,'light');await save(f.production,p,'dark');
  f.staging.sqlite.prepare('UPDATE auth_user SET public_username=? WHERE id=?').run('Staging Player',s.user.id);
  const profile=await writePublicAuctionSettings(f.staging.db,s.user.id,{showcasePublic:true,leaderboardPublic:true});
  f.staging.sqlite.prepare('UPDATE auction_public_profiles SET settled=1 WHERE id=?').run(profile.id);
  const before=await auctionCommunityPage(f.staging.db,'leaderboard',null,false,f.identity.db);assert.equal(before.rows.length,1);assert.ok(!('ownerId' in before.rows[0]));
  assert.ok(await publicAuctionProfile(f.staging.db,profile.id,false,f.identity.db));
  const response=await route(f.production,'/api/auth/delete-user',{},p.cookie);assert.equal(response.status,200,await response.clone().text());
  assert.equal(f.identity.sqlite.prepare('SELECT COUNT(*) n FROM auth_user').get().n,0);assert.equal(f.production.sqlite.prepare('SELECT COUNT(*) n FROM account_documents').get().n,0);
  assert.equal(f.staging.sqlite.prepare('SELECT COUNT(*) n FROM account_documents').get().n,1);
  assert.equal(await publicAuctionProfile(f.staging.db,profile.id,false,f.identity.db),null);
  assert.deepEqual((await auctionCommunityPage(f.staging.db,'leaderboard',null,false,f.identity.db)).rows,[]);
  await reconcileDeletedIdentities(f.staging.db,f.identity.db,'staging',true);assert.equal(f.staging.sqlite.prepare('SELECT COUNT(*) n FROM account_documents').get().n,0);
  const task=f.identity.sqlite.prepare('SELECT * FROM auth_deletion_tasks').get();assert.equal(task.staging_cleaned,1);assert.equal(task.production_cleaned,1);
 }finally{f.close()}
});

test('failed deletion tasks never purge a live identity and missing identity bindings fail closed',async()=>{
 const f=fixture();try{
  const s=await login(f,f.staging);await save(f.staging,s,'light');f.identity.sqlite.prepare('INSERT INTO auth_deletion_tasks(user_id,created_at) VALUES(?,?)').run(s.user.id,new Date().toISOString());
  await reconcileDeletedIdentities(f.staging.db,f.identity.db,'staging',true);assert.equal(f.staging.sqlite.prepare('SELECT COUNT(*) n FROM account_documents').get().n,1);
  for(const patch of [{IDENTITY_DB:undefined},{IDENTITY_DB:f.staging.db},{IDENTITY_AUTH_SECRET:'short'}])assert.equal((await handleAccountRoute(request(f.staging,'/api/account/session'),{...f.staging.env,...patch})).status,503);
 }finally{f.close()}
});

test('deployment explicitly binds identity-only D1 and never inherits shared-account activation',()=>{
 const databaseId='123e4567-e89b-42d3-a456-426614174000',identityDatabaseId='123e4567-e89b-42d3-a456-426614174001';
 const base={d1_databases:[{binding:'IDENTITY_DB',database_id:identityDatabaseId}],vars:{AUTH_SHARED_IDENTITY_ENABLED:'true'}};
 const options={environment:'staging',databaseId,databaseName:'stage',workerName:'stage',accounts:true,authBaseUrl:'https://stage.example'};
 const disabled=prepareDeploymentConfig(base,options);assert.equal(disabled.vars.AUTH_SHARED_IDENTITY_ENABLED,'false');assert.equal(disabled.d1_databases.length,1);assert.deepEqual(disabled.triggers,{crons:[]});
 for(const bad of [undefined,'invalid',databaseId])assert.throws(()=>prepareDeploymentConfig(base,{...options,sharedIdentity:true,identityDatabaseId:bad}),/identity-only/);
 const enabled=prepareDeploymentConfig(base,{...options,sharedIdentity:true,identityDatabaseId});assert.equal(enabled.vars.AUTH_SHARED_IDENTITY_ENABLED,'true');assert.equal(enabled.d1_databases[1].migrations_dir,'../../drizzle/identity');assert.equal(enabled.d1_databases[0].database_id,databaseId);
});
