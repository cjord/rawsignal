import assert from "node:assert/strict";
import test from "node:test";
import {EBAY_EPN_CAMPAIGN_ID,EBAY_EPN_MARKET_ID,EBAY_EPN_TOOL_ID,EBAY_SMART_LINKS_SRC,TCGPLAYER_AFFILIATE_BASE,ebayAffiliateUrl,ebayCardLanguage,ebayMetric,ebaySearchQuery,ebaySearchUrl,marketplaceLinkMetrics,tcgplayerAffiliateUrl,tcgplayerMetric,tcgplayerProductPage,tcgplayerProductUrl} from "../core/domain/marketplace-links.ts";

test("the TCGplayer product page prefers the catalog's exact URL and falls back to the id form; every rendered link wraps it in the affiliate tracking link",()=>{
 const exact="https://www.tcgplayer.com/product/610526/pokemon-sv-prismatic-evolutions-crispin-171-131";
 assert.equal(tcgplayerProductPage(610526,exact),exact);
 // Movers and import matches carry no URL; supplemental sealed rows carry a search URL.
 assert.equal(tcgplayerProductPage(610526),"https://www.tcgplayer.com/product/610526");
 assert.equal(tcgplayerProductPage(610526,null),"https://www.tcgplayer.com/product/610526");
 assert.equal(tcgplayerProductPage(682789,"https://www.tcgplayer.com/search/pokemon/product?q=Mini+Tin"),"https://www.tcgplayer.com/product/682789");
 // The affiliate link (O1): the Impact tracking URL with the product page as its deep-link target.
 assert.equal(TCGPLAYER_AFFILIATE_BASE,"https://partner.tcgplayer.com/c/7677898/1780961/21018");
 assert.equal(tcgplayerAffiliateUrl(exact),"https://partner.tcgplayer.com/c/7677898/1780961/21018?u="+encodeURIComponent(exact));
 assert.equal(tcgplayerProductUrl(610526,exact),tcgplayerAffiliateUrl(exact));
 assert.equal(tcgplayerProductUrl(610526),"https://partner.tcgplayer.com/c/7677898/1780961/21018?u=https%3A%2F%2Fwww.tcgplayer.com%2Fproduct%2F610526");
 assert.equal(new URL(tcgplayerProductUrl(610526,exact)).searchParams.get("u"),exact);
});

test("the hover tile is an outbound link with the shared label",()=>{
 const tile=tcgplayerMetric(610526,"https://www.tcgplayer.com/product/610526/slug");
 assert.deepEqual(tile,{label:"TCGplayer",value:"View ↗",href:tcgplayerAffiliateUrl("https://www.tcgplayer.com/product/610526/slug")});
 assert.equal(tile.tone,undefined);
});

test("the popover renders TCGplayer and eBay tiles side by side, both outbound",()=>{
 const tiles=marketplaceLinkMetrics(610516,"https://www.tcgplayer.com/product/610516/slug",{kind:"single",game:"pokemon",name:"Umbreon ex - 161/131",set:"SV: Prismatic Evolutions",number:"161/131"});
 assert.deepEqual(tiles.map(tile=>tile.label),["TCGplayer","eBay"]);
 assert.equal(tiles[0].href,tcgplayerProductUrl(610516,"https://www.tcgplayer.com/product/610516/slug"));
 assert.equal(tiles[1].value,"Browse ↗");
 assert.equal(new URL(tiles[1].href).searchParams.get("_nkw"),"Pokemon Umbreon ex Prismatic Evolutions 161");
 assert.equal(new URL(tiles[1].href).searchParams.get("Language"),"English");
 assert.equal(ebayMetric({kind:"sealed",game:"pokemon",name:"Elite Trainer Box",set:"SV10: Destined Rivals"}).href,ebaySearchUrl({kind:"sealed",game:"pokemon",name:"Elite Trainer Box",set:"SV10: Destined Rivals"}));
});

