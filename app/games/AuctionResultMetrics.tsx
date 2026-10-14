import type {Auction} from '../../core/domain/auction-types';
import {auctionMetricTone,auctionRevealQuote} from '../../core/domain/auction-display';
import {auctionUsd} from './AuctionWallet';
export default function AuctionResultMetrics({auction,visible,done}:{auction:Auction;visible:number[];done:boolean}){
 const result=auction.result!,quote=auctionRevealQuote(auction,visible);
 const counting=!done,loading=counting&&visible.every(index=>auction.known.includes(index));
 const metrics=[
  {label:'Collection Market Value',value:quote.value,kind:'info' as const},
  {label:'Gross Market Spread',value:result.winner?quote.value-result.bid:null,kind:'signed' as const},
  {label:`Selling Fee (${auction.feeBps/100}%)`,value:quote.fee,kind:'cost' as const},
  {label:'Winner Net Profit / Loss',value:result.winner?quote.net:null,kind:'signed' as const},
  {label:'Your Investigation Spend',value:result.playerExpenses,kind:'cost' as const},
  {label:'Your Auction Result',value:result.winner==='You'?quote.net:-result.playerExpenses,kind:'signed' as const},
 ];
 return <><p className="games-note" role="status">{counting?`Counting Collection · ${visible.length} / ${auction.lot.length} cards · values reflect revealed cards only.`:'Collection Count Complete'}</p><dl className="auction-result-metrics" aria-busy={counting}>{metrics.map(metric=><div key={metric.label} className={loading?'':auctionMetricTone(metric.value,metric.kind)}><dt>{metric.label}</dt><dd>{loading?<span className="detail-skeleton auction-value-skeleton" aria-label="Waiting for collection count"/>:metric.value===null?'N/A':auctionUsd(metric.value)}</dd></div>)}</dl></>;
}
