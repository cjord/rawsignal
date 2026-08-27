// Refreshes public/data/graded-prices.json from the PokemonPriceTracker API (eBay completed
// sales per grade). The free tier allows 100 credits/day at 2 credits per card, so each run
// updates a budgeted slice of the most valuable Pokemon singles, preferring cards that have
// never been fetched and then the stalest snapshots. Existing entries are preserved (last-good).
// Key: POKEMONPRICETRACKER_API_KEY env var, or .secrets/pokemonpricetracker-key (gitignored).
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import path from "node:path";

const root=path.dirname(path.dirname(fileURLToPath(new URL(import.meta.url))));
const feedPath=path.join(root,"..","public","data","graded-prices.json");
const dataDir=path.join(root,"..","public","data");
const args=process.argv.slice(2);
const budget=Number(args[args.indexOf("--budget")+1]||0)||90;
const poolSize=400;

async function apiKey(){
 if(process.env.POKEMONPRICETRACKER_API_KEY)return process.env.POKEMONPRICETRACKER_API_KEY.trim();
 try{return (await readFile(path.join(root,"..",".secrets","pokemonpricetracker-key"),"utf8")).trim()}
 catch{throw new Error("Missing API key: set POKEMONPRICETRACKER_API_KEY or create .secrets/pokemonpricetracker-key")}
}

const money=value=>typeof value==="number"&&Number.isFinite(value)&&value>0?Math.round(value*100)/100:null;
const count=value=>Number.isInteger(value)&&value>=0?value:null;

function compactGrades(salesByGrade){
 const grades={};
 for(const [key,stat] of Object.entries(salesByGrade??{})){
  if(typeof stat!=="object"||stat===null)continue;
  const sales=count(stat.count);
  if(!sales)continue;
  grades[key]={
   count:sales,
   average:money(stat.averagePrice),
   median:money(stat.medianPrice),
   smartPrice:money(stat.smartMarketPrice?.price),
   confidence:typeof stat.smartMarketPrice?.confidence==="string"?stat.smartMarketPrice.confidence:null,
   trend:stat.marketTrend==="up"||stat.marketTrend==="down"?stat.marketTrend:null,
   lastSaleDate:typeof stat.lastSaleDate==="string"?stat.lastSaleDate.slice(0,10):null,
  };
 }
 return grades;
}

async function main(){
 const key=await apiKey();
 const index=JSON.parse(await readFile(path.join(root,"..","tcg-index.json"),"utf8"));
 const sections=index.rarities.pokemon.map(entry=>entry.key).filter(section=>section!=="all");
 const cards=new Map();
 for(const section of sections){
  for(const card of JSON.parse(await readFile(path.join(dataDir,`${section}.json`),"utf8")))
   if(card.marketPrice>0)cards.set(card.productId,card);
 }
 let feed={schema:1,source:"PokemonPriceTracker eBay completed sales",generatedAt:null,entries:{}};
 try{const existing=JSON.parse(await readFile(feedPath,"utf8"));if(existing&&typeof existing.entries==="object")feed=existing}catch{/* First run starts an empty feed. */}
 const pool=[...cards.values()].sort((a,b)=>b.marketPrice-a.marketPrice).slice(0,poolSize);
 const staleness=id=>feed.entries[id]?.updatedAt??"";
 pool.sort((a,b)=>staleness(a.productId).localeCompare(staleness(b.productId))||b.marketPrice-a.marketPrice);
 const targets=pool.slice(0,Math.floor(budget/2));
 console.log(`Budget ${budget} credits -> ${targets.length} cards (pool of ${pool.length}).`);
 let spent=0,updated=0;
 for(const card of targets){
  const response=await fetch(`https://www.pokemonpricetracker.com/api/v2/cards?tcgPlayerId=${card.productId}&includeEbay=true`,{headers:{Authorization:`Bearer ${key}`,Accept:"application/json"}});
  const remaining=Number(response.headers.get("x-ratelimit-daily-remaining"));
  if(response.status===429){console.warn("Rate limited; stopping early.");break}
  if(!response.ok){console.warn(`Skipping ${card.productId}: HTTP ${response.status}`);continue}
  const payload=await response.json();
  spent+=Number(response.headers.get("x-api-calls-consumed"))||2;
  const grades=compactGrades(payload?.data?.ebay?.salesByGrade);
  if(Object.keys(grades).length){
   feed.entries[card.productId]={updatedAt:new Date().toISOString().slice(0,10),name:card.name,grades};
   updated++;
  }
  if(Number.isFinite(remaining)&&remaining<2){console.warn(`Daily credits exhausted (${remaining} left); stopping.`);break}
  await new Promise(resolve=>setTimeout(resolve,1100));
 }
 feed.generatedAt=new Date().toISOString();
 await mkdir(path.dirname(feedPath),{recursive:true});
 await writeFile(feedPath,`${JSON.stringify(feed,null,1)}\n`);
 console.log(`Updated ${updated} cards using ~${spent} credits. Feed now holds ${Object.keys(feed.entries).length} entries.`);
}

main().catch(error=>{console.error(error.message??error);process.exitCode=1});
