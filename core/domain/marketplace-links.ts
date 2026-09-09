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
// carry the disclosure. eBay links stay untagged until the EPN campaign exists (TODO(O1): the
// EPN parameters mkevt/mkcid/mkrid/campid/toolid/customid belong here too).

export const TCGPLAYER_PRODUCT_BASE="https://www.tcgplayer.com/product/";
export const TCGPLAYER_AFFILIATE_BASE="https://partner.tcgplayer.com/c/7677898/1780961/21018";

// The raw product page (no tracking) — what the affiliate link deep-links to.
export function tcgplayerProductPage(productId:number,sourceUrl?:string|null):string{
 if(sourceUrl&&exactTcgplayerUrl(sourceUrl))return sourceUrl;
 return `${TCGPLAYER_PRODUCT_BASE}${productId}`;
}

export function tcgplayerAffiliateUrl(target:string):string{
 return `${TCGPLAYER_AFFILIATE_BASE}?u=${encodeURIComponent(target)}`;
}
// eBay's "CCG Individual Cards" category. Sealed product spans several eBay categories, so
// sealed searches carry no category filter and rely on the query text.
export const EBAY_CATEGORY_SINGLES=183454;

export type EbaySearchItem={kind:"single"|"sealed";name:string;set:string;number?:string|null};

// The link every surface renders: the affiliate wrapper around the product page.
export function tcgplayerProductUrl(productId:number,sourceUrl?:string|null):string{
 return tcgplayerAffiliateUrl(tcgplayerProductPage(productId,sourceUrl));
}

// Strip the "Name - 123/456" suffix the catalog appends to single names (the number is added
// separately) and the parenthetical qualifiers that rarely appear in listing titles.
const cleanName=(name:string)=>name.replace(/\s+-\s+[\w/]+$/,"").replace(/\s*\([^)]*\)\s*/g," ").replace(/\s+/g," ").trim();

export function ebaySearchQuery(item:EbaySearchItem):string{
 const name=cleanName(item.name);
 if(item.kind==="sealed")return `${name} ${item.set}`.replace(/\s+/g," ").trim();
 const number=item.number?item.number.split("/")[0]?.trim():"";
 return [name,item.set,number].filter(Boolean).join(" ").replace(/\s+/g," ").trim();
}

// The marketplace tile every card-shaped hover popover ends with (todo O3): an explicit
// outbound button inside the inspection surface, so rows and artwork stay non-navigational.
export const tcgplayerMetric=(productId:number,sourceUrl?:string|null):HistoryMetric=>({label:"TCGplayer",value:"View ↗",href:tcgplayerProductUrl(productId,sourceUrl)});

export function ebaySearchUrl(item:EbaySearchItem,options:{sold?:boolean}={}):string{
 const params=new URLSearchParams({_nkw:ebaySearchQuery(item)});
 if(item.kind==="single")params.set("_sacat",String(EBAY_CATEGORY_SINGLES));
 if(options.sold){params.set("LH_Sold","1");params.set("LH_Complete","1")}
 else params.set("LH_BIN","1");
 return `https://www.ebay.com/sch/i.html?${params}`;
}
