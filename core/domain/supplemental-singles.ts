import type {Card} from "./types.ts";

// Explicit local identities, NOT TCGplayer IDs. Never pass these to TCGplayer's
// product/history endpoints. Keep IDs stable; reconcile deliberately if TCGCSV adds one.
export const supplementalSingles: readonly Card[] = [{
 game:"riftbound",section:"riftbound-foreign-promos",productId:900000001,
 name:"Irelia, Blade Dancer (Lunar Revel 2026) (Chinese)",
 set:"Lunar Revel 2026",year:2026,rarity:"Promo",number:"195a/221",
 printing:"Unknown",image:"",
 url:"https://www.tcgplayer.com/search/all/product?q=Riftbound%20Irelia%20Lunar%20Revel%20Chinese&view=grid",
 marketPrice:null,lowPrice:null,midPrice:null,highPrice:null,priceChange:null,
}];

export const supplementalSingleSources = new Map([[900000001, {
 source:"https://merch.riotgames.com/en-us/product/riftbound-lunar-revel-bundle-2026/",
 numberSource:"https://www.beckett.com/gaming/2026/riftbound-league-of-legends-tcg-promos-simplified-chinese/195a-irelia---blade-dancer-plunar-revel-bundle-26-33496263",
 language:"Simplified Chinese",verifiedOn:"2026-09-18",
}]]);
export const supplementalSingle=(productId:number)=>supplementalSingles.find(card=>card.productId===productId);
