import assert from "node:assert/strict";
import test from "node:test";
import {EBAY_MIN_LISTINGS,EBAY_SAMPLE_COUNT,ebayListingMatch,parseEbayListing,priceGuard,summarizeEbayListings} from "../core/ebay-summary.ts";
import {ebayAffiliateUrl} from "../core/domain/marketplace-links.ts";

const listing=(itemId,price,overrides={})=>({itemId,title:`Listing ${itemId}`,price:{value:String(price),currency:"USD"},condition:"Ungraded",itemWebUrl:`https://www.ebay.com/itm/${itemId}`,image:{imageUrl:`https://i.ebayimg.com/images/g/${itemId}/s-l500.jpg`},buyingOptions:["FIXED_PRICE"],shippingOptions:[{shippingCost:{value:"4.50",currency:"USD"}}],...overrides});

test("a listing parses to a sample with its price, shipping, condition, and the affiliate URL when present",()=>{
 const parsed=parseEbayListing(listing("v1|1|0",27.99,{buyingOptions:["FIXED_PRICE","BEST_OFFER"],seller:{feedbackPercentage:"99.8",feedbackScore:1234},topRatedBuyingExperience:true,watchCount:17,itemOriginDate:"2026-08-01T00:00:00Z",itemEndDate:"2026-10-01T00:00:00Z",itemLocation:{country:"US"}}));
 assert.deepEqual({itemId:parsed.itemId,title:parsed.title,price:parsed.price,shipping:parsed.shipping,deliveredPrice:parsed.deliveredPrice,condition:parsed.condition,imageUrl:parsed.imageUrl,url:parsed.url},{itemId:"v1|1|0",title:"Listing v1|1|0",price:27.99,shipping:4.5,deliveredPrice:32.49,condition:"Ungraded",imageUrl:"https://i.ebayimg.com/images/g/v1|1|0/s-l500.jpg",url:ebayAffiliateUrl("https://www.ebay.com/itm/v1|1|0")});
 assert.deepEqual({buyingOptions:parsed.buyingOptions,sellerFeedbackPercentage:parsed.sellerFeedbackPercentage,sellerFeedbackScore:parsed.sellerFeedbackScore,topRated:parsed.topRated,watchCount:parsed.watchCount,listedAt:parsed.listedAt,endsAt:parsed.endsAt,locationCountry:parsed.locationCountry,matchConfidence:parsed.matchConfidence},{buyingOptions:["FIXED_PRICE","BEST_OFFER"],sellerFeedbackPercentage:99.8,sellerFeedbackScore:1234,topRated:true,watchCount:17,listedAt:"2026-08-01T00:00:00Z",endsAt:"2026-10-01T00:00:00Z",locationCountry:"US",matchConfidence:"medium"});
 assert.equal(parseEbayListing(listing("a",10,{itemAffiliateWebUrl:"https://www.ebay.com/itm/a?campid=1"})).url,"https://www.ebay.com/itm/a?campid=1");
 const fallback=parseEbayListing(listing("tracked",10),{affiliateCampaignId:"5338000000",affiliateReferenceId:"rawsignal-tracked"});
 assert.equal(new URL(fallback.url).searchParams.get("campid"),"5338000000");
 assert.equal(new URL(fallback.url).searchParams.get("customid"),"rawsignal-tracked");
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
 assert.equal(summary.acceptedCount,4);
 assert.equal(summary.lowestAsk,25);
 // Survivors 25, 28, 31, 40 → median 29.5.
 assert.equal(summary.medianAsk,29.5);
 assert.equal(summary.medianDeliveredAsk,34);
 assert.equal(summary.belowMarketCount,1);
 assert.equal(summary.nearMarketCount,2);
 assert.equal(summary.freeShippingCount,0);
 assert.deepEqual(summary.samples.map(sample=>sample.itemId),["b","e","a"]);
 // An odd survivor count takes the middle ask; the total never reads below the survivors.
 assert.equal(summarizeEbayListings([listing("a",31),listing("b",25),listing("c",40)],null,{market:30}).medianAsk,31);
 assert.equal(summarizeEbayListings([listing("a",31),listing("b",25),listing("c",40)],1,{market:30}).listingCount,3);
});

