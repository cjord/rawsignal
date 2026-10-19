import type {AccountEnv} from './account-auth.ts';
import {accountEnabled} from './account-auth.ts';
import type {D1DatabaseLike} from '../db/repository.ts';
import {ownAuctionProfile,writePublicAuctionSettings,auctionCommunityPage,publicAuctionProfile} from '../db/auction-community.ts';
import {publicProfileId,validPublicSettings} from '../core/domain/auction-community.ts';
import {accountJson as json} from './account-http.ts';
import {boundedJson} from './bounded-json.ts';
export async function handleOwnAuctionProfile(request:Request,env:AccountEnv,userId:string){
 if(env.AUTH_COMMUNITY_ENABLED!=='true')return json({error:'Account showcases are not enabled yet'},503);
 const db=env.DB as D1DatabaseLike;
 if(request.method==='GET')return json(await ownAuctionProfile(db,userId));
 if(request.method!=='PUT')return json({error:'Method not allowed'},405);
 if(request.headers.get('Origin')!==new URL(env.AUTH_BASE_URL!).origin)return json({error:'Invalid origin'},403);
 let body;try{body=await boundedJson(request,1024)}catch{return json({error:'Invalid settings'},400)}
 if(!validPublicSettings(body))return json({error:'Choose explicit visibility settings. Public names are managed in Profile.'},400);
 if((body.showcasePublic||body.leaderboardPublic)&&!(await ownAuctionProfile(db,userId)).displayName)return json({error:'Set your public username in Profile before publishing.',code:'USERNAME_REQUIRED'},409);
 return json(await writePublicAuctionSettings(db,userId,body));
}
export const auctionCommunityPath=(path:string)=>path==='/api/games/auction-community'||path.startsWith('/api/games/auction-community/');
export async function handleAuctionCommunity(request:Request,env:AccountEnv){
 if(!accountEnabled(env)||env.AUTH_COMMUNITY_ENABLED!=='true')return json({error:'Auction community is not enabled in this environment'},503);
 if(request.method!=='GET')return json({error:'Method not allowed'},405);
 try{
  const url=new URL(request.url),tail=url.pathname.slice('/api/games/auction-community'.length),db=env.DB as D1DatabaseLike;
  if(!tail){const mode=url.searchParams.get('view')??'leaderboard';if(mode!=='leaderboard'&&mode!=='showcases')return json({error:'Invalid community view'},400);return json(await auctionCommunityPage(db,mode,url.searchParams.get('cursor')))}
  const id=tail.slice(1);if(!publicProfileId(id))return json({error:'Showcase not found or private'},404);
  const profile=await publicAuctionProfile(db,id);return profile?json(profile):json({error:'Showcase not found or private'},404);
 }catch(cause){return json({error:cause instanceof Error&&cause.message==='Invalid community cursor'?'Invalid page cursor':'Community data is temporarily unavailable'},cause instanceof Error&&cause.message==='Invalid community cursor'?400:503)}
}
