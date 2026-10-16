import {holdingKey,type Auction,type DailyAuctionManifest,type DailyAuctionReceipt} from './auction-types.ts';
import {auctionNpcRoster} from './auction-npcs.ts';
import {addInventory,inventoryQuote} from './auction-market.ts';

export function dailyAuctionReceipt(auction:Auction):DailyAuctionReceipt{
 const result=auction.result!,winner=result.winner==='You'?0:result.winner===null?-1:1+auction.npcs.findIndex(npc=>npc.name===result.winner);
 return [winner,result.bid,auction.spent,result.lossShares?.find(share=>share.name==='You')?.cents??0,auction.round,Number(result.buyout)];
}
export function validAuctionReceipts(value:unknown):value is DailyAuctionReceipt[]{
 return Array.isArray(value)&&value.length<=5&&value.every(row=>Array.isArray(row)&&row.length===6&&row.every(Number.isSafeInteger)&&row[0]>=-1&&row[0]<=3&&row.slice(1,4).every(amount=>amount>=0&&amount<=1e12)&&row[4]>=1&&row[4]<=4&&(row[5]===0||row[5]===1)&&(row[0]!==0||row[3]===0)&&(row[0]!==-1||row[1]===0&&row[3]===0));
}
export function dailyAuctionResults(manifest:DailyAuctionManifest,receipts:DailyAuctionReceipt[]){
 const rows=receipts.map(([winner,bid,investigations,credit,round,buyout],index)=>{
  const draft=manifest.auctions[index],gross=draft.lot.reduce((sum,card)=>sum+card.cents,0),net=inventoryQuote(addInventory([],draft.lot),draft.lot,1000).net;
  const won=winner===0,entry=draft.kind==='paid'?5000:0,profit=(won?net-bid:credit)-investigations-entry;
  const winnerName=winner===0?'You':winner===-1?'No Sale':draft.rivals?.[winner-1]??auctionNpcRoster(draft.seed)[winner-1].name;
  return {index,won,winnerName,bid,investigations,credit,round,buyout:Boolean(buyout),gross,fee:gross-net,entry,profit};
 });
 const profit=rows.reduce((sum,row)=>sum+row.profit,0),won=rows.filter(row=>row.won).length;
 const copies=manifest.auctions.flatMap((draft,index)=>receipts[index]?.[0]===0?draft.lot:[]),cards=new Map<string,{card:Auction['lot'][number];quantity:number}>();
 for(const card of copies){const key=holdingKey(card),existing=cards.get(key);cards.set(key,{card,quantity:(existing?.quantity??0)+1})}
 return {rows,profit,won,cash:250000+profit,reward:Math.floor(Math.max(0,profit)*.25),investigations:rows.reduce((sum,row)=>sum+row.investigations,0),entries:rows.reduce((sum,row)=>sum+row.entry,0),copies:copies.length,top:[...cards.values()].sort((a,b)=>b.card.cents-a.card.cents||a.card.productId-b.card.productId).slice(0,5)};
}
