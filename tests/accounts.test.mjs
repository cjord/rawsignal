import assert from 'node:assert/strict';
import test from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {handleAccountRoute} from '../worker/account-routes.ts';
import {edgeCacheClass} from '../worker/edge-cache.ts';
import {validAccountValue} from '../core/domain/account-data.ts';
import {initialAuctionSave} from '../core/domain/auction-types.ts';
import {claimAccountEmail} from '../db/account-email-budget.ts';
import {createAccountAuth} from '../worker/account-auth.ts';
import {accountProblem,accountRequestMessage} from '../core/domain/account-errors.ts';
import {accountRole} from '../worker/account-role.ts';
import {handleAdminPage,isAdminPage} from '../worker/admin-pages.ts';
import {appendAdminAudit,readAdminAudit,pruneExpiredAdminAudit} from '../db/admin-audit.ts';
import {accountRecoveryKey} from '../db/account-recovery.ts';

const origin='http://localhost:3000';
test('sign-in problems provide safe recovery without exposing arbitrary provider errors',()=>{
 assert.equal(accountProblem('ACCOUNT_NOT_LINKED').linking,true);
 assert.match(accountProblem('account_not_linked').message,/existing method/);
 for(const code of ['<script>private@example.test</script>','__proto__','constructor','toString']){
  const problem=accountProblem(code);assert.equal(problem.title,'Sign-In Could Not Be Completed');assert.equal(typeof accountRequestMessage(400,code),'string');assert.ok(!problem.message.includes(code));
 }
 assert.match(accountProblem('state_expired').title,/Again/);
 assert.match(accountRequestMessage(400,'INVALID_OTP'),/newest email/);
 assert.match(accountRequestMessage(429),/Wait/);assert.match(accountRequestMessage(503),/temporarily unavailable/);
});
test('auth errors redirect to the branded account page with private response headers',async()=>{
 const f=fixture(),response=await handleAccountRoute(request('/api/auth/error?error=account_not_linked'),f.env);
 assert.equal(response.status,302);assert.equal(response.headers.get('location'),origin+'/account?error=account_not_linked');assert.equal(response.headers.get('cache-control'),'private, no-store');
 const auth=createAccountAuth(f.env);assert.equal(auth.options.account.accountLinking.disableImplicitLinking,true);
});
function fixture(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');for(const name of ['0024_accounts.sql','0025_recovery_and_admin_audit.sql','0026_admin_health_and_auction_profiles.sql','0027_public_profile_username.sql'])sqlite.exec(readFileSync(new URL('../drizzle/'+name,import.meta.url),'utf8'));
 const db={async exec(sql){sqlite.exec(sql)},prepare(sql){let args=[];return {bind(...values){args=values;return this},async first(){return sqlite.prepare(sql).get(...args)??null},async all(){const results=sqlite.prepare(sql).all(...args);return {success:true,results,meta:{changes:sqlite.prepare("SELECT changes() n").get().n,last_row_id:sqlite.prepare("SELECT last_insert_rowid() n").get().n}}},async run(){return sqlite.prepare(sql).run(...args)}}},async batch(statements){const rows=[];for(const statement of statements)rows.push(await statement.all());return rows}};
 const sent=[],env={DB:db,AUTH_ENABLED:'true',AUTH_BASE_URL:origin,AUTH_SECRET:'local-test-only-secret-at-least-thirty-two-characters',AUTH_EMAIL:{async send(message){sent.push(message)}}};return {sqlite,db,env,sent};
}
const request=(path,body,cookie='',ip='192.0.2.1')=>new Request(origin+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie,'cf-connecting-ip':ip},...(body===undefined?{}:{body:JSON.stringify(body)})});
async function login(f,email,ip='192.0.2.1'){
 const send=await createAccountAuth(f.env).handler(request('/api/auth/email-otp/send-verification-otp',{email,type:'sign-in'},'',ip));assert.equal(send.status,200,await send.text());
 const otp=f.sent.at(-1).text.match(/\b\d{6}\b/)[0];const verify=await handleAccountRoute(request('/api/auth/sign-in/email-otp',{email,otp},'',ip),f.env);assert.equal(verify.status,200,await verify.clone().text());return {otp,userId:(await verify.json()).user.id,cookie:verify.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ')};
}
test('email OTP signs in on a D1-compatible adapter, stores only hashed codes and cannot be replayed',async()=>{
 const f=fixture();const {cookie,otp}=await login(f,'player@example.test');assert.ok(cookie.includes('session_token'));assert.equal(f.sent.length,1);
 const session=await handleAccountRoute(request('/api/account/session',undefined,cookie),f.env);assert.equal(session.headers.get('Cache-Control'),'private, no-store');const data=await session.json();assert.equal(data.user.email,'player@example.test');assert.equal(data.user.emailVerified,true);assert.deepEqual(data.documents,[]);
 assert.ok(!JSON.stringify(f.sqlite.prepare('SELECT * FROM auth_verification').all()).includes(otp));const replay=await handleAccountRoute(request('/api/auth/sign-in/email-otp',{email:'player@example.test',otp},'','192.0.2.2'),f.env);assert.notEqual(replay.status,200);
});
test('private saves are owned by the session, reject cross-origin writes and atomically detect conflicts',async()=>{
 const f=fixture(),a=await login(f,'a@example.test'),b=await login(f,'b@example.test','192.0.2.2');
 const put=(cookie,revision,value='dark',otherOrigin=origin,owner=a.userId)=>handleAccountRoute(new Request(origin+'/api/account/data',{method:'PUT',headers:{Origin:otherOrigin,'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify({key:'raw-signal-theme',value,revision,owner,userId:'someone-else'})}),f.env);
 const results=await Promise.all([put(a.cookie,0),put(a.cookie,0,'light')]);assert.deepEqual(results.map(row=>row.status).sort(),[200,409]);assert.equal((await put(a.cookie,1,'light','https://evil.example')).status,403);
 assert.equal((await put(b.cookie,0,'dark',origin,a.userId)).status,401);
 const other=await handleAccountRoute(request('/api/account/data',undefined,b.cookie),f.env);assert.deepEqual((await other.json()).documents,[]);assert.equal((await handleAccountRoute(request('/api/account/data'),f.env)).status,401);
 assert.equal((await put(a.cookie,1,'light')).status,200);const rows=f.sqlite.prepare('SELECT * FROM account_documents').all();assert.equal(rows.length,1);assert.equal(rows[0].revision,2);
 const deletion=await handleAccountRoute(request('/api/auth/delete-user',{},a.cookie),f.env);assert.equal(deletion.status,200,await deletion.text());assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM account_documents').get().n,0);
});
test('accounts fail closed, private routes are never cached, and new services stay disabled by default',async()=>{
 assert.equal((await handleAccountRoute(request('/api/auth/sign-in/email-otp',{}),{})).status,503);
 assert.equal((await (await handleAccountRoute(request('/api/account/session'),{})).json()).enabled,false);
 for(const path of ['/api/auth/get-session','/api/account/data','/api/account/session'])assert.equal(edgeCacheClass(request(path)),null);
 assert.equal((await handleAccountRoute(request('/api/account/session'),{AUTH_ENABLED:'true'})).status,503);
 assert.equal(validAccountValue('raw-signal-auction-house-v1',JSON.stringify(initialAuctionSave())),true);assert.equal(validAccountValue('raw-signal-theme','bogus'),false);assert.equal(validAccountValue('raw-signal-theme','"dark"'),false);
});
test('email budgets limit a recipient independently of IP and cap UTC daily send attempts',async()=>{
 const f=fixture(),now=Date.parse('2026-10-19T12:00:00Z');assert.equal(await claimAccountEmail(f.db,'one@example.test',2,now),true);assert.equal(await claimAccountEmail(f.db,'ONE@example.test',2,now+1000),false);assert.equal(await claimAccountEmail(f.db,'two@example.test',2,now+1000),true);assert.equal(await claimAccountEmail(f.db,'three@example.test',2,now+1000),false);assert.equal(await claimAccountEmail(f.db,'one@example.test',2,now+86400000),true);
});

test('recipient cooldown permits sends after thirty seconds while retaining the daily budget',async()=>{
 const f=fixture(),now=Date.now();assert.equal(await claimAccountEmail(f.db,'cooldown@example.test',3,now),true);assert.equal(await claimAccountEmail(f.db,'cooldown@example.test',3,now+29999),false);assert.equal(await claimAccountEmail(f.db,'cooldown@example.test',3,now+30000),true);
 assert.equal(createAccountAuth(f.env).options.plugins[0].rateLimit[0].window,30);
});
test('admin permissions require an allowlisted verified server identity and cannot be self-assigned',async()=>{
 const f=fixture(),admin=await login(f,'admin@example.test'),member=await login(f,'member@example.test','192.0.2.2');f.env.AUTH_ADMIN_EMAILS=' ADMIN@example.test ';
 assert.equal(accountRole({email:'admin@example.test',emailVerified:false},f.env),'member');assert.equal(accountRole({email:'admin@example.test',emailVerified:true},{}),'member');
 assert.equal((await handleAccountRoute(request('/api/account/admin'),f.env)).status,401);assert.equal((await handleAccountRoute(request('/api/account/admin',undefined,member.cookie),f.env)).status,403);assert.equal((await handleAccountRoute(request('/api/account/admin',undefined,admin.cookie),f.env)).status,200);
 await handleAccountRoute(request('/api/auth/update-user',{name:'Member',role:'admin'},member.cookie),f.env);
 const session=await (await handleAccountRoute(request('/api/account/session',undefined,member.cookie),f.env)).json();assert.equal(session.user.role,'member');
 assert.equal((await (await handleAccountRoute(request('/api/account/session',undefined,admin.cookie),f.env)).json()).user.role,'admin');
});
test('device listing omits tokens/IPs and revocation enforces owner, origin and fresh session',async()=>{
 const f=fixture(),a=await login(f,'devices@example.test'),b=await login(f,'other@example.test','192.0.2.2'),now=new Date().toISOString(),expires=new Date(Date.now()+86400000).toISOString();
 f.sqlite.prepare('INSERT INTO auth_session(id,token,userId,createdAt,updatedAt,expiresAt,userAgent) VALUES(?,?,?,?,?,?,?)').run('second-device','sensitive-second-token',a.userId,now,now,expires,'Mozilla Windows Chrome/100');
 const response=await handleAccountRoute(request('/api/account/devices',undefined,a.cookie),f.env),text=await response.text(),devices=JSON.parse(text).devices;assert.equal(devices.length,2);assert.equal(devices.filter(row=>row.current).length,1);assert.ok(!text.includes('sensitive-second-token'));assert.ok(!text.includes('ipAddress'));assert.equal(response.headers.get('cache-control'),'private, no-store');
 const revoke=(cookie,id,from=origin)=>handleAccountRoute(new Request(origin+'/api/account/devices?id='+id,{method:'DELETE',headers:{Origin:from,Cookie:cookie}}),f.env);
 assert.equal((await revoke(b.cookie,'second-device')).status,404);assert.equal((await revoke(a.cookie,'second-device','https://evil.test')).status,403);
 const current=devices.find(row=>row.current);assert.equal((await revoke(a.cookie,current.id)).status,400);assert.equal((await revoke(a.cookie,'second-device')).status,200);
 assert.equal(f.sqlite.prepare('SELECT id FROM auth_session WHERE id=?').get('second-device'),undefined);
 f.sqlite.prepare('UPDATE auth_session SET createdAt=? WHERE userId=?').run(new Date(Date.now()-660000).toISOString(),a.userId);assert.equal((await revoke(a.cookie,'absent')).status,403);
});

test('email codes expire, stop after three incorrect attempts, and revoked sessions lose access immediately',async()=>{
 const f=fixture(),a=await login(f,'first@example.test');
 const logout=await handleAccountRoute(request('/api/auth/sign-out',{},a.cookie),f.env);assert.equal(logout.status,200);
 assert.equal((await handleAccountRoute(request('/api/account/data',undefined,a.cookie),f.env)).status,401);
 const b=await login(f,'second@example.test','192.0.2.2');
 f.sqlite.prepare('DELETE FROM auth_session').run();
 const send=await handleAccountRoute(request('/api/auth/email-otp/send-verification-otp',{email:'third@example.test',type:'sign-in'},'','192.0.2.3'),f.env);assert.equal(send.status,200);
 const otp=f.sent.at(-1).text.match(/\b\d{6}\b/)[0],wrong=otp==='000000'?'111111':'000000';
 for(let attempt=0;attempt<3;attempt++)assert.notEqual((await handleAccountRoute(request('/api/auth/sign-in/email-otp',{email:'third@example.test',otp:wrong},'','192.0.2.3'),f.env)).status,200);
 assert.notEqual((await handleAccountRoute(request('/api/auth/sign-in/email-otp',{email:'third@example.test',otp},'','192.0.2.3'),f.env)).status,200);
 await handleAccountRoute(request('/api/auth/email-otp/send-verification-otp',{email:'expired@example.test',type:'sign-in'},'','192.0.2.4'),f.env);
 const expired=f.sent.at(-1).text.match(/\b\d{6}\b/)[0];f.sqlite.prepare("UPDATE auth_verification SET expiresAt='2000-01-01T00:00:00.000Z'").run();
 assert.notEqual((await handleAccountRoute(request('/api/auth/sign-in/email-otp',{email:'expired@example.test',otp:expired},'','192.0.2.4'),f.env)).status,200);
 assert.equal((await handleAccountRoute(request('/api/account/data',undefined,b.cookie),f.env)).status,401);
});

test('recovery keys are wrapped, stable and strictly scoped to the verified session owner',async()=>{
 const f=fixture(),a=await login(f,'key-a@example.test'),b=await login(f,'key-b@example.test','192.0.2.2');
 assert.equal((await handleAccountRoute(request('/api/account/recovery-key',{},a.cookie),f.env)).status,503);
 f.env.AUTH_RECOVERY_ENABLED='true';f.env.AUTH_AUDIT_ENABLED='true';
 const response=await handleAccountRoute(request('/api/account/recovery-key',{owner:b.userId},a.cookie),f.env),key=await response.json();assert.equal(key.owner,a.userId);assert.equal(response.headers.get('cache-control'),'private, no-store');
 const again=await accountRecoveryKey(f.db,a.userId,f.env.AUTH_SECRET),other=await accountRecoveryKey(f.db,b.userId,f.env.AUTH_SECRET);assert.deepEqual(again,key);assert.notEqual(other.key,key.key);
 assert.ok(!JSON.stringify(f.sqlite.prepare('SELECT * FROM account_recovery_keys').all()).includes(key.key));
 assert.ok(!JSON.stringify(f.sqlite.prepare('SELECT * FROM admin_audit_events').all()).includes(key.key));
 assert.equal((await handleAccountRoute(new Request(origin+'/api/account/recovery-key',{method:'POST',headers:{Cookie:a.cookie,Origin:'https://evil.test'}}),f.env)).status,403);
 assert.equal((await handleAccountRoute(request('/api/account/recovery-key',{}),f.env)).status,401);
 await assert.rejects(()=>accountRecoveryKey(f.db,a.userId,f.env.AUTH_SECRET+'wrong'));
 f.sqlite.prepare('DELETE FROM auth_user WHERE id=?').run(a.userId);assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM account_recovery_keys WHERE user_id=?').get(a.userId).n,0);
});
test('admin pages and APIs enforce server identity, private headers and audited read-only access',async()=>{
 const f=fixture(),a=await login(f,'manager@example.test'),b=await login(f,'member-2@example.test','192.0.2.2');f.env.AUTH_ADMIN_EMAILS='manager@example.test';f.env.AUTH_AUDIT_ENABLED='true';let renders=0;const render=async()=>{renders++;return new Response('private panel')};
 assert.equal(isAdminPage('/admin/audit'),true);assert.equal(isAdminPage('/administrator'),false);
 assert.equal((await handleAdminPage(request('/admin'),f.env,render)).status,303);assert.equal((await handleAdminPage(request('/admin',undefined,b.cookie),f.env,render)).status,403);assert.equal(renders,0);
 const page=await handleAdminPage(request('/admin',undefined,a.cookie),f.env,render);assert.equal(page.status,200);assert.equal(page.headers.get('cache-control'),'private, no-store');assert.equal(renders,1);assert.equal(edgeCacheClass(request('/admin/audit')),null);
 const denied=await handleAccountRoute(request('/api/account/admin/overview',undefined,b.cookie),f.env);assert.equal(denied.status,403);
 const summary=await handleAccountRoute(request('/api/account/admin/overview',undefined,a.cookie),f.env);assert.equal(summary.status,200,await summary.clone().text());assert.equal((await summary.json()).accounts,2);
 assert.equal((await handleAccountRoute(request('/api/account/admin/overview',{},a.cookie),f.env)).status,405);
 const log=await (await handleAccountRoute(request('/api/account/admin/audit',undefined,a.cookie),f.env)).json();assert.ok(log.events.some(row=>row.action==='admin.access.denied'));assert.ok(log.events.some(row=>row.action==='admin.overview.read'));
 assert.ok(!JSON.stringify(log).includes('manager@example.test'));assert.ok(!JSON.stringify(log).includes(a.cookie));
 f.env.AUTH_AUDIT_ENABLED='false';assert.equal((await handleAccountRoute(request('/api/account/admin/overview',undefined,a.cookie),f.env)).status,503);
 f.env.AUTH_AUDIT_ENABLED='true';f.sqlite.exec('DROP TABLE admin_audit_events');assert.equal((await handleAccountRoute(request('/api/account/admin/overview',undefined,a.cookie),f.env)).status,503);
});
test('audit reads are bounded and filtered, append-only records coalesce and respect retention',async()=>{
 const f=fixture(),now=Date.now(),event={actorId:'opaque-id',actorRole:'admin',action:'admin.audit.read',outcome:'allowed',requestId:'request-id'};
 await appendAdminAudit(f.db,event,now);await appendAdminAudit(f.db,event,now);assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM admin_audit_events').get().n,1);
 const insert=f.sqlite.prepare("INSERT INTO admin_audit_events(id,occurred_at,actor_id,actor_role,action,target_type,outcome,request_id,reason_code) VALUES(?,?,?,'admin','admin.data.read','management','allowed','r','authorized')");
 for(let i=0;i<110;i++)insert.run('audit-'+i,new Date(now-i*1000).toISOString(),'another-actor');
 const first=await readAdminAudit(f.db,new URLSearchParams('actor=another-actor'),now);assert.equal(first.events.length,50);assert.ok(first.nextCursor);
 const second=await readAdminAudit(f.db,new URLSearchParams({actor:'another-actor',cursor:first.nextCursor}),now);assert.equal(second.events.length,50);assert.ok(!first.events.some(row=>second.events.some(other=>row.id===other.id)));
 assert.equal((await readAdminAudit(f.db,new URLSearchParams('outcome=denied'),now)).events.length,0);
 await assert.rejects(()=>readAdminAudit(f.db,new URLSearchParams('action=arbitrary'),now),/Invalid audit/);await assert.rejects(()=>readAdminAudit(f.db,new URLSearchParams('cursor=bad'),now),/Invalid audit/);
 assert.throws(()=>f.sqlite.prepare("UPDATE admin_audit_events SET outcome='denied'").run(),/append-only/);assert.throws(()=>f.sqlite.prepare('DELETE FROM admin_audit_events').run(),/retention/);
 insert.run('expired-audit',new Date(now-91*86400000).toISOString(),'another-actor');f.sqlite.prepare("DELETE FROM admin_audit_events WHERE id='expired-audit'").run();
 for(let i=0;i<3;i++)insert.run('expired-'+i,new Date(now-91*86400000).toISOString(),'another-actor');await pruneExpiredAdminAudit(f.db,2,now);assert.equal(f.sqlite.prepare("SELECT COUNT(*) n FROM admin_audit_events WHERE id LIKE 'expired-%'").get().n,1);await assert.rejects(()=>pruneExpiredAdminAudit(f.db,101,now),/limit/);
});
test('data management reads the published marker, not an incomplete newer ingestion, and keeps missing streams unavailable',async()=>{
 const f=fixture(),admin=await login(f,'data-manager@example.test');f.env.AUTH_ADMIN_EMAILS='data-manager@example.test';f.env.AUTH_AUDIT_ENABLED='true';f.env.ENVIRONMENT='staging';
 f.sqlite.exec("CREATE TABLE ingestion_runs(id TEXT,source TEXT,status TEXT,started_at TEXT,completed_at TEXT,source_updated_at TEXT,records_written INTEGER);CREATE TABLE refresh_state(key TEXT,ingestion_run_id TEXT);CREATE TABLE set_heatmap_snapshots(game TEXT,source_date TEXT,computed_at TEXT,algorithm_version INTEGER)");
 f.sqlite.exec("INSERT INTO ingestion_runs VALUES('published','tcgcsv-live','succeeded','2026-10-18T00:00:00Z','2026-10-18T01:00:00Z','2026-10-17T12:00:00Z',123),('partial','tcgcsv-live','running','2026-10-19T00:00:00Z',NULL,NULL,5);INSERT INTO refresh_state VALUES('daily-market','published');INSERT INTO set_heatmap_snapshots VALUES('riftbound','2026-10-17','2026-10-18T02:00:00Z',4)");
 const response=await handleAccountRoute(request('/api/account/admin/data',undefined,admin.cookie),f.env);assert.equal(response.status,200,await response.clone().text());const data=await response.json();assert.equal(data.runs.find(row=>row.source==='daily-market').runId,'published');assert.equal(data.runs.find(row=>row.source==='product-details').runId,null);assert.equal(data.automaticIngestion,false);assert.equal(data.heatmaps[0].algorithmVersion,4);
});
