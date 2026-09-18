import assert from "node:assert/strict";
import test from "node:test";
import {normalizeSinglesGroup} from "../core/normalize/singles.ts";
import {parseCard} from "../core/domain/contracts.ts";
import {validateCatalogSnapshot} from "../scripts/validate/catalog.mjs";
import {createMemoryCatalogRepository} from "../core/catalog-repository.ts";
import {querySinglesCatalog} from "../core/catalog-query.ts";
import {evaluateMarketSignal} from "../core/signal-utils.ts";
import {ebaySearchUrl} from "../core/domain/marketplace-links.ts";

const product=(id,name,rarity="Promo")=>({productId:id,name,url:`https://www.tcgplayer.com/product/${id}/card`,imageUrl:"https://example.com/card.jpg",extendedData:[{name:"Rarity",value:rarity},{name:"Number",value:"247/298"}]});
const normalize=(products,prices=[])=>normalizeSinglesGroup({game:"riftbound",group:{name:"Riftbound Organized Play Promotional Cards",publishedOn:"2025-10-31"},products,prices});
const options={market:"riftbound",sections:[],query:"",sets:[],minPrice:"",maxPrice:"",up7:false,down7:false,up30:false,down30:false,signal:"leaderboard",strictness:"balanced",sort:"market",direction:"desc",page:1,perPage:20};

test("Riftbound singles survive missing prices without manufacturing values",()=>{
 const {cards,rejected}=normalize([product(1,"Kai'Sa, Daughter of the Void (Metal) (Best Of)"),product(2,"Lux, Lady of Luminosity (Metal) (Prize Wall)","Rare"),product(3,"Other unpriced promo"),product(4,"Another (Best Of)")],[{productId:1,subTypeName:"Foil",marketPrice:null,lowPrice:4000}]);
 assert.equal(cards.length,3);assert.equal(rejected["excluded-regular-promo"],1);
 for(const card of cards){assert.equal(card.marketPrice,null);assert.equal(card.priceChange,null);assert.equal(card.lowPrice,null);assert.deepEqual(parseCard(card),card);}
 assert.ok(cards.every(card=>card.section==="metal-promos"));
 assert.equal(cards[0].printing,"Foil");assert.equal(cards[1].printing,"Unknown");
 assert.equal(validateCatalogSnapshot({cards}).cards,3);
 const priced=normalize([product(1,"Kai'Sa (Metal) (Best Of)")],[{productId:1,subTypeName:"Foil",marketPrice:500}]).cards[0];
 assert.equal(priced.marketPrice,500);
 const foil=product(5,"Best (Metal) (Best Of)"),normal=product(6,"Prize (Metal) (Prize Wall)");
 foil.extendedData.push({name:"Description",value:"This card is only available as foil."});
 normal.extendedData.push({name:"Description",value:"This card is only available as non-foil."});
 assert.deepEqual(normalize([foil,normal]).cards.map(c=>c.printing),["Foil","Normal"]);
});

test("unpriced singles sort last in either direction, remain searchable, and fail price/signal filters",()=>{
 const card=normalize([product(1,"Kai'Sa, Daughter of the Void (Metal) (Best Of)")]).cards[0];
 const cards=[card,{...card,productId:2,marketPrice:50}];
 for(const direction of ["asc","desc"])assert.deepEqual(querySinglesCatalog(cards,{...options,direction}).items.map(c=>c.productId),[2,1]);
 assert.equal(querySinglesCatalog(cards,{...options,query:"Best Of"}).total,2);
 for(const filter of [{minPrice:"0"},{maxPrice:"100"}])assert.deepEqual(querySinglesCatalog(cards,{...options,...filter}).items.map(c=>c.productId),[2]);
 assert.equal(querySinglesCatalog([card],{...options,signal:"buy"},{1:{signal:{score:99}}}).total,0);
 assert.equal(evaluateMarketSignal([{date:"2026-09-18",price:100}],"buy","balanced",null).code,"missing-current-price");
});

test("catalog-only detail pages retain identity, null market rank, and affiliate search links",async()=>{
 const card=normalize([product(1,"Kai'Sa, Daughter of the Void (Metal) (Best Of)")]).cards[0];
 const detail=await createMemoryCatalogRepository([card],[]).getDetail("single",1);
 assert.equal(detail.marketPrice,null);assert.equal(detail.marketRank,null);assert.equal(detail.priceVariants[0].marketPrice,null);
 const url=new URL(ebaySearchUrl({...detail,kind:"single"}));
 assert.match(url.searchParams.get("_nkw"),/Metal Best Of/);assert.equal(url.searchParams.get("Language"),"English");assert.equal(url.searchParams.get("campid"),"5339205908");
});
