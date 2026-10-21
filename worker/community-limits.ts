import {accountJson} from './account-http.ts';
export type RateLimiter={limit(options:{key:string}):Promise<{success:boolean}>};
export type CommunityLimitsEnv={AUTH_COMMUNITY_LIMITS_ENABLED?:string;COMMUNITY_READ_LIMITER?:RateLimiter;ACCOUNT_WRITE_LIMITER?:RateLimiter};
// Platform burst protection, not a global accounting quota. Keys are never logged.
export async function communityLimit(env:CommunityLimitsEnv,kind:'read'|'write',identity:string|null){
 if(env.AUTH_COMMUNITY_LIMITS_ENABLED!=='true')return null;
 const binding=kind==='read'?env.COMMUNITY_READ_LIMITER:env.ACCOUNT_WRITE_LIMITER;
 if(!binding||!identity||identity.length>256)return accountJson({error:'Request protection is temporarily unavailable.'},503);
 try{const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`raw-signal:v1:${kind}:${identity}`)),key=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
  if(!(await binding.limit({key})).success){const response=accountJson({error:'Too many requests. Please wait before retrying.'},429);response.headers.set('Retry-After','60');return response}
  return null;
 }catch{return accountJson({error:'Request protection is temporarily unavailable.'},503)}
}
