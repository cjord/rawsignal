import type {AccountEnv} from './account-auth.ts';
import {accountEnabled} from './account-auth.ts';
import type {D1DatabaseLike} from '../db/repository.ts';
import {ownAuctionProfile,writePublicAuctionSettings,auctionCommunityPage,publicAuctionProfile} from '../db/auction-community.ts';
import {communityQuery,publicProfileId,validPublicSettings,auctionCommunityApi} from '../core/domain/auction-community.ts';
import type {GameMarket} from '../core/domain/game-profile.ts';
import {accountJson as json} from './account-http.ts';
import {boundedJson} from './bounded-json.ts';
import {communityLimit} from './community-limits.ts';
import {identityDatabase,sharedIdentity} from './account-identity.ts';
export const pokemonCommunityEnabled=(env:AccountEnv)=>env.POKEMON_AUCTION_COMMUNITY_ENABLED==='true'&&env.POKEMON_GAME_CATALOG_ENABLED==='true'&&env.AUTH_COMMUNITY_ENABLED==='true'&&env.AUTH_COMMUNITY_MODERATION_ENABLED==='true';
function visibilityRequest(body:unknown,userId:string){
 if(!body||typeof body!=='object'||Array.isArray(body))return {error:'invalid'} as const;
 const {owner,...value}=body as Record<string,unknown>;
 // Bind writes to the owner who reviewed the form, including across an
 // asynchronous cloud-save flush or a switch to another signed-in account.
 if(owner!==userId)return {error:'owner'} as const;
 return validPublicSettings(value)?{value}:{error:'invalid'} as const;
}
export async function handleOwnAuctionProfile(request:Request,env:AccountEnv,userId:string,market:GameMarket='riftbound'){
 if(env.AUTH_COMMUNITY_ENABLED!=='true'||market==='pokemon'&&!pokemonCommunityEnabled(env))return json({error:'Account showcases are not enabled yet'},503);
 const db=env.DB as D1DatabaseLike;
 if(request.method==='GET')return json(await ownAuctionProfile(db,userId,env.AUTH_COMMUNITY_MODERATION_ENABLED==='true',market));
 if(request.method!=='PUT')return json({error:'Method not allowed'},405);
 if(request.headers.get('Origin')!==new URL(env.AUTH_BASE_URL!).origin)return json({error:'Invalid origin'},403);
 const limited=await communityLimit(env,'write',userId);if(limited)return limited;
 let body;try{body=await boundedJson(request,1024)}catch{return json({error:'Invalid settings'},400)}
 const parsed=visibilityRequest(body,userId);
 if('error' in parsed)return parsed.error==='owner'?json({error:'The signed-in account changed. Reload before saving.',code:'OWNER_CHANGED'},401):json({error:'Choose explicit visibility settings. Public names are managed in Profile.'},400);
 const value=parsed.value;
 if((value.showcasePublic||value.leaderboardPublic)&&!(await ownAuctionProfile(db,userId,false,market)).displayName)return json({error:'Set your public username in Profile before publishing.',code:'USERNAME_REQUIRED'},409);
 return json(await writePublicAuctionSettings(db,userId,value,env.AUTH_COMMUNITY_MODERATION_ENABLED==='true',market));
}
function communityMarket(path:string):GameMarket|null{return (['riftbound','pokemon'] as const).find(market=>path===auctionCommunityApi(market)||path.startsWith(auctionCommunityApi(market)+'/'))??null;}
export const auctionCommunityPath=(path:string)=>communityMarket(path)!==null;
export async function handleAuctionCommunity(request:Request,env:AccountEnv){
 const url=new URL(request.url),market=communityMarket(url.pathname);if(!market)return json({error:'Not found'},404);
 if(!accountEnabled(env)||env.AUTH_COMMUNITY_ENABLED!=='true'||market==='pokemon'&&!pokemonCommunityEnabled(env))return json({error:'Auction community is not enabled in this environment'},503);
 if(request.method!=='GET')return json({error:'Method not allowed'},405);
 const limited=await communityLimit(env,'read',request.headers.get('cf-connecting-ip'));if(limited)return limited;
 try{
  const tail=url.pathname.slice(auctionCommunityApi(market).length),db=env.DB as D1DatabaseLike;
  const identity=sharedIdentity(env)?identityDatabase(env):undefined;
  if(!tail){const query=communityQuery(url.searchParams);if(!query)return json({error:'Invalid community query'},400);return json(await auctionCommunityPage(db,query.view,query.cursor,env.AUTH_COMMUNITY_MODERATION_ENABLED==='true',identity,market))}
  if(url.search)return json({error:'Profile API does not accept query parameters'},400);
  const id=tail.slice(1);if(!publicProfileId(id))return json({error:'Showcase not found or private'},404);
  const profile=await publicAuctionProfile(db,id,env.AUTH_COMMUNITY_MODERATION_ENABLED==='true',identity,market);return profile?json(profile):json({error:'Showcase not found or private'},404);
 }catch(cause){return json({error:cause instanceof Error&&cause.message==='Invalid community cursor'?'Invalid page cursor':'Community data is temporarily unavailable'},cause instanceof Error&&cause.message==='Invalid community cursor'?400:503)}
}
