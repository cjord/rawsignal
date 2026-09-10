// eBay Browse API client (todo O2): an application token from the client-credentials grant
// (valid 7,200 s, cached per isolate) and `item_summary/search` for a product's active
// listings. The default production keyset allows 5,000 Browse calls a day; the rotation in
// db/ebay-ingestion.ts spends a fraction of that. Flag from the plan: the affiliate context
// header (`X-EBAY-C-ENDUSERCTX: affiliateCampaignId=…`) is set only when a campaign id is
// configured — confirm its syntax against the Browse reference when the EPN account exists.

import type {EbayCardLanguage} from "../domain/marketplace-links.ts";

export type EbayCredentials={clientId:string;clientSecret:string;campaignId?:string|null};
export type EbaySearchRequest={query:string;categoryId:number|null;conditionIds:number[];priceRange:{min:number;max:number}|null;language?:EbayCardLanguage|null;limit?:number;affiliateReferenceId?:string};
export type EbaySearchResult={status:number;total:number|null;items:unknown[]};
export type EbayBrowseDeps={fetch?:typeof fetch;now?:()=>number};

export const EBAY_TOKEN_URL="https://api.ebay.com/identity/v1/oauth2/token";
export const EBAY_SEARCH_URL="https://api.ebay.com/buy/browse/v1/item_summary/search";
export const EBAY_SCOPE="https://api.ebay.com/oauth/api_scope";
export const EBAY_MARKETPLACE="EBAY_US";
// eBay's trading-card conditions: 4000 = Ungraded, 2750 = Graded; sealed product lists as New.
export const EBAY_CONDITION_UNGRADED=4000;
export const EBAY_CONDITION_NEW=1000;
const TOKEN_REFRESH_MARGIN_MS=60_000;

export function ebaySearchParams(request:EbaySearchRequest):URLSearchParams{
 const filter=["buyingOptions:{FIXED_PRICE}","priceCurrency:USD"];
 if(request.conditionIds.length)filter.push(`conditionIds:{${request.conditionIds.join("|")}}`);
 if(request.priceRange)filter.push(`price:[${request.priceRange.min.toFixed(2)}..${request.priceRange.max.toFixed(2)}]`);
 const params=new URLSearchParams({q:request.query,filter:filter.join(","),sort:"price",limit:String(Math.max(1,Math.min(200,request.limit??50)))});
 if(request.categoryId!=null){
  params.set("category_ids",String(request.categoryId));
  if(request.language)params.set("aspect_filter",`categoryId:${request.categoryId},Language:{${request.language}}`);
 }
 return params;
}

export function createEbayBrowseClient(credentials:EbayCredentials,deps:EbayBrowseDeps={}){
 const fetcher=deps.fetch??fetch,now=deps.now??(()=>Date.now());
 let token:{value:string;expiresAt:number}|null=null;
 async function mint():Promise<string>{
  const response=await fetcher(EBAY_TOKEN_URL,{method:"POST",headers:{Authorization:`Basic ${btoa(`${credentials.clientId}:${credentials.clientSecret}`)}`,"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"client_credentials",scope:EBAY_SCOPE}).toString()});
  if(!response.ok)throw new EbayAuthError(response.status);
  const body=await response.json() as {access_token?:unknown;expires_in?:unknown};
  if(typeof body.access_token!=="string")throw new EbayAuthError(response.status);
  const lifetime=Number(body.expires_in);
  token={value:body.access_token,expiresAt:now()+(Number.isFinite(lifetime)?lifetime*1000:7_200_000)};
  return token.value;
 }
 async function bearer(){return token&&token.expiresAt-TOKEN_REFRESH_MARGIN_MS>now()?token.value:mint()}
 return {
  async search(request:EbaySearchRequest,retried=false):Promise<EbaySearchResult>{
   const headers:Record<string,string>={Authorization:`Bearer ${await bearer()}`,Accept:"application/json","X-EBAY-C-MARKETPLACE-ID":EBAY_MARKETPLACE};
   if(credentials.campaignId){
    const reference=request.affiliateReferenceId?`,affiliateReferenceId=${encodeURIComponent(request.affiliateReferenceId)}`:"";
    headers["X-EBAY-C-ENDUSERCTX"]=`affiliateCampaignId=${credentials.campaignId}${reference}`;
   }
   const response=await fetcher(`${EBAY_SEARCH_URL}?${ebaySearchParams(request)}`,{headers});
   // An expired or revoked token answers 401 once; re-mint and retry a single time.
   if(response.status===401&&!retried){token=null;return this.search(request,true)}
   if(!response.ok)return {status:response.status,total:null,items:[]};
   const body=await response.json().catch(()=>null) as {total?:unknown;itemSummaries?:unknown}|null;
   const total=Number(body?.total);
   return {status:response.status,total:Number.isFinite(total)?total:null,items:Array.isArray(body?.itemSummaries)?body!.itemSummaries as unknown[]:[]};
  },
 };
}

export class EbayAuthError extends Error{
 status:number;
 constructor(status:number){super(`eBay token request failed: HTTP ${status}`);this.name="EbayAuthError";this.status=status}
}
