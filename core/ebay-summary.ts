import type {EbayListingSample} from "./domain/types.ts";
import {ebayAffiliateUrl} from "./domain/marketplace-links.ts";

// Pure summary of an eBay Browse `item_summary/search` page (todo O2): the cheapest asks that
// survive a price guard around the TCGplayer market price, their median, and a few samples
// for the detail panel. Asks are listing prices — the AGENTS rule applies: never described
// as sales, never blended into fair value or signals.

export type EbayListingSummary={listingCount:number;acceptedCount:number;lowestAsk:number|null;medianAsk:number|null;samples:EbayListingSample[]};

// Listings priced outside [¼×, 4×] the market price are lots, proxies, or mispriced and would
// otherwise set the low ask; below three survivors the asks are not a market and read N/A.
export const EBAY_PRICE_GUARD={min:0.25,max:4} as const;
export const EBAY_MIN_LISTINGS=3;
export const EBAY_SAMPLE_COUNT=5;

const record=(value:unknown):value is Record<string,unknown>=>typeof value==="object"&&value!==null;
const money=(value:unknown):number|null=>{
 if(!record(value))return null;
 const amount=Number(value.value);
 if(!Number.isFinite(amount)||amount<0)return null;
 if(value.currency!=null&&value.currency!=="USD")return null;
 return amount;
};

type EbayAffiliateOptions={affiliateCampaignId?:string|number|null;affiliateReferenceId?:string|null};

export function parseEbayListing(item:unknown,affiliate:EbayAffiliateOptions={}):EbayListingSample|null{
 if(!record(item))return null;
 const price=money(item.price);
 const itemId=typeof item.itemId==="string"?item.itemId:null,title=typeof item.title==="string"?item.title.trim():"";
 if(price==null||!itemId||!title)return null;
 const options=Array.isArray(item.buyingOptions)?item.buyingOptions:null;
 if(options&&!options.includes("FIXED_PRICE"))return null;
 // The affiliate URL (EPN campaign on the request, todo O1) wins when the API returns one.
 const affiliateUrl=typeof item.itemAffiliateWebUrl==="string"?item.itemAffiliateWebUrl:null;
 const itemUrl=typeof item.itemWebUrl==="string"?item.itemWebUrl:null;
 const url=affiliateUrl??(itemUrl?ebayAffiliateUrl(itemUrl,{campaignId:affiliate.affiliateCampaignId??undefined,referenceId:affiliate.affiliateReferenceId}):null);
 if(!url)return null;
 const shippingOptions=Array.isArray(item.shippingOptions)?item.shippingOptions:[];
 const shipping=shippingOptions.length?money(record(shippingOptions[0])?shippingOptions[0].shippingCost:null):null;
 const image=record(item.image)&&typeof item.image.imageUrl==="string"?item.image.imageUrl:null;
 const imageUrl=image&&/^https:\/\//.test(image)?image:null;
 return {itemId,title,price,shipping,condition:typeof item.condition==="string"?item.condition:null,imageUrl,url};
}

export function priceGuard(market:number|null|undefined):{min:number;max:number}|null{
 if(market==null||!Number.isFinite(market)||market<=0)return null;
 return {min:Math.floor(market*EBAY_PRICE_GUARD.min*100)/100,max:Math.ceil(market*EBAY_PRICE_GUARD.max*100)/100};
}

export function summarizeEbayListings(items:unknown[],total:number|null,options:{market?:number|null;sampleCount?:number;minListings?:number}&EbayAffiliateOptions={}):EbayListingSummary{
 const guard=priceGuard(options.market),sampleCount=options.sampleCount??EBAY_SAMPLE_COUNT,minListings=options.minListings??EBAY_MIN_LISTINGS;
 const kept=items.map(item=>parseEbayListing(item,options)).filter((item):item is EbayListingSample=>item!==null).filter(item=>!guard||(item.price>=guard.min&&item.price<=guard.max)).sort((a,b)=>a.price-b.price);
 const listingCount=total!=null&&Number.isFinite(total)&&total>=kept.length?Math.floor(total):kept.length;
 if(kept.length<minListings)return {listingCount,acceptedCount:kept.length,lowestAsk:null,medianAsk:null,samples:kept.slice(0,sampleCount)};
 const mid=Math.floor(kept.length/2),medianAsk=kept.length%2?kept[mid].price:(kept[mid-1].price+kept[mid].price)/2;
 return {listingCount,acceptedCount:kept.length,lowestAsk:kept[0].price,medianAsk:Math.round(medianAsk*100)/100,samples:kept.slice(0,sampleCount)};
}
