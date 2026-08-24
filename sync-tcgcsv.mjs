import fs from "node:fs/promises";
const BASE="https://tcgcsv.com/tcgplayer",headers={"User-Agent":"RawSignal/3.0 (+daily market leaderboard)"};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function readJson(url){for(let attempt=0;attempt<3;attempt++){const response=await fetch(url,{headers});if(response.ok){const data=await response.json();await sleep(110);return data.results??[]}await sleep(500*(attempt+1))}throw new Error(`Failed ${url}`)}
const ext=(product,key)=>product.extendedData?.find(item=>item.name===key)?.value??"";
const slug=value=>value.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
let previous={};try{const old=JSON.parse(await fs.readFile("tcg-data.json","utf8"));for(const cards of Object.values(old.sections??{}))for(const card of cards)previous[`${card.game}:${card.productId}`]=card.marketPrice}catch{/* First sync has no prior snapshot. */}
const today=new Date(),sections={},rarities={pokemon:[],riftbound:[],magic:[]};
const pokemonSection=(rarity,year)=>{
 if(/^Illustration Rare$/i.test(rarity))return ["illustration-rares","Illustration Rares"];
 if(/^Special Illustration Rare$/i.test(rarity))return ["special-illustration-rares","Special Illustration Rares"];
 if(/^Promo$/i.test(rarity))return ["promos","Promos"];
 if(/^Ultra Rare$/i.test(rarity))return ["ultra-rares","Ultra Rares"];
 if(/^Double Rare$/i.test(rarity))return ["double-rares","Double Rares"];
 if(/^(Secret Rare|Hyper Rare|Rainbow Rare|Mega Hyper Rare|Black White Rare)$/i.test(rarity))return ["secret-hyper-rares","Secret & Hyper Rares"];
 if(/^(Shiny Holo Rare|Shiny Rare|Shiny Ultra Rare|Radiant Rare|Amazing Rare|Prism Rare)$/i.test(rarity))return ["shiny-radiant-rares","Shiny & Radiant Rares"];
 if(year<=2010)return ["vintage","Vintage"];return null;
};
async function collect(categoryId,game){
 const groups=(await readJson(`${BASE}/${categoryId}/groups`)).filter(group=>new Date(group.publishedOn)<=today);let done=0;
 for(const group of groups){
  const [products,prices]=await Promise.all([readJson(`${BASE}/${categoryId}/${group.groupId}/products`),readJson(`${BASE}/${categoryId}/${group.groupId}/prices`)]),byId=new Map();
  for(const price of prices){if(!price.marketPrice||price.marketPrice<=0)continue;const old=byId.get(price.productId);if(!old||price.marketPrice>old.marketPrice)byId.set(price.productId,price)}
  for(const product of products){
   const price=byId.get(product.productId),rarity=ext(product,"Rarity"),number=ext(product,"Number");if(!price||!rarity||!number)continue;
   const year=new Date(group.publishedOn).getFullYear();let section,label;
   if(game==="pokemon"){const selected=pokemonSection(rarity,year);if(selected)[section,label]=selected}
   else if(game==="riftbound"){if(/\(Signature\)/i.test(product.name))[section,label]=["signatures","Signatures"];else if(/\(Overnumbered\)/i.test(product.name))[section,label]=["overnumbered","Overnumbered"];else if(/\(Alternate Art\)/i.test(product.name))[section,label]=["alt-arts","Alt Arts"];else if(/^Epic$/i.test(rarity))[section,label]=["epics","Epics"];else if(/^Rare$/i.test(rarity))[section,label]=["rares","Rares"]}
   else{section=`magic-${slug(rarity)}`;label=rarity}if(!section)continue;
   const prior=previous[`${game}:${product.productId}`],card={game,section,productId:product.productId,name:product.name,set:group.name,year,rarity,number,image:product.imageUrl?.replace("_200w","_in_1000x1000"),url:product.url,marketPrice:price.marketPrice,lowPrice:price.lowPrice,midPrice:price.midPrice,highPrice:price.highPrice,printing:price.subTypeName,priceChange:typeof prior==="number"?Number((price.marketPrice-prior).toFixed(2)):null};
   (sections[section]??=[]).push(card);if(!rarities[game].some(item=>item.key===section))rarities[game].push({key:section,label});
  }
  done++;if(done%25===0)console.error(`${game}: ${done}/${groups.length}`);
 }
}
await collect(3,"pokemon");await collect(89,"riftbound");await collect(1,"magic");
sections["illustration-and-special-rares"]=[...(sections["illustration-rares"]??[]),...(sections["special-illustration-rares"]??[])];
rarities.pokemon.push({key:"illustration-and-special-rares",label:"Illustration + Special Illustration Rares"});
for(const cards of Object.values(sections))cards.sort((a,b)=>b.marketPrice-a.marketPrice);
const order={pokemon:["illustration-and-special-rares","illustration-rares","special-illustration-rares","promos","ultra-rares","double-rares","secret-hyper-rares","shiny-radiant-rares","vintage"],riftbound:["rares","epics","alt-arts","overnumbered","signatures"],magic:["magic-m","magic-r","magic-u","magic-c","magic-s","magic-p","magic-l","magic-t"]};
for(const game of Object.keys(rarities)){rarities[game].sort((a,b)=>order[game].indexOf(a.key)-order[game].indexOf(b.key));rarities[game].push({key:"all",label:"All"})}
const lastUpdated=await fetch("https://tcgcsv.com/last-updated.txt",{headers}).then(response=>response.text()).catch(()=>today.toISOString()),totals={};
for(const game of Object.keys(rarities))totals[game]=new Set(Object.values(sections).flat().filter(card=>card.game===game).map(card=>card.productId)).size;
await fs.mkdir("public/data",{recursive:true});let bytes=0;
for(const [key,cards] of Object.entries(sections)){const body=JSON.stringify(cards);bytes+=Buffer.byteLength(body);await fs.writeFile(`public/data/${key}.json`,body)}
await fs.writeFile("tcg-index.json",JSON.stringify({source:"TCGCSV / TCGplayer",syncedAt:new Date().toISOString(),sourceUpdatedAt:lastUpdated.trim(),rarities,totals}));
await fs.rm("tcg-data.json",{force:true});console.log({totals,sections:Object.keys(sections).length,bytes});
