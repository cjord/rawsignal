import {initialAuctionSave,AUCTION_PAID_ENTRY,holdingKey,type AuctionSave,type DailyAuctionManifest,type AuctionCard} from './auction-types.ts';
import {generateAuctionLot,AUCTION_LOT_SIZES} from './auction-lots.ts';
import {auctionMarketPrior} from './auction-market-prior.ts';
import {dailyAuctionReceipt} from './auction-daily-results.ts';
import {auctionNpcRoster} from './auction-npcs.ts';

export const dailyAuctionDate=(now:number)=>new Date(now).toISOString().slice(0,10);
export function createDailyAuctionManifest(catalog:AuctionCard[],date:string,source:string):DailyAuctionManifest{
 const ordered=[...catalog].sort((a,b)=>holdingKey(a).localeCompare(holdingKey(b)));
 let seed=2166136261;for(const char of `auction-daily-v1:${date}`)seed=Math.imul(seed^char.charCodeAt(0),16777619)>>>0;
 const auctions:DailyAuctionManifest['auctions']=Array.from({length:5},(_,index)=>{
  const kind=index<3?'free':'paid',lotSeed=(seed+index*7919)>>>0,lot=generateAuctionLot(ordered,lotSeed,kind);
  if(lot.length<AUCTION_LOT_SIZES[kind].min)throw new Error('Not enough eligible cards for the daily challenge.');
  return {seed:lotSeed,kind,lot,marketPrior:auctionMarketPrior(ordered,lotSeed,kind),rivals:auctionNpcRoster(lotSeed).map(profile=>profile.name)};
 });
 return {version:1,date,source,auctions};
}
export function startDailyAuction(root:AuctionSave,manifest:DailyAuctionManifest,now:number):AuctionSave{
 if(root.auction||manifest.date!==dailyAuctionDate(now)||root.daily?.date===manifest.date)return root;
 const save=initialAuctionSave(),first=manifest.auctions[0];
 save.drafts={[first.kind]:first};
 return {...root,daily:{date:manifest.date,manifest,index:0,save,status:'playing',reward:0,receipts:[]}};
}
// All challenge progress and the normal-wallet reward share one localStorage transaction.
export function updateDailyAuction(root:AuctionSave,update:(save:AuctionSave)=>AuctionSave,now:number):AuctionSave{
 const daily=root.daily;if(!daily||daily.status!=='playing'||daily.date!==dailyAuctionDate(now))return root;
 let save=update(daily.save);if(save===daily.save)return root;
 let receipts=daily.receipts;
 if(daily.save.auction?.stage!=='result'&&save.auction?.stage==='result'){
  const result=save.auction.result!;
  receipts=[...(receipts??[]),dailyAuctionReceipt(save.auction)];
  save={...save,wallet:{...save.wallet,cash:save.wallet.cash+(result.winner==='You'?result.value-result.fee:0),inventory:[]}};
 }
 if(!daily.save.auction||save.auction)return {...root,daily:{...daily,save,...(receipts?{receipts}:{})}};
 if(daily.save.auction.stage!=='result')return {...root,daily:{...daily,save,status:'failed'}};
 const index=daily.index+1;
 if(index===5){
  const reward=Math.floor(Math.max(0,save.wallet.cash-250000)*.25);
  return {...root,wallet:{...root.wallet,cash:root.wallet.cash+reward},daily:{...daily,index,save,status:'completed',reward}};
 }
 const next=daily.manifest.auctions[index];
 const status=next.kind==='paid'&&save.wallet.cash<AUCTION_PAID_ENTRY?'failed':'playing';
 return {...root,daily:{...daily,index,save:{...save,drafts:{[next.kind]:next}},status}};
}
