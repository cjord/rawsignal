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
function readSnapshot(path){
 const bytes=readFileSync(path),data=JSON.parse(bytes.toString(bytes[0]===255?'utf16le':'utf8').replace(/^\uFEFF/,''));
 return data.flatMap(row=>row.results??[row]);
}
const rows=process.argv.includes('--snapshot')?readSnapshot(argument('--snapshot')):allowedRarities.riftbound.flatMap(section=>JSON.parse(readFileSync(new URL(`../../public/data/${section}.json`,import.meta.url),'utf8')));
const catalog=auctionCatalog(rows.filter(row=>allowedRarities.riftbound.includes(row.section)).map(row=>withRiftboundRegularArtwork({...row,image:row.image??'',rarity:row.rarity??'Unknown'}))).filter(card=>card.image.trim());
if(!catalog.length)throw Error('No eligible priced cards in snapshot');
const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)]/100;
function audit(kind){
 const profiles=Object.fromEntries(AUCTION_NPCS.map(npc=>[npc.name,{encounters:0,wins:0,losses:0}]));
 const opening=[];let losses=0,rebate=0,overbids=0,bids=0;
 for(let seed=0;seed<count;seed++){
  let save=beginAuction(initialAuctionSave(),catalog,0,undefined,seed,kind);
  for(const npc of save.auction.npcs){profiles[npc.name].encounters++;opening.push(npc.bid);}
  const netValue=inventoryQuote(addInventory([],save.auction.lot),save.auction.lot,save.auction.feeBps).net;
  for(let round=1;round<=4;round++){
   for(const npc of save.auction.npcs){bids++;overbids+=Number(npc.bid>netValue);}
   save=tickAuction({...save,auction:{...save.auction,selected:0,npcs:save.auction.npcs.map(npc=>({...npc,locked:true}))}},save.auction.deadline);
   if(save.auction.stage==='result')break;
   save=nextAuctionRound(save,save.auction.deadline+1);
  }
  const result=save.auction.result;
  if(result.winner){profiles[result.winner].wins++;profiles[result.winner].losses+=Number(result.net<0);}
  losses+=Number(result.net<0);rebate+=result.lossShares?.find(row=>row.name==='You')?.cents??0;
 }
 return {kind,seeds:count,catalogEntries:catalog.length,scenario:'Player passes every round; frozen snapshot; default 10% fee',npcWinningLossPercent:losses/count*100,allNpcBidsAboveNetPercent:overbids/bids*100,meanPlayerLossShare:rebate/count/100,medianOpeningBid:median(opening),profiles};
}
for(const kind of ['free','paid'])console.log(JSON.stringify(audit(kind)));
