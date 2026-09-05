import assert from "node:assert/strict";
import test from "node:test";
import {EBAY_MIN_LISTINGS,parseEbayListing,priceGuard,summarizeEbayListings} from "../core/ebay-summary.ts";

const listing=(itemId,price,overrides={})=>({itemId,title:`Listing ${itemId}`,price:{value:String(price),currency:"USD"},condition:"Ungraded",itemWebUrl:`https://www.ebay.com/itm/${itemId}`,buyingOptions:["FIXED_PRICE"],shippingOptions:[{shippingCost:{value:"4.50",currency:"USD"}}],...overrides});

test("a listing parses to a sample with its price, shipping, condition, and the affiliate URL when present",()=>{
 assert.deepEqual(parseEbayListing(listing("v1|1|0",27.99)),{itemId:"v1|1|0",title:"Listing v1|1|0",price:27.99,shipping:4.5,condition:"Ungraded",url:"https://www.ebay.com/itm/v1|1|0"});
 assert.equal(parseEbayListing(listing("a",10,{itemAffiliateWebUrl:"https://www.ebay.com/itm/a?campid=1"})).url,"https://www.ebay.com/itm/a?campid=1");
 assert.equal(parseEbayListing(listing("b",10,{shippingOptions:[]})).shipping,null);
 // Auctions, foreign currency, and malformed items are dropped.
 assert.equal(parseEbayListing(listing("c",10,{buyingOptions:["AUCTION"]})),null);
 assert.equal(parseEbayListing(listing("d",10,{price:{value:"10",currency:"GBP"}})),null);
 assert.equal(parseEbayListing({title:"no price"}),null);
 assert.equal(parseEbayListing(null),null);
});

test("the price guard brackets the market price and is absent without one",()=>{
 assert.deepEqual(priceGuard(100),{min:25,max:400});
 assert.deepEqual(priceGuard(27.9),{min:6.97,max:111.6});
 assert.equal(priceGuard(null),null);
 assert.equal(priceGuard(0),null);
});

test("the summary keeps guarded asks sorted, reports the lowest and median, and samples the cheapest",()=>{
 const items=[listing("lot",2,{title:"10x lot"}),listing("a",31),listing("b",25),listing("c",40),listing("d",900,{title:"PSA 10 proxy"}),listing("e",28)];
 const summary=summarizeEbayListings(items,42,{market:30,sampleCount:3});
 assert.equal(summary.listingCount,42);
 assert.equal(summary.lowestAsk,25);
 // Survivors 25, 28, 31, 40 → median 29.5.
 assert.equal(summary.medianAsk,29.5);
 assert.deepEqual(summary.samples.map(sample=>sample.itemId),["b","e","a"]);
 // An odd survivor count takes the middle ask; the total never reads below the survivors.
 assert.equal(summarizeEbayListings([listing("a",31),listing("b",25),listing("c",40)],null,{market:30}).medianAsk,31);
 assert.equal(summarizeEbayListings([listing("a",31),listing("b",25),listing("c",40)],1,{market:30}).listingCount,3);
});

test("fewer than three surviving listings is not a market: count only, asks unavailable",()=>{
 assert.equal(EBAY_MIN_LISTINGS,3);
 const thin=summarizeEbayListings([listing("a",31),listing("b",25)],2,{market:30});
 assert.deepEqual(thin,{listingCount:2,lowestAsk:null,medianAsk:null,samples:[]});
 assert.deepEqual(summarizeEbayListings([],0,{market:30}),{listingCount:0,lowestAsk:null,medianAsk:null,samples:[]});
});
