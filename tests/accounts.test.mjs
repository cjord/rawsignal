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

const origin='http://localhost:3000';
function fixture(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');sqlite.exec(readFileSync(new URL('../drizzle/0024_accounts.sql',import.meta.url),'utf8'));
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
