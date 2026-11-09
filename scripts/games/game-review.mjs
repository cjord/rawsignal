import {readFile} from 'node:fs/promises';
import {allowedRarities} from '../../core/market-state.ts';
import {gameCardEligible,selectGameScope} from '../../core/domain/game-scope.ts';
import {priceGamePool,drawPriceRound} from '../../core/domain/price-game.ts';
import {pokemonPriceRoundRules} from '../../core/domain/pokemon-game-rarity.ts';
import {auctionCatalog} from '../../core/domain/auction-market.ts';
import {auctionRandom,initialAuctionSave} from '../../core/domain/auction-types.ts';
import {beginAuction,tickAuction,nextAuctionRound} from '../../core/domain/auction-engine.ts';
const count=Number(process.argv[2]??300);
if(!Number.isInteger(count)||count<20||count>2000)throw new Error('Use 20–2000 simulations per tier');
const feed=async market=>(await Promise.all(allowedRarities[market].filter(s=>s!=='japanese-promos').map(async section=>JSON.parse(await readFile(new URL(`../../public/data/${section}.json`,import.meta.url),'utf8'))))).flat();
const [pokemon,riftbound]=await Promise.all([feed('pokemon'),feed('riftbound')]);
const percentile=(rows,p)=>rows.length?[...rows].sort((a,b)=>a-b)[Math.min(rows.length-1,Math.floor(rows.length*p))]:null;
const mean=rows=>rows.length?rows.reduce((a,b)=>a+b,0)/rows.length:null;
const round=n=>n===null?null:+n.toFixed(3);
const price=[];
for(const market of ['pokemon','riftbound'])for(const scope of market==='pokemon'?['all','modern']:['all'])for(const difficulty of ['normal','hard']){
 const selected=market==='pokemon'?selectGameScope(pokemon,{market,eras:scope==='modern'?['swsh','sv','me']:[],sets:[]}).cards:riftbound;
 const pool=priceGamePool(selected.filter(c=>gameCardEligible(c,market)),market),random=auctionRandom(901),ratios=[],times=[];let previous=[];
 for(let i=0;i<count;i++){const start=performance.now(),cards=drawPriceRound(pool,difficulty,previous,random,market==='pokemon'?pokemonPriceRoundRules:undefined);times.push(performance.now()-start);if(!cards.length)continue;previous=cards.map(c=>c.productId);const values=cards.map(c=>c.marketPrice).sort((a,b)=>b-a);ratios.push(values[0]/values[1])}
 price.push({market,scope,difficulty,pool:pool.length,rounds:ratios.length,winnerToRunnerUpMedian:round(percentile(ratios,.5)),within25Percent:round(ratios.filter(r=>r<=1.25).length/ratios.length*100),fiveTimesHigher:round(ratios.filter(r=>r>=5).length/ratios.length*100),prepareMedianMs:round(percentile(times,.5)),prepareP95Ms:round(percentile(times,.95))});
}
const catalog=auctionCatalog(riftbound),auctions=[];
for(const kind of ['free','paid']){
 const stats=new Map(),winningRatios=[],netRatios=[],values=[];let openingBuyouts=0,losingWinners=0,noSale=0;
 for(let index=0;index<count;index++){
  let save=beginAuction(initialAuctionSave(),catalog,0,undefined,Math.imul(index+1,2654435761)>>>0,kind);const lotValue=save.auction.lot.reduce((n,c)=>n+c.cents,0);values.push(lotValue/100);
  for(const npc of save.auction.npcs){const row=stats.get(npc.name)??{opening:[],closing:[],wins:0,overpayingWins:0};row.opening.push(npc.bid/100);stats.set(npc.name,row)}
  for(let r=0;r<4;r++){save=tickAuction(save,save.auction.deadline+1);if(save.auction.stage==='result')break;save=nextAuctionRound(save,save.auction.deadline+1)}
  const a=save.auction,result=a.result;if(!result?.winner){noSale++;continue}const winner=stats.get(result.winner);if(winner){winner.wins++;winner.overpayingWins+=Number(result.net<0)}
  for(const npc of a.npcs)stats.get(npc.name).closing.push(npc.bid/lotValue*100);
  openingBuyouts+=Number(result.buyout&&a.round===1);losingWinners+=Number(result.net<0);winningRatios.push(result.bid/lotValue*100);netRatios.push(result.bid/(lotValue*.9)*100);
 }
 auctions.push({kind,runs:count,medianLotDollars:round(percentile(values,.5)),openingBuyoutPercent:round(openingBuyouts/count*100),winnerOverSaleValuePercent:round(losingWinners/count*100),winnerBidToGrossMedianPercent:round(percentile(winningRatios,.5)),winnerBidToSaleMedianPercent:round(percentile(netRatios,.5)),noSale,npcs:[...stats].sort(([a],[b])=>a.localeCompare(b)).map(([name,s])=>({name,appearances:s.opening.length,openingMeanDollars:round(mean(s.opening)),openingMedianDollars:round(percentile(s.opening,.5)),openingPassPercent:round(s.opening.filter(v=>v===0).length/s.opening.length*100),finalBidToGrossMeanPercent:round(mean(s.closing)),wins:s.wins,overpayingWins:s.overpayingWins}))});
}
console.log(JSON.stringify({basis:'Seeded local bundled-data simulations; no artwork probes; NPC-only auctions with the human always passing; not observed player outcomes or Worker/network latency',price,auctions},null,2));
