import {readFile,writeFile} from 'node:fs/promises';
import {pokemonAuctionCatalog,pokemonAuctionPreparationPool} from '../../core/domain/pokemon-auction.ts';
import {POKEMON_AUCTION_CATEGORIES} from '../../core/domain/pokemon-auction-houses.ts';
import {pokemonGameEra} from '../../core/domain/game-scope.ts';
import {auctionMarketPrior} from '../../core/domain/auction-market-prior.ts';
import {generateAuctionLot} from '../../core/domain/auction-lots.ts';
import {initialAuctionSave} from '../../core/domain/auction-types.ts';
import {beginAuction,tickAuction,nextAuctionRound} from '../../core/domain/auction-engine.ts';

// Read-only offline audit. Accept an exported card array or the ignored canonical
// source audit; never refresh prices, probe artwork or write game/account state.
const [input,output,countText='200']=process.argv.slice(2),count=Number(countText);
if(!input||!output||!Number.isInteger(count)||count<1||count>2000)throw new Error('Usage: node scripts/games/pokemon-auction-balance.mjs <cards.json> <report.json> [1–2000 runs per tier]');
const data=JSON.parse(await readFile(input,'utf8')),cards=Array.isArray(data)?data:[...data.market,...data.stock];
const percentile=(values,p)=>values.toSorted((a,b)=>a-b)[Math.min(values.length-1,Math.floor(values.length*p))]??null;
const mean=values=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;
const summary=values=>({mean:mean(values),p10:percentile(values,.1),median:percentile(values,.5),p90:percentile(values,.9)});
function run(category,kind){
 const eras=POKEMON_AUCTION_CATEGORIES[category].eras,catalog=pokemonAuctionCatalog(cards.filter(card=>eras.includes(pokemonGameEra(card))));
 const values=[],opening=[],wins=[],ratios=[],rounds=[],npcs=new Map();let errors=0,overpaid=0;
 for(let index=0;index<count;index++){
  const seed=(78211+index*137)>>>0,pool=pokemonAuctionPreparationPool(catalog,seed),lot=generateAuctionLot(pool,seed,kind);
  if(!lot.length){errors++;continue}
  const draft={market:'pokemon',rulesVersion:1,category,scope:{market:'pokemon',eras:[...eras],sets:[]},catalogVersion:'a'.repeat(64),seed,kind,lot,marketPrior:auctionMarketPrior(pool,seed,kind)};
  const root={...initialAuctionSave('pokemon'),...(category==='vintage'?{vintageUnlocked:true,wallet:{cash:1000000,feeBps:1000,inventory:[]}}:{}),drafts:{[kind]:draft}};
  let save=beginAuction(root,pool,1000,lot,seed,kind);if(!save.auction)throw new Error('Could not start prepared simulation');
  for(const npc of save.auction.npcs){opening.push(npc.bid/100);const row=npcs.get(npc.name)??{opening:[],ending:[]};row.opening.push(npc.bid/100);npcs.set(npc.name,row)}
  for(let round=1;round<=4;round++){save=tickAuction(save,save.auction.deadline);if(save.auction.stage==='result')break;save=nextAuctionRound(save,save.auction.deadline+1)}
  const result=save.auction.result;values.push(result.value/100);wins.push(result.bid/100);ratios.push(result.bid/result.value);rounds.push(save.auction.round);if(result.net<0)overpaid++;
  for(const npc of save.auction.npcs)npcs.get(npc.name).ending.push(npc.bid/100);
 }
 return {category,kind,pool:catalog.length,runs:values.length,errors,collectionValueUsd:summary(values),openingBidUsd:summary(opening),winningBidUsd:summary(wins),winningShareOfGross:summary(ratios),roundOneBuyoutRate:rounds.filter(round=>round===1).length/values.length,overpayAfterFeesRate:overpaid/values.length,npcs:Object.fromEntries([...npcs].map(([name,row])=>[name,{opening:summary(row.opening),ending:summary(row.ending)}]))};
}
const results=Object.keys(POKEMON_AUCTION_CATEGORIES).flatMap(category=>(category==='vintage'?['paid']:['free','paid']).map(kind=>run(category,kind)));
await writeFile(output,JSON.stringify({source:data.sourceUpdatedAt??null,scenario:'NPC-only natural progression; player passes. Historical source prices, no image probes or live writes. Values/ratios before player entry fees.',results},null,2));
console.log(JSON.stringify(results.map(({npcs,...row})=>{void npcs;return row})));
