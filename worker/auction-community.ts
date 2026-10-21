import type {AccountEnv} from './account-auth.ts';
import {accountEnabled} from './account-auth.ts';
import type {D1DatabaseLike} from '../db/repository.ts';
import {ownAuctionProfile,writePublicAuctionSettings,auctionCommunityPage,publicAuctionProfile} from '../db/auction-community.ts';
import {communityQuery,publicProfileId,validPublicSettings} from '../core/domain/auction-community.ts';
import {accountJson as json} from './account-http.ts';
import {boundedJson} from './bounded-json.ts';
import {communityLimit} from './community-limits.ts';
export async function handleOwnAuctionProfile(request:Request,env:AccountEnv,userId:string){
 if(env.AUTH_COMMUNITY_ENABLED!=='true')return json({error:'Account showcases are not enabled yet'},503);
 const db=env.DB as D1DatabaseLike;
 if(request.method==='GET')return json(await ownAuctionProfile(db,userId,env.AUTH_COMMUNITY_MODERATION_ENABLED==='true'));
 if(request.method!=='PUT')return json({error:'Method not allowed'},405);
 if(request.headers.get('Origin')!==new URL(env.AUTH_BASE_URL!).origin)return json({error:'Invalid origin'},403);
 const limited=await communityLimit(env,'write',userId);if(limited)return limited;
 let body;try{body=await boundedJson(request,1024)}catch{return json({error:'Invalid settings'},400)}
 if(!validPublicSettings(body))return json({error:'Choose explicit visibility settings. Public names are managed in Profile.'},400);
 if((body.showcasePublic||body.leaderboardPublic)&&!(await ownAuctionProfile(db,userId)).displayName)return json({error:'Set your public username in Profile before publishing.',code:'USERNAME_REQUIRED'},409);
 return json(await writePublicAuctionSettings(db,userId,body,env.AUTH_COMMUNITY_MODERATION_ENABLED==='true'));
}
export const auctionCommunityPath=(path:string)=>path==='/api/games/auction-community'||path.startsWith('/api/games/auction-community/');
export async function handleAuctionCommunity(request:Request,env:AccountEnv){
 if(!accountEnabled(env)||env.AUTH_COMMUNITY_ENABLED!=='true')return json({error:'Auction community is not enabled in this environment'},503);
 if(request.method!=='GET')return json({error:'Method not allowed'},405);
 const limited=await communityLimit(env,'read',request.headers.get('cf-connecting-ip'));if(limited)return limited;
 try{
  const url=new URL(request.url),tail=url.pathname.slice('/api/games/auction-community'.length),db=env.DB as D1DatabaseLike;
  if(!tail){const query=communityQuery(url.searchParams);if(!query)return json({error:'Invalid community query'},400);return json(await auctionCommunityPage(db,query.view,query.cursor,env.AUTH_COMMUNITY_MODERATION_ENABLED==='true'))}
  if(url.search)return json({error:'Profile API does not accept query parameters'},400);
  const id=tail.slice(1);if(!publicProfileId(id))return json({error:'Showcase not found or private'},404);
  const profile=await publicAuctionProfile(db,id,env.AUTH_COMMUNITY_MODERATION_ENABLED==='true');return profile?json(profile):json({error:'Showcase not found or private'},404);
 }catch(cause){return json({error:cause instanceof Error&&cause.message==='Invalid community cursor'?'Invalid page cursor':'Community data is temporarily unavailable'},cause instanceof Error&&cause.message==='Invalid community cursor'?400:503)}
}
