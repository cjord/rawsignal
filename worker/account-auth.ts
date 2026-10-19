import {betterAuth} from 'better-auth';
import {emailOTP} from 'better-auth/plugins/email-otp';
import {APIError} from 'better-auth/api';
import {claimAccountEmail} from '../db/account-email-budget.ts';
import type {D1DatabaseLike} from '../db/repository.ts';

export type AccountEnv={
 DB?:Parameters<typeof betterAuth>[0]['database'];AUTH_ENABLED?:string;AUTH_BASE_URL?:string;AUTH_SECRET?:string;
 GOOGLE_CLIENT_ID?:string;GOOGLE_CLIENT_SECRET?:string;DISCORD_CLIENT_ID?:string;DISCORD_CLIENT_SECRET?:string;
 AUTH_EMAIL?:{send(message:{from:string;to:string;subject:string;text:string}):Promise<unknown>};
 AUTH_EMAIL_DAILY_LIMIT?:string;AUTH_ADMIN_EMAILS?:string;AUTH_AUDIT_ENABLED?:string;AUTH_RECOVERY_ENABLED?:string;AUTH_COMMUNITY_ENABLED?:string;ENVIRONMENT?:string;
};
export const accountEnabled=(env:AccountEnv)=>env.AUTH_ENABLED==='true';
export function accountProviders(env:AccountEnv){return {google:!!(env.GOOGLE_CLIENT_ID&&env.GOOGLE_CLIENT_SECRET),discord:!!(env.DISCORD_CLIENT_ID&&env.DISCORD_CLIENT_SECRET),email:!!env.AUTH_EMAIL};}
export function createAccountAuth(env:AccountEnv){
 if(!env.DB||!env.AUTH_SECRET||env.AUTH_SECRET.length<32||!env.AUTH_BASE_URL)throw new Error('Account configuration incomplete');
 const base=new URL(env.AUTH_BASE_URL);if(base.username||base.password||base.search||base.hash||base.pathname!=='/'||(base.protocol!=='https:'&&!(base.protocol==='http:'&&['localhost','127.0.0.1'].includes(base.hostname))))throw new Error('Invalid account origin');
 const providers=accountProviders(env);
 return betterAuth({
  appName:'Raw Signal',baseURL:base.origin,basePath:'/api/auth',secret:env.AUTH_SECRET,database:env.DB,
  trustedOrigins:[base.origin],telemetry:{enabled:false},
  onAPIError:{errorURL:base.origin+'/account'},
  user:{modelName:'auth_user',deleteUser:{enabled:true},changeEmail:{enabled:false}},
  session:{modelName:'auth_session',expiresIn:60*60*24*30,updateAge:60*60*24,freshAge:600,cookieCache:{enabled:false}},
  account:{modelName:'auth_account',encryptOAuthTokens:true,accountLinking:{enabled:true,disableImplicitLinking:true}},
  verification:{modelName:'auth_verification'},
  rateLimit:{enabled:true,storage:'database',modelName:'auth_rate_limit',window:60,max:60},
  advanced:{useSecureCookies:base.protocol==='https:',ipAddress:{ipAddressHeaders:['cf-connecting-ip']}},
  socialProviders:{
   ...(providers.google?{google:{clientId:env.GOOGLE_CLIENT_ID!,clientSecret:env.GOOGLE_CLIENT_SECRET!}}:{}),
   ...(providers.discord?{discord:{clientId:env.DISCORD_CLIENT_ID!,clientSecret:env.DISCORD_CLIENT_SECRET!}}:{}),
  },
  plugins:[emailOTP({otpLength:6,expiresIn:300,allowedAttempts:3,storeOTP:'hashed',rateLimit:{window:30,max:1},
   async sendVerificationOTP({email,otp,type}){
    if(type!=='sign-in')throw new Error('Unsupported email action');if(!env.AUTH_EMAIL)throw new Error('Email login unavailable');
    const configured=Number(env.AUTH_EMAIL_DAILY_LIMIT??100),limit=Number.isSafeInteger(configured)&&configured>0?configured:100;
    if(!await claimAccountEmail(env.DB as D1DatabaseLike,email,limit))throw new APIError('TOO_MANY_REQUESTS',{message:'Too many email requests. Please try again later.'});
    await env.AUTH_EMAIL.send({from:'accounts@rawsignal.cards',to:email,subject:'Your Raw Signal sign-in code',text:`Your Raw Signal sign-in code is ${otp}. It expires in 5 minutes. Never share this code. If you did not request it, ignore this email.`});
   },
  })],
 });
}
