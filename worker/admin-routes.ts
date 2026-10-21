import {accountRole} from './account-role.ts';
import type {AccountEnv} from './account-auth.ts';
import type {D1DatabaseLike} from '../db/repository.ts';
import {appendAdminAudit,readAdminAudit} from '../db/admin-audit.ts';
import {adminAccountSummary,adminPublishedRuns,adminHeatmapStatus} from '../db/admin-management.ts';
import {accountJson as json} from './account-http.ts';
import {adminAccountHealth,adminCatalogQuality,adminJobs} from '../db/admin-health.ts';
import {SUPPORT_PURPOSES,type AdminAction} from '../core/domain/admin.ts';
import {boundedJson} from './bounded-json.ts';
import {handleCommunityModeration} from './community-moderation.ts';
import {identityDatabase,sharedIdentity} from './account-identity.ts';
type AdminUser={id:string;email:string;emailVerified:boolean};
export async function handleAdminManagement(request:Request,env:AccountEnv,user:AdminUser,sessionCreatedAt?:Date|string){
 const db=env.DB as D1DatabaseLike,role=accountRole(user,env),requestId=crypto.randomUUID();
 if(role!=='admin'){
  if(env.AUTH_AUDIT_ENABLED==='true')try{await appendAdminAudit(db,{actorId:user.id,actorRole:role,action:'admin.access.denied',outcome:'denied',requestId})}catch{/* A failed audit must not turn a denial into access. */}
  return json({error:'Administrator access required'},403);
 }
 if(env.AUTH_AUDIT_ENABLED!=='true')return json({error:'Management auditing is not enabled. Apply the pending migration before activation.'},503);
 const url=new URL(request.url),tab=url.pathname.split('/').at(-1);
 if(tab==='accounts')return accountLookup(request,env,user.id,requestId);
 if(tab==='community')return handleCommunityModeration(request,env,user.id,requestId,sessionCreatedAt);
 if(request.method!=='GET')return json({error:'These management tools are read-only'},405);
 const actions:Record<string,AdminAction>={overview:'admin.overview.read',data:'admin.data.read',audit:'admin.audit.read',quality:'admin.quality.read',jobs:'admin.jobs.read'};
 const action=actions[tab??''];if(!action)return json({error:'Not found'},404);
 await appendAdminAudit(db,{actorId:user.id,actorRole:role,action,outcome:'allowed',requestId});
 if(tab==='audit'){try{return json(await readAdminAudit(db,url.searchParams))}catch(cause){if(cause instanceof Error&&cause.message.startsWith('Invalid audit'))return json({error:cause.message},400);throw cause}}
 if(tab==='data')return json({runs:await adminPublishedRuns(db),heatmaps:await adminHeatmapStatus(db),asOf:new Date().toISOString(),automaticIngestion:env.ENVIRONMENT==='production'});
 const configured=Number(env.AUTH_EMAIL_DAILY_LIMIT??100);
 const emailDailyLimit=Number.isSafeInteger(configured)&&configured>0?configured:100;
 if(tab==='quality')return json(await adminCatalogQuality(db));
 if(tab==='jobs')return json(await adminJobs(db,emailDailyLimit,identityDatabase(env)));
 return json({...await adminAccountSummary(db,identityDatabase(env)),identityScope:sharedIdentity(env)?'Shared accounts and sessions; saves and audits belong to this environment.':'This environment',environment:env.ENVIRONMENT??'development',auditEnabled:true,recoveryEnabled:env.AUTH_RECOVERY_ENABLED==='true',emailDailyLimit,asOf:new Date().toISOString()});
}
async function accountLookup(request:Request,env:AccountEnv,actorId:string,requestId:string){
 if(request.method!=='POST')return json({error:'Use the account lookup form'},405);
 if(request.headers.get('Origin')!==new URL(env.AUTH_BASE_URL!).origin)return json({error:'Invalid origin'},403);
 let body;try{body=await boundedJson(request,1024)}catch{return json({error:'Invalid lookup'},400)}
 if(typeof body?.accountId!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(body.accountId)||!SUPPORT_PURPOSES.includes(body.purpose))return json({error:'An exact account ID and support purpose are required'},400);
 const db=env.DB as D1DatabaseLike;
 await appendAdminAudit(db,{actorId,actorRole:'admin',action:'admin.accounts.read',outcome:'allowed',requestId,targetId:body.accountId,reasonCode:body.purpose});
 return json(await adminAccountHealth(db,body.accountId,identityDatabase(env)));
}
