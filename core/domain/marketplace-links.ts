import {exactTcgplayerUrl} from "./detail.ts";
import type {HistoryMetric} from "./types.ts";

// Outbound marketplace links (todo O1–O3), built in one place so every surface — hover tiles,
// detail-page buttons, the eBay panel — agrees on the URL for a product.
//
// TCGplayer: the catalog's exact product URL when the row carries one (every D1 row does), else
// the canonical id form, which TCGplayer redirects to the slug URL. eBay: a search over the
// product's name, set, and card number; the sold-listings variant adds eBay's sold/completed
// filters (eBay asks signed-out visitors to sign in for those since late August 2026).
//
// TCGplayer affiliate (O1, 2026-09-09): every TCGplayer link is the Impact tracking link with
// the product page as its `u` deep-link target, so clicks attribute to the partner account and
// still land on the exact product. Anchors that carry it use rel="sponsored"; the footers
// carry the disclosure.
//
// eBay affiliate (O1, 2026-09-09): eBay Partner Network Smart Links. The root layout loads
// EPN's script with this campaign id, and it rewrites every ebay.com link on the page to the
// campaign at click time — so the search URLs below stay plain and readable, and the Browse
// client's affiliate header uses the same id for its item URLs. eBay anchors also carry
// rel="sponsored" and the disclosure names eBay.

export const TCGPLAYER_PRODUCT_BASE="https://www.tcgplayer.com/product/";
export const TCGPLAYER_AFFILIATE_BASE="https://partner.tcgplayer.com/c/7677898/1780961/21018";
export const EBAY_EPN_CAMPAIGN_ID=5339205908;
export const EBAY_EPN_MARKET_ID="711-53200-19255-0";
export const EBAY_EPN_TOOL_ID=10001;
export const EBAY_SMART_LINKS_SRC="https://epnt.ebay.com/static/epn-smart-tools.js";

// The raw product page (no tracking) — what the affiliate link deep-links to.
export function tcgplayerProductPage(productId:number,sourceUrl?:string|null):string{
 if(sourceUrl&&exactTcgplayerUrl(sourceUrl))return sourceUrl;
 return `${TCGPLAYER_PRODUCT_BASE}${productId}`;
}

export function tcgplayerAffiliateUrl(target:string):string{
 return `${TCGPLAYER_AFFILIATE_BASE}?u=${encodeURIComponent(target)}`;
}

// A direct EPN link keeps attribution when Smart Links is blocked or has not initialized.
// URLSearchParams also makes this idempotent: an already tagged eBay URL keeps one value for
// every tracking field. Smart Links remains in the root layout as a catch-all for future links.
export function ebayAffiliateUrl(target:string,options:{campaignId?:string|number;referenceId?:string|null}={}):string{
 let url:URL;
 try{url=new URL(target)}catch{return target}
 if(url.protocol!=="https:"||!/(^|\.)ebay\.com$/i.test(url.hostname))return target;
 url.searchParams.set("mkevt","1");
 url.searchParams.set("mkcid","1");
 url.searchParams.set("mkrid",EBAY_EPN_MARKET_ID);
 url.searchParams.set("campid",String(options.campaignId??EBAY_EPN_CAMPAIGN_ID));
 if(options.referenceId)url.searchParams.set("customid",options.referenceId);
 url.searchParams.set("toolid",String(EBAY_EPN_TOOL_ID));
 return url.toString();
}
// eBay's "CCG Individual Cards" category. Sealed product spans several eBay categories, so
// sealed searches carry no category filter and rely on the query text.
export const EBAY_CATEGORY_SINGLES=183454;

export type EbayCardLanguage="Arabic"|"Basque"|"Bengali"|"Catalan"|"Chinese"|"Czech"|"Danish"|"Dutch"|"English"|"Finnish"|"French"|"German"|"Greek"|"Hindi/Urdu"|"Hungarian"|"Italian"|"Japanese"|"Korean"|"Latin"|"Malay"|"Norwegian"|"Polish"|"Portuguese"|"Russian"|"Spanish"|"Swedish"|"Thai"|"Vietnamese";
export type EbaySearchItem={kind:"single"|"sealed";name:string;set:string;number?:string|null;game?:string|null;section?:string|null};

// The link every surface renders: the affiliate wrapper around the product page.
export function tcgplayerProductUrl(productId:number,sourceUrl?:string|null):string{
 return tcgplayerAffiliateUrl(tcgplayerProductPage(productId,sourceUrl));
}

