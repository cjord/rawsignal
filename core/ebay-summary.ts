import type {EbayCardLanguage} from "./domain/marketplace-links.ts";
import type {EbayListingSample} from "./domain/types.ts";
import {ebayAffiliateUrl} from "./domain/marketplace-links.ts";

// Pure summary of an eBay Browse `item_summary/search` page (todo O2): the cheapest asks that
// survive a price guard around the TCGplayer market price, their median, and a few samples
// for the detail panel. Asks are listing prices — the AGENTS rule applies: never described
// as sales, never blended into fair value or signals.

export type EbayListingMatchTarget={kind:"single"|"sealed";game:string;name:string;set:string;number:string|null;language:EbayCardLanguage|null};
export type EbayListingSummary={
 listingCount:number;reviewedCount:number;acceptedCount:number;highConfidenceCount:number;
 lowestAsk:number|null;medianAsk:number|null;lowestDeliveredAsk:number|null;medianDeliveredAsk:number|null;
 deliveredQ1:number|null;deliveredQ3:number|null;belowMarketCount:number;nearMarketCount:number;
 freeShippingCount:number;bestOfferCount:number;samples:EbayListingSample[];
};

// Listings priced outside [¼×, 4×] the market price are lots, proxies, or mispriced and would
// otherwise set the low ask; below three survivors the asks are not a market and read N/A.
export const EBAY_PRICE_GUARD={min:0.25,max:4} as const;
export const EBAY_MIN_LISTINGS=3;
// The Browse request returns up to 200 item summaries. Retaining 100 lets
// the detail UI paginate locally without spending another eBay call.
export const EBAY_SAMPLE_COUNT=100;

const record=(value:unknown):value is Record<string,unknown>=>typeof value==="object"&&value!==null;
const money=(value:unknown):number|null=>{
 if(!record(value))return null;
 const amount=Number(value.value);
 if(!Number.isFinite(amount)||amount<0)return null;
 if(value.currency!=null&&value.currency!=="USD")return null;
 return amount;
};

type EbayAffiliateOptions={affiliateCampaignId?:string|number|null;affiliateReferenceId?:string|null};

const normalize=(value:string)=>value.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").replace(/\betb\b/g,"elite trainer box").replace(/\bupc\b/g,"ultra premium collection").replace(/\s+/g," ").trim();
const words=(value:string)=>normalize(value).split(" ").filter(Boolean);
const coreName=(value:string)=>value.replace(/\s+-\s+[\w/]+$/,"");
const SET_STOP=new Set(["the","and","of","tcg","cards","card","set","sv","swsh"]);
const GAME_MARKERS:Record<string,RegExp>={pokemon:/\bpokemon\b/i,riftbound:/\briftbound\b/i,onepiece:/\bone\s*piece\b/i};
const BAD_PRODUCT=/\b(?:proxy|proxies|orica|custom|fan\s*art|replica|reprint|digital|online\s+code|code\s+card|empty|no\s+packs?|wrapper|wrappers)\b/i;
const GRADED=/\b(?:psa|bgs|cgc|sgc|beckett|graded|slabbed?|gem\s*mint)\b/i;
const SINGLE_BULK=/\b(?:lots?|playsets?|bundles?|set\s+of\s+[2-9]|[2-9]\s*x|[2-9]x)\b/i;
const LANGUAGE_WORDS=["arabic","basque","bengali","catalan","chinese","czech","danish","dutch","english","finnish","french","german","greek","hindi","urdu","hungarian","italian","japanese","japan","korean","latin","malay","norwegian","polish","portuguese","russian","spanish","swedish","thai","vietnamese"];

