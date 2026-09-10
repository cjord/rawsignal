import {EBAY_CONDITION_NEW,EBAY_CONDITION_UNGRADED,EbayAuthError,createEbayBrowseClient,type EbayCredentials} from "./ebay-browse.ts";
import {EBAY_CATEGORY_SINGLES,ebaySearchQuery} from "../domain/marketplace-links.ts";
import {priceGuard,summarizeEbayListings,type EbayListingSummary} from "../ebay-summary.ts";

export type EbayListingTarget={productId:number;kind:"single"|"sealed";game:string;name:string;set:string;number:string|null;marketCents:number|null};
export type EbayFetchResult={status:number;query:string;categoryId:number|null;summary:EbayListingSummary|null};
export type EbayListingsDeps={fetchListings(target:EbayListingTarget):Promise<EbayFetchResult>;wait?(ms:number):Promise<void>};

// One Browse search yields the complete grid snapshot. The product-scoped reference id lets
// EPN attribution be measured without exposing any credential or user identifier.
export function createEbayListingsDeps(credentials:EbayCredentials,fetcher:typeof fetch=fetch):EbayListingsDeps{
 const client=createEbayBrowseClient(credentials,{fetch:fetcher});
 return {async fetchListings(target){
  const query=ebaySearchQuery({kind:target.kind,game:target.game,name:target.name,set:target.set,number:target.number});
  const categoryId=target.kind==="single"?EBAY_CATEGORY_SINGLES:null;
  const market=target.marketCents==null?null:target.marketCents/100;
  try{
   const result=await client.search({query,categoryId,conditionIds:[target.kind==="single"?EBAY_CONDITION_UNGRADED:EBAY_CONDITION_NEW],priceRange:priceGuard(market),limit:50,affiliateReferenceId:`rawsignal-${target.productId}`});
   const ok=result.status>=200&&result.status<300;
   return {status:result.status,query,categoryId,summary:ok?summarizeEbayListings(result.items,result.total,{market}):null};
  }catch(error){
   if(error instanceof EbayAuthError)return {status:error.status===429?429:401,query,categoryId,summary:null};
   throw error;
  }
 }};
}