// Query rules, measured against eBay's own search on 2026-09-09 (the query has to match the
// way sellers title things; the punctuated forms matched nothing):
// - the game name leads ("Pokemon", "Riftbound", "One Piece") — titles always carry it;
// - the "Name - 123/456" suffix and parenthetical qualifiers come off the name;
// - commas and ampersands come out (a comma-separated epithet or "Scarlet & Violet" matched
//   nothing where the same words without punctuation matched dozens);
// - the set keeps its name only, never its TCGCSV code ("SV10: Destined Rivals" → "Destined
//   Rivals"), and is omitted when the name already contains every word of it;
// - the collector number stays for Pokémon (it disambiguates reprints) and goes for Riftbound
//   (five matches with it, thirty-three without).
const GAME_WORDS:Record<string,string>={pokemon:"Pokemon",riftbound:"Riftbound",onepiece:"One Piece"};
const tidy=(value:string)=>value.replace(/[,&]/g," ").replace(/\s+/g," ").trim();
const cleanName=(name:string)=>tidy(name.replace(/\s+-\s+[\w/]+$/,"").replace(/\s*\([^)]*\)\s*/g," "));
const cleanSet=(set:string)=>tidy(set.replace(/^[A-Za-z0-9.-]+:\s*/,""));
const words=(value:string)=>value.toLowerCase().split(" ").filter(Boolean);

// eBay exposes Language as an item aspect for category 183454. Catalog cards do not carry
// a dedicated language column, so ordinary Singles are English and the exceptions are
// resolved from their explicit catalog identity. The named marker wins over the Japanese
// section so multilingual promo sets such as Pikachu World Collection stay exact.
const LANGUAGE_MARKERS:[EbayCardLanguage,RegExp][]=[
 ["Arabic",/\barabic\b/i],["Basque",/\bbasque\b/i],["Bengali",/\bbengali\b/i],
 ["Catalan",/\bcatalan\b/i],["Chinese",/\b(?:(?:simplified|traditional)\s+)?chinese\b/i],["Czech",/\bczech\b/i],
 ["Danish",/\bdanish\b/i],["Dutch",/\bdutch\b/i],["English",/\benglish\b/i],
 ["Finnish",/\bfinnish\b/i],["French",/\bfrench\b/i],["German",/\bgerman\b/i],
 ["Greek",/\bgreek\b/i],["Hindi/Urdu",/\b(?:hindi|urdu)\b/i],["Hungarian",/\bhungarian\b/i],
 ["Italian",/\bitalian\b/i],["Japanese",/\b(?:japanese|japan)\b/i],["Korean",/\bkorean\b/i],
 ["Latin",/\blatin\b/i],["Malay",/\bmalay\b/i],["Norwegian",/\bnorwegian\b/i],
 ["Polish",/\bpolish\b/i],["Portuguese",/\bportuguese\b/i],
 ["Russian",/\brussian\b/i],["Spanish",/\bspanish\b/i],["Swedish",/\bswedish\b/i],
 ["Thai",/\bthai\b/i],["Vietnamese",/\bvietnamese\b/i],
];
const JAPANESE_PROMO_NUMBER=/(?:^|\/)(?:sv|s|sm|xy|bw|dp|dpt|pcg|adv|vs)?-p\b/i;

export function ebayCardLanguage(item:EbaySearchItem):EbayCardLanguage|null{
 if(item.kind!=="single")return null;
 const identity=`${item.name} ${item.set}`;
 for(const [language,marker] of LANGUAGE_MARKERS)if(marker.test(identity))return language;
 if(item.section==="japanese-promos"||JAPANESE_PROMO_NUMBER.test(item.number??"")||JAPANESE_PROMO_NUMBER.test(item.name))return "Japanese";
 return "English";
}

export function ebaySearchQuery(item:EbaySearchItem):string{
 const name=cleanName(item.name),set=cleanSet(item.set),nameWords=new Set(words(name));
 const setPart=set&&!words(set).every(word=>nameWords.has(word))?set:"";
 const game=item.game?GAME_WORDS[item.game]??"":"";
 const number=item.kind==="single"&&item.game!=="riftbound"&&item.number?item.number.split("/")[0]?.trim():"";
 return tidy([game,name,setPart,number].filter(Boolean).join(" "));
}

// The marketplace tile every card-shaped hover popover ends with (todo O3): an explicit
// outbound button inside the inspection surface, so rows and artwork stay non-navigational.
export const tcgplayerMetric=(productId:number,sourceUrl?:string|null):HistoryMetric=>({label:"TCGplayer",value:"View ↗",href:tcgplayerProductUrl(productId,sourceUrl)});
export const ebayMetric=(item:EbaySearchItem):HistoryMetric=>({label:"eBay",value:"Browse ↗",href:ebaySearchUrl(item)});
// The two outbound tiles a hover popover renders under its artwork (2026-09-09): TCGplayer's
// product page and an eBay buy-it-now search, side by side.
export const marketplaceLinkMetrics=(productId:number,sourceUrl:string|null|undefined,item:EbaySearchItem):HistoryMetric[]=>[tcgplayerMetric(productId,sourceUrl),ebayMetric(item)];

export function ebaySearchUrl(item:EbaySearchItem,options:{sold?:boolean}={}):string{
 const params=new URLSearchParams({_nkw:ebaySearchQuery(item)});
 if(item.kind==="single"){
  params.set("_sacat",String(EBAY_CATEGORY_SINGLES));
  params.set("Language",ebayCardLanguage(item)!);
 }
 if(options.sold){params.set("LH_Sold","1");params.set("LH_Complete","1")}
 else params.set("LH_BIN","1");
 return ebayAffiliateUrl(`https://www.ebay.com/sch/i.html?${params}`);
}