const tokenCoverage=(haystack:Set<string>,needles:string[])=>needles.length?needles.filter(token=>haystack.has(token)).length/needles.length:0;
const explicitLanguage=(title:string)=>LANGUAGE_WORDS.find(language=>new RegExp(`\\b${language}\\b`,`i`).test(title))??null;
const targetLanguageWords=(language:EbayCardLanguage|null)=>language==="Japanese"?["japanese","japan"]:language?words(language):[];
const collectorNumber=(value:string|null)=>{
 const match=value?.match(/([a-z0-9-]{1,10})\s*\/\s*([a-z0-9-]{1,10})/i);
 return match?`${normalize(match[1])}/${normalize(match[2])}`:null;
};
const titleCollectorNumbers=(title:string)=>[...title.matchAll(/([a-z0-9-]{1,10})\s*\/\s*([a-z0-9-]{1,10})/gi)].map(match=>`${normalize(match[1])}/${normalize(match[2])}`);

function sealedTypeMatches(title:string,targetName:string){
 const target=normalize(targetName),candidate=normalize(title);
 if(/\bpokemon center\b/.test(target)!==/\bpokemon center\b/.test(candidate))return false;
 if(!target.includes("case")&&/\bcase\b/.test(candidate))return false;
 if(!/\b(?:box|display|case)\b/.test(target)&&/\b(?:booster\s+pack|sleeved\s+booster)\b/.test(target)&&/\b(?:box|display|case)\b/.test(candidate))return false;
 if(/\bbooster\s+bundle\b/.test(target)&&!/\b(?:display|case)\b/.test(target)&&/\b(?:display|case)\b/.test(candidate))return false;
 const families:[RegExp,RegExp][]=[
  [/\bcase\b/,/\bcase\b/],
  [/\bbooster\s+bundle\s+display\b/,/\bbooster\s+bundle\b.*\b(?:display|case)\b/],
  [/\b(?:elite\s+trainer\s+box|etb)\b/,/\b(?:elite\s+trainer\s+box|etb)\b/],
  [/\bbooster\s+(?:box|display)\b/,/\bbooster\s+(?:box|display)\b/],
  [/\b(?:booster\s+pack|sleeved\s+booster)\b/,/\b(?:booster\s+pack|sleeved\s+booster)\b/],
  [/\bbundle\b/,/\bbundle\b/],
  [/\bcollection\b/,/\bcollection\b/],
 ];
 const family=families.find(([pattern])=>pattern.test(target));
 return !family||family[1].test(candidate);
}

function listingExclusion(title:string,target:EbayListingMatchTarget):string|null{
 if(BAD_PRODUCT.test(title))return "excluded non-product listing";
 if(target.kind==="single"&&(GRADED.test(title)||SINGLE_BULK.test(title)))return "excluded graded or multi-card listing";
 if(target.kind==="sealed"&&!sealedTypeMatches(title,target.name))return "sealed product type mismatch";
 const isDifferentGame=Object.entries(GAME_MARKERS).some(([game,marker])=>game!==target.game&&marker.test(title));
 return isDifferentGame?"different game":null;
}

function identityEvidence(title:string,target:EbayListingMatchTarget){
 const namedLanguage=explicitLanguage(title),allowedLanguages=targetLanguageWords(target.language);
 const titleWords=new Set(words(title));
 const nameTokens=words(coreName(target.name)).filter(token=>!SET_STOP.has(token));
 const setTokens=words(target.set.replace(/^[a-z0-9.-]+:\s*/i,"")).filter(token=>!SET_STOP.has(token));
 const targetNumber=collectorNumber(target.number),numbers=titleCollectorNumbers(title);
 const numerator=targetNumber?.split("/")[0]??normalize(target.number??"");
 return {
  namedLanguage,allowedLanguages,titleWords,targetNumber,numbers,
  nameCoverage:tokenCoverage(titleWords,nameTokens),setCoverage:tokenCoverage(titleWords,setTokens),
  numberMatch:Boolean(targetNumber&&numbers.includes(targetNumber))||Boolean(numerator.length>=2&&(titleWords.has(numerator)||normalize(title).includes(numerator))),
 };
}

