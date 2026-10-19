import type {AccountEnv} from './account-auth.ts';
import {accountRole} from './account-role.ts';
import {accountJson as json} from './account-http.ts';
import {accountRecoveryKey} from '../db/account-recovery.ts';
import {appendAdminAudit} from '../db/admin-audit.ts';
import type {D1DatabaseLike} from '../db/repository.ts';
export async function handleRecoveryKey(request:Request,env:AccountEnv,user:{id:string;email:string;emailVerified:boolean}){
 if(env.AUTH_RECOVERY_ENABLED!=='true')return json({error:'Persistent recovery is not enabled'},503);
 if(request.method!=='POST')return json({error:'Method not allowed'},405);
 if(request.headers.get('Origin')!==new URL(env.AUTH_BASE_URL!).origin)return json({error:'Invalid origin'},403);
 if(env.AUTH_AUDIT_ENABLED==='true')await appendAdminAudit(env.DB as D1DatabaseLike,{actorId:user.id,actorRole:accountRole(user,env),action:'recovery.key.access',outcome:'allowed',requestId:crypto.randomUUID()});
 return json(await accountRecoveryKey(env.DB as D1DatabaseLike,user.id,env.AUTH_SECRET!));
}
