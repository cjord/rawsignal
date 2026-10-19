import {accountEnabled,accountProviders,createAccountAuth,type AccountEnv} from './account-auth.ts';
import {accountDocuments,writeAccountDocument} from '../db/account-documents.ts';
import type {D1DatabaseLike} from '../db/repository.ts';
import {isAccountKey,validAccountValue} from '../core/domain/account-data.ts';

const privateHeaders={'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'};
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:privateHeaders});
export function privateAccountPath(path:string){return path==='/api/auth'||path.startsWith('/api/auth/')||path==='/api/account'||path.startsWith('/api/account/');}
async function saveDocument(request:Request,db:D1DatabaseLike,userId:string,origin:string){
 if(request.headers.get('Origin')!==origin)return json({error:'Invalid origin'},403);
 if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'JSON required'},415);
 let body;try{body=await boundedJson(request)}catch{return json({error:'Invalid or oversized JSON'},400)}
 if(body?.owner!==userId)return json({error:'The signed-in account changed. Reload before continuing.'},401);
 if(!body||!isAccountKey(body.key)||!validAccountValue(body.key,body.value)||!Number.isSafeInteger(body.revision)||body.revision<0)return json({error:'Invalid save'},400);
 const document=await writeAccountDocument(db,userId,body.key,body.value,body.revision);
 return document?json({document}):json({error:'Saved progress changed on another device. Reload before continuing.'},409);
}
async function boundedJson(request:Request){
 const reader=request.body?.getReader();if(!reader)throw new Error('Empty body');let length=0;const chunks:Uint8Array[]=[];
 for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>1600000){await reader.cancel();throw new Error('Body too large')}chunks.push(value)}
 const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
}
export async function handleAccountRoute(request:Request,env:AccountEnv):Promise<Response|null>{
 const path=new URL(request.url).pathname;if(!privateAccountPath(path))return null;
 if(!accountEnabled(env))return path==='/api/account/session'?json({enabled:false,user:null,providers:accountProviders(env)}):json({error:'Accounts are not enabled'},503);
 try{
  const auth=createAccountAuth(env);
  if(path.startsWith('/api/auth/')){const response=await auth.handler(request);const headers=new Headers(response.headers);for(const [key,value] of Object.entries(privateHeaders))headers.set(key,value);return new Response(response.body,{status:response.status,headers})}
  const session=await auth.api.getSession({headers:request.headers});
  if(path==='/api/account/session'&&request.method==='GET')return json({enabled:true,providers:accountProviders(env),user:session?.user??null,documents:session?await accountDocuments(env.DB as D1DatabaseLike,session.user.id):[]});
  if(!session)return json({error:'Sign in required'},401);
  if(path==='/api/account/data'&&request.method==='GET')return json({documents:await accountDocuments(env.DB as D1DatabaseLike,session.user.id)});
  if(path==='/api/account/data'&&request.method==='PUT'){
   return saveDocument(request,env.DB as D1DatabaseLike,session.user.id,new URL(env.AUTH_BASE_URL!).origin);
  }
  return json({error:'Not found'},404);
 }catch{return json({error:'Account service is unavailable. Your existing saves have not been overwritten.'},503)}
}