export function ebayListingMatch(title:string,target?:EbayListingMatchTarget):{accepted:boolean;confidence:"high"|"medium"|"low";reason:string}{
 if(!target)return {accepted:true,confidence:"medium",reason:"legacy query match"};
 const exclusion=listingExclusion(title,target);
 if(exclusion)return {accepted:false,confidence:"low",reason:exclusion};
 const evidence=identityEvidence(title,target);
 const {namedLanguage,allowedLanguages,nameCoverage,setCoverage,targetNumber,numbers,numberMatch}=evidence;
 if(namedLanguage&&target.language&&!allowedLanguages.includes(namedLanguage))return {accepted:false,confidence:"low",reason:"different language"};
 if(nameCoverage<0.67)return {accepted:false,confidence:"low",reason:"product name mismatch"};
 if(targetNumber&&numbers.length&&!numbers.includes(targetNumber))return {accepted:false,confidence:"low",reason:"collector number mismatch"};
 const languageMatch=Boolean(namedLanguage&&allowedLanguages.includes(namedLanguage));
 const identityAnchor=numberMatch||setCoverage>=0.5||target.kind==="sealed";
 if(!identityAnchor)return {accepted:false,confidence:"low",reason:"missing set or collector-number match"};
 const confidence=nameCoverage===1&&(numberMatch||setCoverage>=0.75)&&(target.language==="English"||!target.language||languageMatch)?"high":"medium";
 return {accepted:true,confidence,reason:confidence==="high"?"strong identity match":"partial identity match"};
}

const finiteNumber=(value:unknown):number|null=>{
 if(value==null||value==="")return null;
 const parsed=Number(value);
 return Number.isFinite(parsed)?parsed:null;
};
const stringValue=(value:unknown)=>typeof value==="string"?value:null;
const validImageUrl=(item:Record<string,unknown>)=>{
 const image=record(item.image)?stringValue(item.image.imageUrl):null;
 return image&&/^https:\/\//.test(image)?image:null;
};
const firstShippingCost=(item:Record<string,unknown>)=>{
 const shippingOptions=Array.isArray(item.shippingOptions)?item.shippingOptions:[];
 return shippingOptions.length?money(record(shippingOptions[0])?shippingOptions[0].shippingCost:null):null;
};
const listingUrl=(item:Record<string,unknown>,affiliate:EbayAffiliateOptions)=>{
 const affiliateUrl=stringValue(item.itemAffiliateWebUrl),itemUrl=stringValue(item.itemWebUrl);
 return affiliateUrl??(itemUrl?ebayAffiliateUrl(itemUrl,{campaignId:affiliate.affiliateCampaignId??undefined,referenceId:affiliate.affiliateReferenceId}):null);
};

export function parseEbayListing(item:unknown,affiliate:EbayAffiliateOptions&{target?:EbayListingMatchTarget}={}):EbayListingSample|null{
 if(!record(item))return null;
 const price=money(item.price);
 const itemId=stringValue(item.itemId),title=stringValue(item.title)?.trim()??"";
 if(price==null||!itemId||!title)return null;
 const match=ebayListingMatch(title,affiliate.target);
 if(!match.accepted)return null;
 const options=Array.isArray(item.buyingOptions)?item.buyingOptions.filter((value):value is string=>typeof value==="string"):null;
 if(options&&!options.includes("FIXED_PRICE"))return null;
 const url=listingUrl(item,affiliate);
 if(!url)return null;
 const shipping=firstShippingCost(item),imageUrl=validImageUrl(item);
 const seller=record(item.seller)?item.seller:null;
 const feedbackPercentage=finiteNumber(seller?.feedbackPercentage),feedbackScore=finiteNumber(seller?.feedbackScore),watchCount=finiteNumber(item.watchCount);
 const listedAt=stringValue(item.itemOriginDate)??stringValue(item.itemCreationDate),endsAt=stringValue(item.itemEndDate);
 const location=record(item.itemLocation)?item.itemLocation:null;
 return {itemId,title,price,shipping,deliveredPrice:shipping==null?null:Math.round((price+shipping)*100)/100,condition:stringValue(item.condition),imageUrl,url,
  buyingOptions:options??[],sellerFeedbackPercentage:feedbackPercentage,sellerFeedbackScore:feedbackScore,topRated:item.topRatedBuyingExperience===true,
  watchCount:watchCount!=null&&watchCount>=0?Math.floor(watchCount):null,listedAt,endsAt,locationCountry:stringValue(location?.country),matchConfidence:match.confidence==="high"?"high":"medium"};
}

