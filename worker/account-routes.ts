import {accountEnabled,accountProviders,createAccountAuth,type AccountEnv} from './account-auth.ts';
import {accountDocuments,writeAccountDocument} from '../db/account-documents.ts';
import type {D1DatabaseLike} from '../db/repository.ts';
import {isAccountKey,validAccountValue} from '../core/domain/account-data.ts';
import {accountRole} from './account-role.ts';
import {handleAdminManagement} from './admin-routes.ts';
import {handleRecoveryKey} from './recovery-routes.ts';
import {accountJson as json,privateAccountHeaders as privateHeaders} from './account-http.ts';
import {boundedJson} from './bounded-json.ts';
import {recordSyncHealth} from '../db/admin-health.ts';
import {handleOwnAuctionProfile} from './auction-community.ts';
import {accountUsername,handleAccountProfile} from './account-profile.ts';
import {handleAccountExport} from './account-export.ts';
import {communityLimit} from './community-limits.ts';
import {identityDatabase,identityRealm,identitySessionAllowed,prepareIdentityOwner,reconcileIdentityDeletes,sharedIdentity,stagingAccountAllowed,stagingAuthPathAllowed,stagingIdentityReadOnly} from './account-identity.ts';

export function privateAccountPath(path:string){return path==='/api/auth'||path.startsWith('/api/auth/')||path==='/api/account'||path.startsWith('/api/account/');}
async function sessionResponse(env:AccountEnv,user:{id:string;name:string;email:string;emailVerified:boolean}|null){
 return json({enabled:true,features:{recovery:env.AUTH_RECOVERY_ENABLED==='true',audit:env.AUTH_AUDIT_ENABLED==='true',community:env.AUTH_COMMUNITY_ENABLED==='true',...(sharedIdentity(env)?{sharedIdentity:true,identityReadOnly:stagingIdentityReadOnly(env)}:{})},providers:accountProviders(env),user:user?{...user,publicUsername:env.AUTH_COMMUNITY_ENABLED==='true'?await accountUsername(env.DB as D1DatabaseLike,user.id):null,role:accountRole(user,env)}:null,documents:user?await accountDocuments(env.DB as D1DatabaseLike,user.id):[]});
}
async function saveDocument(request:Request,db:D1DatabaseLike,userId:string,origin:string,audit:boolean){
 if(request.headers.get('Origin')!==origin)return json({error:'Invalid origin'},403);
 if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'JSON required'},415);
 let body;try{body=await boundedJson(request)}catch{return json({error:'Invalid or oversized JSON'},400)}
 if(body?.owner!==userId)return json({error:'The signed-in account changed. Reload before continuing.'},401);
 if(!body||!isAccountKey(body.key)||!validAccountValue(body.key,body.value)||!Number.isSafeInteger(body.revision)||body.revision<0){if(audit)await recordSyncHealth(db,userId,isAccountKey(body?.key)?body.key:'invalid','invalid');return json({error:'Invalid save'},400)}
 const document=await writeAccountDocument(db,userId,body.key,body.value,body.revision);
 if(audit)await recordSyncHealth(db,userId,body.key,document?'saved':'conflict');
 return document?json({document}):json({error:'Saved progress changed on another device. Reload before continuing.'},409);
}
async function handleDevices(request:Request,env:AccountEnv,auth:ReturnType<typeof createAccountAuth>,session:{user:{id:string};session:{id:string;createdAt:Date}}){
  if(stagingIdentityReadOnly(env))return json({code:'IDENTITY_READ_ONLY',error:'Manage signed-in devices on production.'},403);
  const db=identityDatabase(env);
  if(request.method==='GET'){
   const devices=await db.prepare(`SELECT id, userAgent, createdAt, expiresAt${sharedIdentity(env)?', environment':''} FROM auth_session WHERE userId=? AND expiresAt>? ORDER BY createdAt DESC LIMIT 100`).bind(session.user.id,new Date().toISOString()).all<{id:string;userAgent:string|null;createdAt:string;expiresAt:string;environment?:string}>();
   if(!devices.results)throw new Error('Unable to list sessions');
   return json({devices:devices.results.map(device=>({...device,current:device.id===session.session.id}))});
  }
  if(request.method==='DELETE'){
   if(request.headers.get('Origin')!==new URL(env.AUTH_BASE_URL!).origin)return json({error:'Invalid origin'},403);
   if(Date.now()-new Date(session.session.createdAt).getTime()>600000)return json({code:'SESSION_NOT_FRESH'},403);
   const id=new URL(request.url).searchParams.get('id');
   if(!id||id===session.session.id)return json({error:'Use Log Out to end this session'},400);
   const target=await db.prepare('SELECT token FROM auth_session WHERE id=? AND userId=?').bind(id,session.user.id).first<{token:string}>();
   if(!target)return json({error:'Device not found'},404);
   await auth.api.revokeSession({headers:request.headers,body:{token:target.token}});return json({success:true});
  }
 return json({error:'Method not allowed'},405);
}
async function handleAuthRequest(request:Request,env:AccountEnv,auth:ReturnType<typeof createAccountAuth>,path:string){
 if(!stagingAuthPathAllowed(env,path))return json({code:'IDENTITY_READ_ONLY',error:'Manage shared sign-in methods and account security on production.'},403);
 const emailPath=['/api/auth/email-otp/send-verification-otp','/api/auth/sign-in/email-otp'].includes(path.replace(/\/$/,''));
 if(stagingIdentityReadOnly(env)&&emailPath&&request.method==='POST'){
  let body;try{body=await boundedJson(request.clone(),1024)}catch{return json({error:'Invalid email sign-in request'},400)}
  if(typeof body?.email!=='string'||!stagingAccountAllowed(env,{email:body.email,emailVerified:true}))return json({code:'STAGING_ADMIN_ONLY',error:'Staging sign-in is limited to administrators.'},403);
 }
 if(sharedIdentity(env)){
  const session=await auth.api.getSession({headers:request.headers});
  if(session&&(session.session as {environment?:string}).environment!==identityRealm(env))return json({code:'SESSION_ENVIRONMENT',error:'Sign in separately in this environment.'},403);
  if(session&&!identitySessionAllowed(env,session)&&path.replace(/\/$/,'')!=='/api/auth/sign-out')return json({code:'STAGING_ADMIN_ONLY',error:'Staging accounts are limited to administrators.'},403);
 }
 const response=await auth.handler(request);
 if(response.ok&&path.replace(/\/$/,'')==='/api/auth/delete-user')await reconcileIdentityDeletes(env,true);
 const headers=new Headers(response.headers);for(const [key,value] of Object.entries(privateHeaders))headers.set(key,value);
 return new Response(response.body,{status:response.status,headers});
}
async function limitedSave(request:Request,env:AccountEnv,userId:string){
 if(request.headers.get('Origin')!==new URL(env.AUTH_BASE_URL!).origin)return json({error:'Invalid origin'},403);
 const limited=await communityLimit(env,'write',userId);if(limited)return limited;
 return saveDocument(request,env.DB as D1DatabaseLike,userId,new URL(env.AUTH_BASE_URL!).origin,env.AUTH_AUDIT_ENABLED==='true');
}
type AccountSession=NonNullable<Awaited<ReturnType<ReturnType<typeof createAccountAuth>['api']['getSession']>>>;
async function authenticatedRoute(request:Request,env:AccountEnv,auth:ReturnType<typeof createAccountAuth>,session:AccountSession,path:string){
 if(path==='/api/account/export')return await handleAccountExport(request,env.DB as D1DatabaseLike,session.user,env.AUTH_COMMUNITY_ENABLED==='true');
 if(path==='/api/account/profile')return await handleAccountProfile(request,env,session.user.id);
 if(path==='/api/account/admin'&&request.method==='GET')return accountRole(session.user,env)==='admin'?json({role:'admin'}):json({error:'Administrator access required'},403);
 if(path.startsWith('/api/account/admin/'))return await handleAdminManagement(request,env,session.user,session.session.createdAt);
 if(path==='/api/account/auction-profile')return await handleOwnAuctionProfile(request,env,session.user.id);
 if(path==='/api/account/recovery-key')return await handleRecoveryKey(request,env,session.user);
 if(path==='/api/account/devices')return await handleDevices(request,env,auth,session);
 if(path==='/api/account/data'&&request.method==='GET')return json({documents:await accountDocuments(env.DB as D1DatabaseLike,session.user.id)});
 if(path==='/api/account/data'&&request.method==='PUT')return await limitedSave(request,env,session.user.id);
 return json({error:'Not found'},404);
}
export async function handleAccountRoute(request:Request,env:AccountEnv):Promise<Response|null>{
 const path=new URL(request.url).pathname;if(!privateAccountPath(path))return null;
 if(!accountEnabled(env))return path==='/api/account/session'?json({enabled:false,user:null,providers:accountProviders(env)}):json({error:'Accounts are not enabled'},503);
 try{
  const auth=createAccountAuth(env);
  await reconcileIdentityDeletes(env);
  if(path.startsWith('/api/auth/'))return await handleAuthRequest(request,env,auth,path);
  const session=await auth.api.getSession({headers:request.headers});
  if(session&&!identitySessionAllowed(env,session))return json({code:'STAGING_ADMIN_ONLY',error:'This session cannot access this environment. Staging sign-in is limited to administrators.'},403);
  if(session)await prepareIdentityOwner(env,session.user);
  if(path==='/api/account/session'&&request.method==='GET')return await sessionResponse(env,session?.user??null);
  if(!session)return json({error:'Sign in required'},401);
  return await authenticatedRoute(request,env,auth,session,path);
 }catch{return json({error:'Account service is unavailable. Your existing saves have not been overwritten.'},503)}
}
