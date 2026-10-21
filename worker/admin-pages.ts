import {accountEnabled,createAccountAuth,type AccountEnv} from './account-auth.ts';
import {accountRole} from './account-role.ts';
import {privateAccountResponse,privateAccountHeaders} from './account-http.ts';
import {appendAdminAudit} from '../db/admin-audit.ts';
import type {D1DatabaseLike} from '../db/repository.ts';
import {identitySessionAllowed,prepareIdentityOwner,reconcileIdentityDeletes} from './account-identity.ts';
export const isAdminPage=(path:string)=>path==='/admin'||path.startsWith('/admin/');
export async function handleAdminPage(request:Request,env:AccountEnv,render:()=>Promise<Response>){
 if(!accountEnabled(env))return new Response('Accounts are not enabled.',{status:404,headers:privateAccountHeaders});
 if(!['GET','HEAD'].includes(request.method))return new Response('Read-only management pages.',{status:405,headers:privateAccountHeaders});
 try{
  await reconcileIdentityDeletes(env);
  const session=await createAccountAuth(env).api.getSession({headers:request.headers});
  if(!session)return new Response(null,{status:303,headers:{...privateAccountHeaders,Location:'/account'}});
  if(!identitySessionAllowed(env,session))return new Response('Administrator access required.',{status:403,headers:privateAccountHeaders});
  await prepareIdentityOwner(env,session.user);
  if(accountRole(session.user,env)!=='admin'){
   if(env.AUTH_AUDIT_ENABLED==='true')try{await appendAdminAudit(env.DB as D1DatabaseLike,{actorId:session.user.id,actorRole:'member',action:'admin.access.denied',outcome:'denied',requestId:crypto.randomUUID()})}catch{/* Deny even if audit storage is unavailable. */}
   return new Response('Administrator access required.',{status:403,headers:privateAccountHeaders});
  }
  return privateAccountResponse(await render());
 }catch{return new Response('Management is temporarily unavailable.',{status:503,headers:privateAccountHeaders})}
}
