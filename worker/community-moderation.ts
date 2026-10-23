import type {AccountEnv} from './account-auth.ts';
import type {D1DatabaseLike} from '../db/repository.ts';
import {moderateProfile,moderationPage} from '../db/auction-moderation.ts';
import {publicProfileId} from '../core/domain/auction-community.ts';
import {boundedJson} from './bounded-json.ts';
import {appendAdminAudit} from '../db/admin-audit.ts';
import {accountJson as json} from './account-http.ts';
import {communityLimit} from './community-limits.ts';
function validAction(body:unknown):body is {id:string;hidden:boolean;revision:number;reason:string}{
 if(!body||typeof body!=='object')return false;const value=body as Record<string,unknown>;
 return Object.keys(value).every(key=>['id','hidden','revision','reason'].includes(key))&&typeof value.id==='string'&&publicProfileId(value.id)&&typeof value.hidden==='boolean'&&Number.isSafeInteger(value.revision)&&Number(value.revision)>=0&&typeof value.reason==='string'&&['inappropriate-profile','suspected-manipulation','user-request','review-complete'].includes(value.reason);
}
export async function handleCommunityModeration(request:Request,env:AccountEnv,actorId:string,requestId:string,sessionCreatedAt?:Date|string){
 if(env.AUTH_COMMUNITY_ENABLED!=='true'||env.AUTH_COMMUNITY_MODERATION_ENABLED!=='true')return json({error:'Community moderation is not enabled. Apply its migration before activation.'},503);
 const url=new URL(request.url),db=env.DB as D1DatabaseLike;
 if(request.method==='GET'){
  const keys=[...url.searchParams.keys()],cursor=url.searchParams.get('cursor');if(keys.some(key=>key!=='cursor')||keys.length>1||cursor!==null&&!publicProfileId(cursor))return json({error:'Invalid moderation cursor'},400);
  await appendAdminAudit(db,{actorId,actorRole:'admin',action:'admin.community.read',outcome:'allowed',requestId});return json(await moderationPage(db,cursor));
 }
 if(request.method!=='PUT')return json({error:'Method not allowed'},405);
 const signedAt=new Date(sessionCreatedAt??'').getTime();if(!Number.isFinite(signedAt)||signedAt>Date.now()||Date.now()-signedAt>600_000)return json({error:'Sign in again before changing public visibility.',code:'SESSION_NOT_FRESH'},403);
 if(url.search||request.headers.get('Origin')!==new URL(env.AUTH_BASE_URL!).origin)return json({error:'Invalid origin or query'},403);
 if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'JSON required'},415);
 const limited=await communityLimit(env,'write',actorId);if(limited)return limited;
 let body;try{body=await boundedJson(request,1024)}catch{return json({error:'Invalid moderation action'},400)}
 if(!validAction(body))return json({error:'Choose a profile, current revision and review reason'},400);
 return await moderateProfile(db,body,actorId,requestId)?json({success:true}):json({error:'This profile changed or is unavailable. Refresh before retrying.'},409);
}
