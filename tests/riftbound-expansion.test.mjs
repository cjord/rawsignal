import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";
import {normalizeSinglesGroup,riftboundExclusion} from "../core/normalize/singles.ts";
import {supplementalSingles} from "../core/domain/supplemental-singles.ts";
import {ebaySearchUrl,tcgplayerProductPage} from "../core/domain/marketplace-links.ts";
import {fetchTcgplayerHistory} from "../core/clients/tcgplayer-history.ts";
import {ebayListingMatch} from "../core/ebay-summary.ts";

const product=(name,rarity,number,type)=>({productId:1,name,extendedData:Object.entries({Rarity:rarity,Number:number,"Card Type":type}).map(([name,value])=>({name,value}))});
test("Riftbound inclusion policy excludes tokens, basic runes, regular promos and foreign duplicates",()=>{
 const fixtures=[
  [product("Gold","Common","T03","Gear;Token"),"Spiritforged","excluded-token"],
  [product("Fury Rune","Common","R01","Rune"),"Spiritforged","excluded-basic-rune"],
  [product("Rune Prison","Common","050/298","Spell"),"Origins",null],
  [product("Fury Rune (R01b)","Promo","R01b","Rune"),"Spiritforged",null],
  [product("Mind Rune","Promo","089b/298","Rune"),"Riftbound Organized Play Promotional Cards",null],
  [product("Pouty Poro","Promo","013/298","Unit"),"Riftbound Organized Play Promotional Cards","excluded-regular-promo"],
  [product("Heimerdinger, Inventor","Promo","111/298","Champion Unit"),"Riftbound Judge Promotional Cards",null],
  [product("Kayle, Justified (Top 8)","Promo","134/166","Champion Unit"),"Riftbound Organized Play Promotional Cards",null],
  [product("Kayle, Justified (Champion)","Promo","134/166","Champion Unit"),"Riftbound Organized Play Promotional Cards",null],
  [product("Ordinary (Chinese)","Rare","1/298","Unit"),"Origins","excluded-foreign-duplicate"],
 ];
 for(const [card,set,reason] of fixtures)assert.equal(riftboundExclusion(card,set),reason,card.name);
 for(const rarity of ["Common","Uncommon","Showcase"]){
  const result=normalizeSinglesGroup({game:"riftbound",group:{name:"Origins",publishedOn:"2025-10-31"},products:[product("Included",rarity,"1/298","Unit")],prices:[]});
  assert.equal(result.cards.length,1);assert.equal(result.cards[0].marketPrice,null);
 }
});

test("Lunar Irelia uses a local identity, no fabricated TCGplayer history, and Chinese affiliate links",async()=>{
 const card=supplementalSingles[0],url=new URL(ebaySearchUrl({...card,kind:"single"}));
 assert.equal(url.searchParams.get("Language"),"Chinese");assert.equal(url.searchParams.get("campid"),"5339205908");
 assert.match(url.searchParams.get("_nkw"),/Lunar Revel 2026 Chinese/);
 assert.match(tcgplayerProductPage(card.productId),/\/search\//);
 let calls=0;const history=await fetchTcgplayerHistory(card.productId,"Normal",false,async()=>{calls++;throw new Error("must not call")});assert.equal(history.coverage,"none");assert.deepEqual(history.points,[]);assert.equal(calls,0);
 const target={...card,kind:"single",language:"Chinese"};
 assert.equal(ebayListingMatch("Riftbound Irelia Blade Dancer Lunar Revel 195a/221 Chinese",target).accepted,true);
 for(const title of ["Riftbound Irelia Blade Dancer Lunar Revel 195a/221 English","Riftbound Irelia Blade Dancer 195/221 Chinese","Riftbound Irelia Blade Dancer 195a/221 Chinese"])
  assert.equal(ebayListingMatch(title,target).accepted,false,title);
});

test("generated Riftbound sections reconcile to the manifest and preserve Pokemon separation",async()=>{
 const read=async path=>JSON.parse(await readFile(new URL(path,import.meta.url),"utf8"));
 const index=await read("../tcg-index.json"),manifest=await read("../public/data/catalog-riftbound-manifest.json");
 const cards=(await Promise.all(index.rarities.riftbound.filter(x=>x.key!=="all").map(x=>read(`../public/data/${x.key}.json`)))).flat();
 assert.equal(cards.length,index.totals.riftbound);assert.equal(cards.length,manifest.counts.cards);assert.equal(new Set(cards.map(c=>c.productId)).size,cards.length);
 assert.ok(cards.every(c=>c.game==="riftbound"));assert.ok(!cards.some(c=>c.section==="riftbound-tokens"));
 assert.ok(cards.some(c=>c.productId===900000001));
 assert.ok(cards.some(c=>c.productId===713479));
 assert.ok(!cards.some(c=>c.productId===662908));
 assert.ok(!cards.some(c=>c.productId===678183));
 assert.ok(cards.some(c=>c.productId===680274));
});
