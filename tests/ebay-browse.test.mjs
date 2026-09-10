import assert from "node:assert/strict";
import test from "node:test";
import {EBAY_SCOPE,EBAY_SEARCH_URL,EBAY_TOKEN_URL,createEbayBrowseClient,ebaySearchParams} from "../core/clients/ebay-browse.ts";
import {createEbayListingsDeps} from "../core/clients/ebay-listings.ts";

// A fake eBay: the token endpoint and the search endpoint, recording every request so the
// client's auth, headers, caching, and retry are checked without a network.
function fakeEbay(options={}){
 const requests=[];let tokens=0;
 const fetcher=async(url,init={})=>{
  requests.push({url:String(url),init});
  if(String(url)===EBAY_TOKEN_URL){tokens++;if(options.tokenStatus&&options.tokenStatus!==200)return new Response("{}",{status:options.tokenStatus});return Response.json({access_token:`tok${tokens}`,expires_in:7200,token_type:"Application Access Token"})}
  const status=options.searchStatus?.(requests.length)??200;
  if(status!==200)return new Response("{}",{status});
  return Response.json({total:12,itemSummaries:[{itemId:"v1|1|0",title:"Card",price:{value:"20.00",currency:"USD"},itemWebUrl:"https://www.ebay.com/itm/1"}]});
 };
 return {fetcher,requests,tokens:()=>tokens};
}

test("search parameters carry the query, category, language aspect, condition and price filters, and a bounded limit",()=>{
 const params=ebaySearchParams({query:"Crispin SV: Prismatic Evolutions 171",categoryId:183454,language:"English",conditionIds:[4000],priceRange:{min:6.97,max:111.6},limit:500});
 assert.equal(params.get("q"),"Crispin SV: Prismatic Evolutions 171");
 assert.equal(params.get("category_ids"),"183454");
 assert.equal(params.get("aspect_filter"),"categoryId:183454,Language:{English}");
 assert.equal(params.get("filter"),"buyingOptions:{FIXED_PRICE},priceCurrency:USD,conditionIds:{4000},price:[6.97..111.60]");
 assert.equal(params.get("sort"),"price");
 assert.equal(params.get("limit"),"200");
 const sealed=ebaySearchParams({query:"Booster Box",categoryId:null,conditionIds:[],priceRange:null});
 assert.equal(sealed.get("category_ids"),null);
 assert.equal(sealed.get("aspect_filter"),null);
 assert.equal(sealed.get("filter"),"buyingOptions:{FIXED_PRICE},priceCurrency:USD");
 assert.equal(sealed.get("limit"),"50");
});

test("the client mints one application token, reuses it, and sends the marketplace and affiliate headers",async()=>{
 const ebay=fakeEbay();let now=1_000_000;
 const client=createEbayBrowseClient({clientId:"id",clientSecret:"secret",campaignId:"5338000000"},{fetch:ebay.fetcher,now:()=>now});
 const first=await client.search({query:"Pikachu",categoryId:183454,conditionIds:[4000],priceRange:null,affiliateReferenceId:"rawsignal-25"});
 assert.deepEqual({status:first.status,total:first.total,items:first.items.length},{status:200,total:12,items:1});
 const [mint,search]=ebay.requests;
 assert.equal(mint.init.method,"POST");
 assert.equal(mint.init.headers.Authorization,`Basic ${btoa("id:secret")}`);
 assert.equal(new URLSearchParams(mint.init.body).get("grant_type"),"client_credentials");
 assert.equal(new URLSearchParams(mint.init.body).get("scope"),EBAY_SCOPE);
 assert.ok(search.url.startsWith(`${EBAY_SEARCH_URL}?`));
 assert.equal(search.init.headers.Authorization,"Bearer tok1");
 assert.equal(search.init.headers["X-EBAY-C-MARKETPLACE-ID"],"EBAY_US");
 assert.equal(search.init.headers["X-EBAY-C-ENDUSERCTX"],"affiliateCampaignId=5338000000,affiliateReferenceId=rawsignal-25");
 // Within the token's lifetime the second search reuses it; past it a new one is minted.
 now+=3_600_000;await client.search({query:"Pikachu",categoryId:null,conditionIds:[],priceRange:null});
 assert.equal(ebay.tokens(),1);
 now+=3_600_000;await client.search({query:"Pikachu",categoryId:null,conditionIds:[],priceRange:null});
 assert.equal(ebay.tokens(),2);
 assert.equal(ebay.requests.at(-1).init.headers.Authorization,"Bearer tok2");
});

test("the listings adapter resolves a Japanese promo and sends the Japanese language aspect",async()=>{
 const ebay=fakeEbay();
 const deps=createEbayListingsDeps({clientId:"id",clientSecret:"secret"},ebay.fetcher);
 const result=await deps.fetchListings({productId:257103,kind:"single",game:"pokemon",name:"Pikachu - 227/S-P",set:"Sword & Shield Promo Cards",number:"227/S-P",section:"japanese-promos",marketCents:5000});
 assert.equal(result.status,200);
 const search=ebay.requests.find(request=>request.url.startsWith(EBAY_SEARCH_URL));
 assert.equal(new URL(search.url).searchParams.get("aspect_filter"),"categoryId:183454,Language:{Japanese}");
 assert.equal(search.init.headers["X-EBAY-C-ENDUSERCTX"],"affiliateCampaignId=5339205908,affiliateReferenceId=rawsignal-257103");
 assert.equal(new URL(result.summary.samples[0].url).searchParams.get("campid"),"5339205908");
 assert.equal(new URL(result.summary.samples[0].url).searchParams.get("customid"),"rawsignal-257103");
});

test("a 401 re-mints once and retries; other failures report their status with no items; a token failure throws",async()=>{
 const ebay=fakeEbay({searchStatus:count=>count===2?401:200});
 const client=createEbayBrowseClient({clientId:"id",clientSecret:"secret"},{fetch:ebay.fetcher});
 const result=await client.search({query:"Pikachu",categoryId:null,conditionIds:[],priceRange:null});
 assert.equal(result.status,200);
 assert.equal(ebay.tokens(),2);
 assert.equal(ebay.requests.at(-1).init.headers["X-EBAY-C-ENDUSERCTX"],undefined);
 const limited=fakeEbay({searchStatus:()=>429});
 const limitedResult=await createEbayBrowseClient({clientId:"id",clientSecret:"secret"},{fetch:limited.fetcher}).search({query:"x",categoryId:null,conditionIds:[],priceRange:null});
 assert.deepEqual(limitedResult,{status:429,total:null,items:[]});
 const denied=fakeEbay({tokenStatus:401});
 await assert.rejects(createEbayBrowseClient({clientId:"id",clientSecret:"bad"},{fetch:denied.fetcher}).search({query:"x",categoryId:null,conditionIds:[],priceRange:null}),error=>error.name==="EbayAuthError"&&error.status===401);
});
