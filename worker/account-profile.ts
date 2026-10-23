import type {AccountEnv} from './account-auth.ts';
import type {D1DatabaseLike} from '../db/repository.ts';
import {accountJson as json} from './account-http.ts';
import {boundedJson} from './bounded-json.ts';
export async function accountUsername(db:D1DatabaseLike,id:string){
 return (await db.prepare('SELECT public_username AS username FROM auth_user WHERE id=?').bind(id).first<{username:string|null}>())?.username??null;
}
export async function handleAccountProfile(request:Request,env:AccountEnv,id:string){
 if(env.AUTH_COMMUNITY_ENABLED!=='true')return json({error:'Public usernames are not enabled yet'},503);
 if(request.method!=='PUT')return json({error:'Method not allowed'},405);
 if(request.headers.get('Origin')!==new URL(env.AUTH_BASE_URL!).origin)return json({error:'Invalid origin'},403);
 if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'JSON required'},415);
 let body;try{body=await boundedJson(request,1024)}catch{return json({error:'Invalid profile'},400)}
 const username=typeof body?.username==='string'?body.username.trim():'';
 if(!username||username.length>40||Object.keys(body).some(key=>key!=='username')||Array.from(body.username as string).some(char=>char.charCodeAt(0)<32||char.charCodeAt(0)===127))return json({error:'Choose a username of 1–40 characters without control characters'},400);
 await (env.DB as D1DatabaseLike).prepare('UPDATE auth_user SET name=?,public_username=?,updatedAt=? WHERE id=?').bind(username,username,new Date().toISOString(),id).run();
 return json({username});
}
