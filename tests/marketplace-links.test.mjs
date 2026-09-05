import assert from "node:assert/strict";
import test from "node:test";
import {ebaySearchQuery,ebaySearchUrl,tcgplayerMetric,tcgplayerProductUrl} from "../core/domain/marketplace-links.ts";

test("the TCGplayer link prefers the catalog's exact product URL and falls back to the id form",()=>{
 const exact="https://www.tcgplayer.com/product/610526/pokemon-sv-prismatic-evolutions-crispin-171-131";
 assert.equal(tcgplayerProductUrl(610526,exact),exact);
 // Movers and import matches carry no URL; supplemental sealed rows carry a search URL.
 assert.equal(tcgplayerProductUrl(610526),"https://www.tcgplayer.com/product/610526");
 assert.equal(tcgplayerProductUrl(610526,null),"https://www.tcgplayer.com/product/610526");
 assert.equal(tcgplayerProductUrl(682789,"https://www.tcgplayer.com/search/pokemon/product?q=Mini+Tin"),"https://www.tcgplayer.com/product/682789");
});

test("the hover tile is an outbound link with the shared label",()=>{
 const tile=tcgplayerMetric(610526,"https://www.tcgplayer.com/product/610526/slug");
 assert.deepEqual(tile,{label:"TCGplayer",value:"View ↗",href:"https://www.tcgplayer.com/product/610526/slug"});
 assert.equal(tile.tone,undefined);
});

test("eBay queries name the card, its set, and its collector number; sealed products the product and set",()=>{
 assert.equal(ebaySearchQuery({kind:"single",name:"Crispin - 171/131",set:"SV: Prismatic Evolutions",number:"171/131"}),"Crispin SV: Prismatic Evolutions 171");
 assert.equal(ebaySearchQuery({kind:"single",name:"Umbreon ex (Special Illustration Rare)",set:"SV: Prismatic Evolutions",number:"161/131"}),"Umbreon ex SV: Prismatic Evolutions 161");
 assert.equal(ebaySearchQuery({kind:"single",name:"Pikachu",set:"Base Set",number:null}),"Pikachu Base Set");
 assert.equal(ebaySearchQuery({kind:"sealed",name:"Destined Rivals Booster Box",set:"SV10: Destined Rivals"}),"Destined Rivals Booster Box SV10: Destined Rivals");
});

test("eBay search URLs filter singles to the individual-cards category and buy-it-now, with a sold variant",()=>{
 const single=new URL(ebaySearchUrl({kind:"single",name:"Crispin - 171/131",set:"SV: Prismatic Evolutions",number:"171/131"}));
 assert.equal(single.origin+single.pathname,"https://www.ebay.com/sch/i.html");
 assert.equal(single.searchParams.get("_nkw"),"Crispin SV: Prismatic Evolutions 171");
 assert.equal(single.searchParams.get("_sacat"),"183454");
 assert.equal(single.searchParams.get("LH_BIN"),"1");
 assert.equal(single.searchParams.get("LH_Sold"),null);
 const sealed=new URL(ebaySearchUrl({kind:"sealed",name:"Destined Rivals Booster Box",set:"SV10: Destined Rivals"}));
 assert.equal(sealed.searchParams.get("_sacat"),null);
 const sold=new URL(ebaySearchUrl({kind:"single",name:"Pikachu",set:"Base Set"},{sold:true}));
 assert.equal(sold.searchParams.get("LH_Sold"),"1");
 assert.equal(sold.searchParams.get("LH_Complete"),"1");
 assert.equal(sold.searchParams.get("LH_BIN"),null);
});
