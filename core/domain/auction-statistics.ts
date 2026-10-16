import type {AuctionSave,AuctionStatistics} from './auction-types.ts';

export const emptyAuctionStatistics=():AuctionStatistics=>({started:0,settled:0,won:0,abandoned:0,investigations:0,entryFees:0,profit:0,rebates:0,bestProfit:0,buyouts:0});
export function recordAuctionStart(save:AuctionSave,entry:number){
 const stats=save.statistics??emptyAuctionStatistics();
 return {...stats,started:stats.started+1,entryFees:stats.entryFees+entry};
}
export function recordAuctionResult(save:AuctionSave,won:boolean,profit:number,rebate:number,buyout:boolean){
 if(!save.auction?.statisticsTracked)return save.statistics;
 const stats=save.statistics!;
 return {...stats,settled:stats.settled+1,won:stats.won+Number(won),profit:stats.profit+profit,rebates:stats.rebates+rebate,bestProfit:Math.max(stats.bestProfit,profit),buyouts:stats.buyouts+Number(won&&buyout)};
}
export function validAuctionStatistics(value:unknown):value is AuctionStatistics{
 if(!value||typeof value!=='object')return false;
 const stats=value as AuctionStatistics,keys=Object.keys(emptyAuctionStatistics()) as (keyof AuctionStatistics)[];
 return keys.every(key=>Number.isSafeInteger(stats[key])&&(key==='profit'||stats[key]>=0))&&stats.won<=stats.settled&&stats.settled+stats.abandoned<=stats.started&&stats.buyouts<=stats.won;
}
