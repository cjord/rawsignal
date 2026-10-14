import fs from 'node:fs';
import {allowedRarities} from '../../core/market-state.ts';
import {auctionCatalog} from '../../core/domain/auction-market.ts';
import {generateAuctionLot,auctionLotProfile} from '../../core/domain/auction-lots.ts';
import {initialAuctionSave} from '../../core/domain/auction-types.ts';
import {beginAuction,tickAuction,nextAuctionRound} from '../../core/domain/auction-engine.ts';

const count=Number(process.argv[2]??1000);
if(!Number.isInteger(count)||count<1||count>10000)throw new Error('Use 1–10000 simulations');
const cards=allowedRarities.riftbound.flatMap(section=>JSON.parse(fs.readFileSync(new URL(`../../public/data/${section}.json`,import.meta.url),'utf8')));
const catalog=auctionCatalog(cards),npcStats={},profiles={},values=[];
for(let index=0;index<count;index++){
 const seed=Math.imul(index+1,2654435761)>>>0,lot=generateAuctionLot(catalog,seed);
 if(!lot.length)continue;
 const profile=auctionLotProfile(seed).name;profiles[profile]=(profiles[profile]??0)+1;
 let save=beginAuction(initialAuctionSave(),catalog,0,lot,seed);
 for(const npc of save.auction.npcs){npcStats[npc.name]??={appearances:0,wins:0,losses:0,totalNet:0};npcStats[npc.name].appearances++}
 for(let round=0;round<4;round++){
  save=tickAuction(save,save.auction.deadline+1);
  if(save.auction.stage==='result')break;
  save=nextAuctionRound(save,save.auction.deadline+1);
 }
 const result=save.auction.result;values.push(result.value/100);
 const name=result.winner??'No Sale';npcStats[name]??={appearances:0,wins:0,losses:0,totalNet:0};
 npcStats[name].wins++;npcStats[name].losses+=result.net<0?1:0;npcStats[name].totalNet+=result.net/100;
}
values.sort((a,b)=>a-b);
console.log(JSON.stringify({scenario:'NPC-only auctions; player always passes; bundled priced catalog; no image probes',simulations:values.length,profiles,lotValue:{min:values[0],median:values[Math.floor(values.length/2)],p90:values[Math.floor(values.length*.9)],max:values.at(-1)},npcs:Object.fromEntries(Object.entries(npcStats).map(([name,value])=>[name,{appearances:value.appearances,wins:value.wins,losingWins:value.losses,meanNet:value.wins?Number((value.totalNet/value.wins).toFixed(2)):null}]))},null,2));
