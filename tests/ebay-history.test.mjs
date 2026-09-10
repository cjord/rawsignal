import assert from "node:assert/strict";
import test from "node:test";
import {ebayListingDeltas,summarizeEbayAskHistory} from "../core/ebay-history.ts";

const point=(date,median,accepted,extra={})=>({observedDate:date.slice(0,10),observedAt:date,referenceMarketPrice:30,listingCount:accepted,reviewedCount:accepted,acceptedCount:accepted,lowestAsk:median-3,medianAsk:median-1,lowestDeliveredAsk:median-2,medianDeliveredAsk:median,deliveredQ1:median-1,deliveredQ3:median+1,belowMarketCount:1,nearMarketCount:2,freeShippingCount:1,bestOfferCount:1,newListingCount:null,missingListingCount:null,priceReductionCount:null,...extra});
const sample=(itemId,price,shipping=0)=>({itemId,title:itemId,price,shipping,deliveredPrice:price+shipping,condition:null,imageUrl:null,url:`https://www.ebay.com/itm/${itemId}`,buyingOptions:[],sellerFeedbackPercentage:null,sellerFeedbackScore:null,topRated:false,watchCount:null,listedAt:null,endsAt:null,locationCountry:null,matchConfidence:"high"});

test("history changes use the nearest observation at or before each cutoff",()=>{
 const points=[point("2026-08-01T12:00:00Z",20,10),point("2026-08-11T12:00:00Z",25,13),point("2026-09-01T12:00:00Z",30,12,{newListingCount:3,missingListingCount:6,priceReductionCount:2})];
 assert.deepEqual(summarizeEbayAskHistory(points,new Date("2026-09-01T12:00:00Z")),{change7:20,change30:50,supplyChange7:-1,supplyChange30:2,newListings:3,missingListings:6,priceReductions:2});
 assert.deepEqual(summarizeEbayAskHistory(points.slice(-1)),{change7:null,change30:null,supplyChange7:null,supplyChange30:null,newListings:3,missingListings:6,priceReductions:2});
});

test("listing deltas describe sample turnover and reductions without calling removals sales",()=>{
 assert.deepEqual(ebayListingDeltas(null,[sample("a",20)]),{newListingCount:null,missingListingCount:null,priceReductionCount:null});
 assert.deepEqual(ebayListingDeltas([sample("a",20),sample("b",30)],[sample("a",18),sample("c",25)]),{newListingCount:1,missingListingCount:1,priceReductionCount:1});
});
