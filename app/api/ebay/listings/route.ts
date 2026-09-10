import {env} from "cloudflare:workers";
import {NextResponse} from "next/server";
import {createEbayListingsDeps,type EbayListingsDeps} from "../../../../core/clients/ebay-listings.ts";
import {EBAY_EPN_CAMPAIGN_ID} from "../../../../core/domain/marketplace-links.ts";
import {readEbayListingHistory,resolveEbayListing} from "../../../../db/ebay-ingestion.ts";
import type {D1DatabaseLike} from "../../../../db/repository.ts";

const headers={"Cache-Control":"private, no-store"};
const json=(body:unknown,status=200,extra:Record<string,string>={})=>NextResponse.json(body,{status,headers:{...headers,...extra}});
const historyFor=async(db:D1DatabaseLike,productId:number)=>{
 try{return await readEbayListingHistory(db,productId)}
 catch(error){console.error(JSON.stringify({event:"ebay_listing_history_read_failed",productId,message:error instanceof Error?error.message:"Unknown failure"}));return {points:[]}}
};
// Configuration and the application-token cache are safe to share within one isolate. No
// request or user state enters this singleton, and a new Worker version gets a new isolate.
let listingDeps:EbayListingsDeps|null=null;

export async function GET(request:Request){
 const productId=new URL(request.url).searchParams.get("productId")??"";
 if(!/^\d{1,9}$/.test(productId)||Number(productId)<1)return json({error:"Invalid product id"},400);
 const bindings=env as unknown as {DB?:D1DatabaseLike;EBAY_CLIENT_ID?:string;EBAY_CLIENT_SECRET?:string;EBAY_EPN_CAMPAIGN_ID?:string};
 if(!bindings.DB)return json({error:"Listing cache unavailable"},503);
 if(!bindings.EBAY_CLIENT_ID||!bindings.EBAY_CLIENT_SECRET)return json({error:"eBay listings are not configured"},503);
 try{
  listingDeps??=createEbayListingsDeps({clientId:bindings.EBAY_CLIENT_ID,clientSecret:bindings.EBAY_CLIENT_SECRET,campaignId:bindings.EBAY_EPN_CAMPAIGN_ID??String(EBAY_EPN_CAMPAIGN_ID)});
  const result=await resolveEbayListing(bindings.DB,Number(productId),listingDeps);
  if(result.status==="fresh"||result.status==="refreshed")return json({...result,history:await historyFor(bindings.DB,Number(productId))});
  if(result.status==="not-found")return json({error:"Product not found"},404);
  if(result.status==="busy")return json(result,202,{"Retry-After":"1"});
  if(result.status==="quota")return json(result,429,{"Retry-After":"3600"});
  if(result.status==="upstream-error"){
   const status=result.upstreamStatus===401||result.upstreamStatus===403?503:result.upstreamStatus===429?429:502;
   return json(result,status,result.upstreamStatus===429?{"Retry-After":"60"}:{});
  }
  return json({error:"Unexpected eBay listing state"},503);
 }catch(error){
  console.error(JSON.stringify({event:"ebay_listing_request_failed",productId:Number(productId),message:error instanceof Error?error.message:"Unknown failure"}));
  return json({error:"eBay listings are temporarily unavailable"},503);
 }
}
