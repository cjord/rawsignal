// Offline economy audit. Default: bundled feeds. --snapshot accepts a saved
// catalog row array or Wrangler results JSON. Never fetches or writes source data.
import {readFileSync} from 'node:fs';
import {allowedRarities} from '../../core/market-state.ts';
import {withRiftboundRegularArtwork} from '../../core/domain/riftbound-artwork.ts';
import {auctionCatalog,addInventory,inventoryQuote} from '../../core/domain/auction-market.ts';
import {beginAuction,nextAuctionRound,tickAuction} from '../../core/domain/auction-engine.ts';
import {initialAuctionSave} from '../../core/domain/auction-types.ts';
import {AUCTION_NPCS} from '../../core/domain/auction-npcs.ts';
const argument=name=>process.argv[process.argv.indexOf(name)+1];
const count=process.argv.includes('--seeds')?Number(argument('--seeds')):1000;
if(!Number.isInteger(count)||count<1||count>100000)throw Error('--seeds must be 1–100000');
const seedStart=process.argv.includes('--seed-start')?Number(argument('--seed-start')):0;
if(!Number.isSafeInteger(seedStart)||seedStart<0||seedStart+count>4294967296)throw Error('Invalid --seed-start');
function readSnapshot(path){
 const bytes=readFileSync(path),data=JSON.parse(bytes.toString(bytes[0]===255?'utf16le':'utf8').replace(/^\uFEFF/,''));
 return data.flatMap(row=>row.results??[row]);
}
const rows=process.argv.includes('--snapshot')?readSnapshot(argument('--snapshot')):allowedRarities.riftbound.flatMap(section=>JSON.parse(readFileSync(new URL(`../../public/data/${section}.json`,import.meta.url),'utf8')));
const catalog=auctionCatalog(rows.filter(row=>allowedRarities.riftbound.includes(row.section)).map(row=>withRiftboundRegularArtwork({...row,image:row.image??'',rarity:row.rarity??'Unknown'}))).filter(card=>card.image.trim());
if(!catalog.length)throw Error('No eligible priced cards in snapshot');
const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)]/100;
const dollars=value=>Number((value/100).toFixed(2));
function openingSummary(values){
 if(!values.length)return null;
 const sorted=values.toSorted((a,b)=>a-b);
 return {mean:dollars(values.reduce((sum,bid)=>sum+bid,0)/values.length),median:median(values),p10:dollars(sorted[Math.floor(sorted.length*.1)]),p90:dollars(sorted[Math.floor(sorted.length*.9)]),max:dollars(sorted.at(-1)),passPercent:values.filter(bid=>bid===0).length/values.length*100};
}
function recordEarlyOpening(auction,netValue,examples,investigations,evidence){
 const ranked=auction.npcs.toSorted((a,b)=>b.bid-a.bid),winner=ranked[0],publicSlots=auction.publicReveals?.[0]?.slots??[];
 const clue=winner.findings?.find(finding=>finding.round===1)?.id??'no-new-investigation';investigations[clue]=(investigations[clue]??0)+1;
 evidence.privateSampleOver100+=Number(winner.sample.some(slot=>auction.lot[slot].cents>=10000));evidence.publicOver100+=Number(publicSlots.some(slot=>auction.lot[slot].cents>=10000));evidence.winnerOverpaid+=Number(auction.result.net<0);
 examples.push({seed:auction.seed,theme:auction.lotTheme,winner:winner.name,bid:dollars(winner.bid),runnerUp:dollars(ranked[1].bid),ratio:Number((winner.bid/ranked[1].bid).toFixed(2)),lotNet:dollars(netValue),investigation:winner.investigations?.[0],publicValue:dollars(publicSlots.reduce((sum,index)=>sum+auction.lot[index].cents,0)),privateSample:winner.sample.map(slot=>dollars(auction.lot[slot].cents))});
}
function audit(kind){
 const profiles=Object.fromEntries(AUCTION_NPCS.map(npc=>[npc.name,{encounters:0,wins:0,losses:0,opening:[],roundOneWins:0}]));
 const opening=[],earlyExamples=[],earlyInvestigations={};let losses=0,rebate=0,overbids=0,bids=0,early=0,ordinaryEarly=0,withoutGuest=0,ordinaryTrials=0;
 const earlyEvidence={privateSampleOver100:0,publicOver100:0,winnerOverpaid:0};
 for(let seed=seedStart;seed<seedStart+count;seed++){
  let save=beginAuction(initialAuctionSave(),catalog,0,undefined,seed,kind);
  const hasGuest=save.auction.npcs.some(npc=>npc.name==='The Trust Fund Kid');if(!hasGuest)ordinaryTrials++;
  for(const npc of save.auction.npcs){profiles[npc.name].encounters++;profiles[npc.name].opening.push(npc.bid);opening.push(npc.bid);}
  const netValue=inventoryQuote(addInventory([],save.auction.lot),save.auction.lot,save.auction.feeBps).net;
  for(let round=1;round<=4;round++){
   for(const npc of save.auction.npcs){bids++;overbids+=Number(npc.bid>netValue);}
   save=tickAuction({...save,auction:{...save.auction,selected:0,npcs:save.auction.npcs.map(npc=>({...npc,locked:true}))}},save.auction.deadline);
   if(save.auction.stage==='result')break;
   save=nextAuctionRound(save,save.auction.deadline+1);
  }
  const result=save.auction.result;
  if(result.winner){profiles[result.winner].wins++;profiles[result.winner].losses+=Number(result.net<0);}
  if(save.auction.round===1&&result.buyout){
   early++;profiles[result.winner].roundOneWins++;if(result.winner!=='The Trust Fund Kid')ordinaryEarly++;if(!hasGuest)withoutGuest++;
   recordEarlyOpening(save.auction,netValue,earlyExamples,earlyInvestigations,earlyEvidence);
  }
  losses+=Number(result.net<0);rebate+=result.lossShares?.find(row=>row.name==='You')?.cents??0;
 }
 return {kind,seeds:count,seedStart,catalogEntries:catalog.length,scenario:'Player passes every round; frozen snapshot; default 10% fee; no network artwork probes',npcWinningLossPercent:losses/count*100,allNpcBidsAboveNetPercent:overbids/bids*100,meanPlayerLossShare:rebate/count/100,medianOpeningBid:median(opening),opening:openingSummary(opening),roundOneBuyoutPercent:early/count*100,roundOneOrdinaryWinnerPercent:ordinaryEarly/count*100,roundOneNoGuestTablePercent:withoutGuest/ordinaryTrials*100,earlyInvestigations,earlyEvidence,profiles:Object.fromEntries(Object.entries(profiles).map(([name,{opening,...stats}])=>[name,{...stats,opening:openingSummary(opening)}])),earlyExamples:earlyExamples.toSorted((a,b)=>b.ratio-a.ratio).slice(0,8)};
}
for(const kind of ['free','paid'])console.log(JSON.stringify(audit(kind)));