test("eBay card searches default to English and preserve Japanese or explicitly named promo languages",()=>{
 assert.equal(ebayCardLanguage({kind:"single",game:"pokemon",name:"Crispin - 171/131",set:"SV: Prismatic Evolutions",number:"171/131"}),"English");
 assert.equal(ebayCardLanguage({kind:"single",game:"pokemon",name:"Pikachu",set:"SV-P Promotional Cards",number:"001/SV-P",section:"japanese-promos"}),"Japanese");
 assert.equal(ebayCardLanguage({kind:"single",game:"pokemon",name:"Pikachu - 227/S-P",set:"Sword & Shield Promo Cards",number:"227/S-P"}),"Japanese");
 assert.equal(ebayCardLanguage({kind:"single",game:"pokemon",name:"Pikachu (French)",set:"Pikachu World Collection Promos",number:"PW 7"}),"French");
 assert.equal(ebayCardLanguage({kind:"single",game:"pokemon",name:"Pikachu (Polish)",set:"Pikachu World Collection Promos",number:"PW 8",section:"japanese-promos"}),"Polish");
 assert.equal(ebayCardLanguage({kind:"single",game:"pokemon",name:"Promo (Simplified Chinese)",set:"Promos"}),"Chinese");
 assert.equal(ebayCardLanguage({kind:"sealed",game:"pokemon",name:"Japanese Booster Box",set:"Fixture"}),null);
});

test("eBay queries lead with the game, drop set codes and punctuation, skip a set the name already says, and keep the number for Pokémon only",()=>{
 // Measured against eBay's own search (2026-09-09): these forms return dozens of listings; the code/colon, comma, and ampersand forms returned none.
 assert.equal(ebaySearchQuery({kind:"single",game:"pokemon",name:"Crispin - 171/131",set:"SV: Prismatic Evolutions",number:"171/131"}),"Pokemon Crispin Prismatic Evolutions 171");
 assert.equal(ebaySearchQuery({kind:"single",game:"pokemon",name:"Umbreon ex (Special Illustration Rare)",set:"SV: Prismatic Evolutions",number:"161/131"}),"Pokemon Umbreon ex Prismatic Evolutions 161");
 assert.equal(ebaySearchQuery({kind:"single",game:"pokemon",name:"Charizard ex - 199/165",set:"SV: Scarlet & Violet 151",number:"199/165"}),"Pokemon Charizard ex Scarlet Violet 151 199");
 assert.equal(ebaySearchQuery({kind:"single",game:"pokemon",name:"Pikachu",set:"Base Set",number:null}),"Pokemon Pikachu Base Set");
 assert.equal(ebaySearchQuery({kind:"single",game:"riftbound",name:"Ahri, Nine-Tailed Fox",set:"Origins",number:"1/298"}),"Riftbound Ahri Nine-Tailed Fox Origins");
 assert.equal(ebaySearchQuery({kind:"single",game:"riftbound",name:"Jinx, Loose Cannon (Alternate Art)",set:"Origins",number:"300/298"}),"Riftbound Jinx Loose Cannon Alternate Art Origins");
 assert.equal(ebaySearchQuery({kind:"sealed",game:"pokemon",name:"Destined Rivals Booster Box",set:"SV10: Destined Rivals"}),"Pokemon Destined Rivals Booster Box");
 assert.equal(ebaySearchQuery({kind:"sealed",game:"pokemon",name:"Elite Trainer Box",set:"SV10: Destined Rivals"}),"Pokemon Elite Trainer Box Destined Rivals");
 assert.equal(ebaySearchQuery({kind:"sealed",game:"riftbound",name:"Lunar Revel Bundle 2026 (Simplified Chinese)",set:"Lunar Revel 2026"}),"Riftbound Lunar Revel Bundle 2026");
 assert.equal(ebaySearchQuery({kind:"sealed",game:"onepiece",name:"The Time of Battle Booster Box",set:"The Time of Battle"}),"One Piece The Time of Battle Booster Box");
 // No game given: the query still works without the prefix.
 assert.equal(ebaySearchQuery({kind:"single",name:"Pikachu",set:"Base Set"}),"Pikachu Base Set");
});

