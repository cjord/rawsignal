import type {AccountEnv} from './account-auth.ts';
import type {D1DatabaseLike} from '../db/repository.ts';
import {accountRole} from './account-role.ts';
import {mirrorAccountIdentity,reconcileDeletedIdentities,type VerifiedIdentity} from '../db/account-identity.ts';

export const sharedIdentity=(env:AccountEnv)=>env.AUTH_SHARED_IDENTITY_ENABLED==='true';
export const identityRealm=(env:AccountEnv)=>env.ENVIRONMENT==='staging'?'staging':'production';
export function identityDatabase(env:AccountEnv){
 if(!sharedIdentity(env))return env.DB as D1DatabaseLike;
 if(!env.IDENTITY_DB||env.IDENTITY_DB===env.DB||!env.IDENTITY_AUTH_SECRET||env.IDENTITY_AUTH_SECRET.length<32)throw new Error('Shared identity configuration incomplete');
 return env.IDENTITY_DB as D1DatabaseLike;
}
export const stagingIdentityReadOnly=(env:AccountEnv)=>sharedIdentity(env)&&env.ENVIRONMENT==='staging';
export const stagingAccountAllowed=(env:AccountEnv,user:Pick<VerifiedIdentity,'email'|'emailVerified'>)=>!stagingIdentityReadOnly(env)||accountRole(user,env)==='admin';
export function identitySessionAllowed(env:AccountEnv,session:{user:VerifiedIdentity;session:object}){
 return stagingAccountAllowed(env,session.user)&&(!sharedIdentity(env)||(session.session as {environment?:string}).environment===identityRealm(env));
}
const stagingAuthPaths=new Set(['/api/auth/sign-in/social','/api/auth/callback/google','/api/auth/callback/discord','/api/auth/email-otp/send-verification-otp','/api/auth/sign-in/email-otp','/api/auth/sign-out','/api/auth/get-session','/api/auth/list-accounts','/api/auth/error','/api/auth/ok']);
export function stagingAuthPathAllowed(env:AccountEnv,path:string){return !stagingIdentityReadOnly(env)||stagingAuthPaths.has(path.replace(/\/$/,''));}
export async function prepareIdentityOwner(env:AccountEnv,user:VerifiedIdentity){
 if(!sharedIdentity(env))return;
 await mirrorAccountIdentity(env.DB as D1DatabaseLike,user);
}
export async function reconcileIdentityDeletes(env:AccountEnv,force=false){
 if(sharedIdentity(env))await reconcileDeletedIdentities(env.DB as D1DatabaseLike,identityDatabase(env),identityRealm(env),force);
}