test("the default sample keeps the full first Browse page for zero-call client pagination",()=>{
 const items=Array.from({length:105},(_,index)=>listing(String(index+1),25+index/10));
 const summary=summarizeEbayListings(items,105,{market:30});
 assert.equal(EBAY_SAMPLE_COUNT,100);
 assert.equal(summary.acceptedCount,105);
 assert.equal(summary.samples.length,100);
 assert.deepEqual(summary.samples.slice(-2).map(sample=>sample.itemId),["99","100"]);
});

test("fewer than three surviving listings is not a market: count only, asks unavailable",()=>{
 assert.equal(EBAY_MIN_LISTINGS,3);
 const thin=summarizeEbayListings([listing("a",31),listing("b",25)],2,{market:30});
 assert.deepEqual({listingCount:thin.listingCount,acceptedCount:thin.acceptedCount,lowestAsk:thin.lowestAsk,medianAsk:thin.medianAsk},{listingCount:2,acceptedCount:2,lowestAsk:null,medianAsk:null});
 assert.deepEqual(thin.samples,[parseEbayListing(listing("b",25)),parseEbayListing(listing("a",31))]);
 const empty=summarizeEbayListings([],0,{market:30});
 assert.deepEqual({listingCount:empty.listingCount,acceptedCount:empty.acceptedCount,lowestAsk:empty.lowestAsk,medianAsk:empty.medianAsk,samples:empty.samples},{listingCount:0,acceptedCount:0,lowestAsk:null,medianAsk:null,samples:[]});
});

test("matching rejects graded, lot, language, number, game, and sealed-unit mismatches",()=>{
 const single={kind:"single",game:"pokemon",name:"Charizard ex - 199/165",set:"Scarlet & Violet 151",number:"199/165",language:"English"};
 assert.equal(ebayListingMatch("Pokemon Charizard ex 199/165 Scarlet Violet 151 NM",single).confidence,"high");
 for(const title of ["PSA 10 Charizard ex 199/165","Pokemon Charizard ex 199/165 lot of 3","Japanese Pokemon Charizard ex 199/165","Pokemon Charizard ex 198/165","Riftbound Charizard ex 199/165"])
  assert.equal(ebayListingMatch(title,single).accepted,false,title);
 assert.equal(ebayListingMatch("Pokemon Charizard ex",single).accepted,false);
 const sealed={kind:"sealed",game:"pokemon",name:"Destined Rivals Booster Box",set:"Destined Rivals",number:null,language:null};
 assert.equal(ebayListingMatch("Pokemon Destined Rivals Booster Box Factory Sealed",sealed).accepted,true);
 assert.equal(ebayListingMatch("Pokemon Destined Rivals Booster Pack",sealed).accepted,false);
 assert.equal(ebayListingMatch("Pokemon Destined Rivals Booster Box Empty Display",sealed).accepted,false);
 const bundle={...sealed,name:"Prismatic Evolutions Booster Bundle",set:"Prismatic Evolutions"};
 assert.equal(ebayListingMatch("Pokemon Prismatic Evolutions Booster Bundle",bundle).accepted,true);
 assert.equal(ebayListingMatch("Pokemon Prismatic Evolutions Booster Bundle Display",bundle).accepted,false);
 const center={...sealed,name:"Prismatic Evolutions Elite Trainer Box (Pokemon Center)",set:"Prismatic Evolutions"};
 assert.equal(ebayListingMatch("Pokemon Prismatic Evolutions Pokemon Center ETB",center).accepted,true);
 assert.equal(ebayListingMatch("Pokemon Prismatic Evolutions ETB",center).accepted,false);
 assert.equal(ebayListingMatch("Pokemon Prismatic Evolutions Pokemon Center ETB",{...center,name:"Prismatic Evolutions Elite Trainer Box"}).accepted,false);
 const promo={...single,name:"Pikachu",set:"Scarlet & Violet Promos",number:"SVP 001"};
 assert.equal(ebayListingMatch("Pokemon Pikachu SVP 001 English Promo",promo).accepted,true);
});
