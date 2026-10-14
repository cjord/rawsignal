import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {cardImageFallbackFor,normalizeSetName,resolveTcgdexSet,tcgdexCardUrl} from "../core/domain/card-images.ts";
import {riftboundRegularArtworkImage,withRiftboundRegularArtwork} from "../core/domain/riftbound-artwork.ts";

const index={
 sets:{"surging sparks":{lang:"en",serie:"sv",id:"sv08",padded:true},"base set":{lang:"en",serie:"base",id:"base1",padded:false},"151":{lang:"en",serie:"sv",id:"sv03.5",padded:true},"brilliant stars":{lang:"en",serie:"swsh",id:"swsh9",padded:false}},
 codes:{sv08:{lang:"en",serie:"sv",id:"sv08",padded:true},sv10:{lang:"en",serie:"sv",id:"sv10",padded:true},sv2a:{lang:"ja",serie:"SV",id:"SV2a",padded:true},me01:{lang:"en",serie:"me",id:"me01",padded:true}},
};

test("set names resolve by their TCGCSV code first, then by normalized name, era prefix stripped, or alias",()=>{
 assert.equal(resolveTcgdexSet(index,"SV10: Destined Rivals")?.id,"sv10");
 assert.equal(resolveTcgdexSet(index,"SV2a: Pokemon Card 151")?.lang,"ja");
 assert.equal(resolveTcgdexSet(index,"ME01: Mega Evolution")?.id,"me01");
 assert.equal(resolveTcgdexSet(index,"Surging Sparks")?.id,"sv08");
 assert.equal(resolveTcgdexSet(index,"SWSH09: Brilliant Stars")?.id,"swsh9");
 assert.equal(resolveTcgdexSet(index,"Scarlet & Violet 151")?.id,"sv03.5");
 assert.equal(resolveTcgdexSet(index,"Base Set")?.id,"base1");
 assert.equal(resolveTcgdexSet(index,"S10D: Time Gazer"),null);
 assert.equal(normalizeSetName("HeartGold & SoulSilver—Unleashed"),"heartgold and soulsilver unleashed");
});

test("card URLs pad modern collector numbers, keep old ones bare, and pass lettered numbers through",()=>{
 assert.equal(tcgdexCardUrl(index.codes.sv08,"238/191"),"https://assets.tcgdex.net/en/sv/sv08/238/high.webp");
 assert.equal(tcgdexCardUrl(index.codes.sv10,"5/182"),"https://assets.tcgdex.net/en/sv/sv10/005/high.webp");
 assert.equal(tcgdexCardUrl(index.sets["base set"],"004/102"),"https://assets.tcgdex.net/en/base/base1/4/high.webp");
 assert.equal(tcgdexCardUrl(index.codes.sv2a,"1/165"),"https://assets.tcgdex.net/ja/SV/SV2a/001/high.webp");
 assert.equal(tcgdexCardUrl(index.sets["brilliant stars"],"TG01/TG30"),"https://assets.tcgdex.net/en/swsh/swsh9/TG01/high.webp");
 assert.equal(tcgdexCardUrl(index.codes.sv08,""),null);
});

test("only Pokémon cards with a number and a known set get a fallback",()=>{
 assert.equal(cardImageFallbackFor(index,{game:"pokemon",set:"Surging Sparks",number:"238/191"}),"https://assets.tcgdex.net/en/sv/sv08/238/high.webp");
 assert.equal(cardImageFallbackFor(index,{game:"riftbound",set:"Origins",number:"1/298"}),null);
 assert.equal(cardImageFallbackFor(index,{game:"pokemon",set:"Unknown Set",number:"1/1"}),null);
 assert.equal(cardImageFallbackFor(index,{game:"pokemon",set:"Surging Sparks",number:null}),null);
});

test("all catalog Metal and Best Of printings use the exact regular-rarity artwork",()=>{
 const read=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),"utf8"));
 const sections=read("../tcg-index.json").rarities.riftbound.filter(row=>row.key!=="all");
 const cards=sections.flatMap(row=>read(`../public/data/${row.key}.json`));
 const special=cards.filter(card=>card.section==="metal-promos");
 assert.ok(special.length>0);
 for(const card of special){
  const base=card.name.replace(/(?:\s*\((?:Metal|Best Of|Prize Wall)\))+\s*$/i,"").trim().toLowerCase();
  const matches=cards.filter(other=>other.section==="rares"&&other.number===card.number&&other.name.replace(/\s*\(Starter\)$/i,"").trim().toLowerCase()===base);
  assert.equal(matches.length,1,`Unique regular printing for ${card.name}`);
  const resolved=withRiftboundRegularArtwork(card);
  assert.equal(resolved.image,matches[0].image,card.name);
  assert.deepEqual({...resolved,image:card.image},card,"only artwork changes");
 }
});

test("artwork matching preserves other treatments and fails closed for unknown identities",()=>{
 const card={game:"riftbound",name:"Kai'Sa, Daughter of the Void (Metal) (Best Of)",number:"247/298",image:"original"};
 assert.match(riftboundRegularArtworkImage(card),/653045_in_1000x1000/);
 for(const changed of [{game:"pokemon"},{number:"247a/298"},{name:"Kai'Sa, Daughter of the Void (Signature)"},{name:"Unknown (Metal)"},{number:null}])
  assert.equal(riftboundRegularArtworkImage({...card,...changed}),null);
 assert.equal(withRiftboundRegularArtwork({...card,number:"247a/298"}).image,"original");
});