export function priceGuard(market:number|null|undefined):{min:number;max:number}|null{
 if(market==null||!Number.isFinite(market)||market<=0)return null;
 return {min:Math.floor(market*EBAY_PRICE_GUARD.min*100)/100,max:Math.ceil(market*EBAY_PRICE_GUARD.max*100)/100};
}

const quantile=(sorted:number[],position:number)=>{
 if(!sorted.length)return null;
 const index=(sorted.length-1)*position,lower=Math.floor(index),upper=Math.ceil(index),value=sorted[lower]+(sorted[upper]-sorted[lower])*(index-lower);
 return Math.round(value*100)/100;
};

export function summarizeEbaySamples(samples:EbayListingSample[],total:number|null,options:{market?:number|null;reviewedCount?:number;minListings?:number}={}):EbayListingSummary{
 const minListings=options.minListings??EBAY_MIN_LISTINGS,market=options.market??null;
 const kept=[...samples].sort((a,b)=>a.price-b.price),prices=kept.map(item=>item.price),delivered=kept.map(item=>item.deliveredPrice??(item.shipping==null?null:Math.round((item.price+item.shipping)*100)/100)).filter((value):value is number=>value!=null).sort((a,b)=>a-b);
 const deliveredRelative=market&&market>0?delivered:[];
 const enough=kept.length>=minListings,listingCount=total!=null&&Number.isFinite(total)&&total>=kept.length?Math.floor(total):kept.length;
 return {listingCount,reviewedCount:options.reviewedCount??kept.length,acceptedCount:kept.length,highConfidenceCount:kept.filter(item=>item.matchConfidence==="high").length,
  lowestAsk:enough?prices[0]:null,medianAsk:enough?quantile(prices,.5):null,lowestDeliveredAsk:enough&&delivered.length>=minListings?delivered[0]:null,
  medianDeliveredAsk:enough&&delivered.length>=minListings?quantile(delivered,.5):null,deliveredQ1:enough&&delivered.length>=minListings?quantile(delivered,.25):null,
  deliveredQ3:enough&&delivered.length>=minListings?quantile(delivered,.75):null,belowMarketCount:market&&market>0?deliveredRelative.filter(price=>price<market).length:0,
  nearMarketCount:market&&market>0?deliveredRelative.filter(price=>Math.abs(price-market)/market<=.1).length:0,freeShippingCount:kept.filter(item=>item.shipping===0).length,
  bestOfferCount:kept.filter(item=>(item.buyingOptions??[]).includes("BEST_OFFER")).length,samples:kept};
}

export function summarizeEbayListings(items:unknown[],total:number|null,options:{market?:number|null;sampleCount?:number;minListings?:number;target?:EbayListingMatchTarget}&EbayAffiliateOptions={}):EbayListingSummary{
 const guard=priceGuard(options.market),sampleCount=options.sampleCount??EBAY_SAMPLE_COUNT,minListings=options.minListings??EBAY_MIN_LISTINGS;
 const kept=items.map(item=>parseEbayListing(item,options)).filter((item):item is EbayListingSample=>item!==null).filter(item=>!guard||(item.price>=guard.min&&item.price<=guard.max)).sort((a,b)=>a.price-b.price);
 const summary=summarizeEbaySamples(kept,total,{market:options.market,reviewedCount:items.length,minListings});
 return {...summary,samples:kept.slice(0,sampleCount)};
}