test("eBay search URLs filter singles to the individual-cards category and buy-it-now, with a sold variant",()=>{
 const single=new URL(ebaySearchUrl({kind:"single",game:"pokemon",name:"Crispin - 171/131",set:"SV: Prismatic Evolutions",number:"171/131"}));
 assert.equal(single.origin+single.pathname,"https://www.ebay.com/sch/i.html");
 assert.equal(single.searchParams.get("_nkw"),"Pokemon Crispin Prismatic Evolutions 171");
 assert.equal(single.searchParams.get("_sacat"),"183454");
 assert.equal(single.searchParams.get("Language"),"English");
 assert.equal(single.searchParams.get("LH_BIN"),"1");
 assert.equal(single.searchParams.get("LH_Sold"),null);
 assert.equal(single.searchParams.get("campid"),String(EBAY_EPN_CAMPAIGN_ID));
 assert.equal(single.searchParams.get("mkevt"),"1");
 assert.equal(single.searchParams.get("mkcid"),"1");
 assert.equal(single.searchParams.get("mkrid"),EBAY_EPN_MARKET_ID);
 assert.equal(single.searchParams.get("toolid"),String(EBAY_EPN_TOOL_ID));
 const sealed=new URL(ebaySearchUrl({kind:"sealed",name:"Destined Rivals Booster Box",set:"SV10: Destined Rivals"}));
 assert.equal(sealed.searchParams.get("_sacat"),null);
 assert.equal(sealed.searchParams.get("Language"),null);
 const japanese=new URL(ebaySearchUrl({kind:"single",game:"pokemon",name:"Pikachu - 227/S-P",set:"Sword & Shield Promo Cards",number:"227/S-P"}));
 assert.equal(japanese.searchParams.get("Language"),"Japanese");
 const french=new URL(ebaySearchUrl({kind:"single",game:"pokemon",name:"Pikachu (French)",set:"Pikachu World Collection Promos",number:"PW 7"}));
 assert.equal(french.searchParams.get("Language"),"French");
 const sold=new URL(ebaySearchUrl({kind:"single",name:"Pikachu",set:"Base Set"},{sold:true}));
 assert.equal(sold.searchParams.get("LH_Sold"),"1");
 assert.equal(sold.searchParams.get("LH_Complete"),"1");
 assert.equal(sold.searchParams.get("LH_BIN"),null);
 assert.equal(sold.searchParams.get("campid"),String(EBAY_EPN_CAMPAIGN_ID));
});

test("direct eBay affiliate links are idempotent and can carry a per-link reference",()=>{
 const first=ebayAffiliateUrl("https://www.ebay.com/itm/123?foo=bar",{campaignId:"5338000000",referenceId:"rawsignal-123"});
 const second=ebayAffiliateUrl(first,{campaignId:"5338000000",referenceId:"rawsignal-123"});
 assert.equal(second,first);
 const url=new URL(first);
 assert.equal(url.searchParams.get("foo"),"bar");
 assert.equal(url.searchParams.get("campid"),"5338000000");
 assert.equal(url.searchParams.get("customid"),"rawsignal-123");
 assert.equal(url.searchParams.getAll("toolid").length,1);
});

test("the eBay campaign and Smart Links loader are the published EPN values",()=>{
 assert.equal(EBAY_EPN_CAMPAIGN_ID,5339205908);
 assert.equal(EBAY_EPN_MARKET_ID,"711-53200-19255-0");
 assert.equal(EBAY_EPN_TOOL_ID,10001);
 assert.equal(EBAY_SMART_LINKS_SRC,"https://epnt.ebay.com/static/epn-smart-tools.js");
});
