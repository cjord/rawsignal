import {memo} from 'react';
import type {AuctionSave} from '../../core/domain/auction-types';
import InfoHint from '../InfoHint';
import {auctionUsd} from './AuctionWallet';
import {emptyAuctionStatistics} from '../../core/domain/auction-statistics';

function AuctionStatistics({save,shared=false,live=false}:{save:AuctionSave|null;shared?:boolean;live?:boolean}){
 const stats=save?.statistics??emptyAuctionStatistics(),positive=(value:number)=>value>0?'gain':'neutral';
 const rows=[
  {label:'Auctions Started',value:String(stats.started),tone:'blue'},
  {label:'Auctions Won',value:`${stats.won} / ${stats.settled}`,tone:positive(stats.won)},
  {label:'Win Rate',value:stats.settled?`${(100*stats.won/stats.settled).toFixed(1)}%`:'—',tone:'purple'},
  {label:'Net Auction P/L',value:auctionUsd(stats.profit),tone:stats.profit<0?'loss':positive(stats.profit)},
  {label:'Investigation Spend',value:auctionUsd(stats.investigations),tone:stats.investigations?'cost':'neutral'},
  {label:'Best Auction Profit',value:auctionUsd(stats.bestProfit),tone:positive(stats.bestProfit)},
  {label:'NPC Loss Shares',value:auctionUsd(stats.rebates),tone:positive(stats.rebates)},
  {label:'Early Buyout Wins',value:String(stats.buyouts),tone:'purple'},
 ];
 return <section className="detail-section auction-statistics"><h2>{shared?'Auction Statistics':'Your Auction Statistics'} {save&&<InfoHint label="Statistics definitions">{live?'Account-linked, browser-reported statistics—not a verified record.':shared?'Self-reported snapshot, not a verified record.':'Tracked from this update onward; signed-in progress follows your account.'} Daily challenge cash and results are separate. Older auctions cannot be reconstructed from your wallet; normal-play tracking starts with tracked auctions. Win rate counts settled auctions only; {stats.abandoned} abandoned auctions are excluded. Net Auction P/L includes abandoned entry/investigation costs and NPC loss shares. Won cards are valued at frozen entry prices after selling fees, not realized sales or subsequent market changes.</InfoHint>}</h2><dl className="auction-statistics-grid">{rows.map(({label,value,tone})=><div key={label} data-stat-tone={save?tone:'neutral'}><dt>{label}</dt><dd>{save?value:<span className="auction-loading-line"/>}</dd></div>)}</dl></section>;
}
export default memo(AuctionStatistics);
