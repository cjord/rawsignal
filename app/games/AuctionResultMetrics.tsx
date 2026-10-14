import type {Auction} from '../../core/domain/auction-types';
import {auctionMetricTone} from '../../core/domain/auction-display';
import {auctionUsd} from './AuctionWallet';
export default function AuctionResultMetrics({auction}:{auction:Auction}){
 const result=auction.result!;
 const metrics=[
  {label:'Collection Market Value',value:result.value,kind:'info' as const},
  {label:'Gross Market Spread',value:result.winner?result.value-result.bid:null,kind:'signed' as const},
  {label:`Selling Fee (${auction.feeBps/100}%)`,value:result.fee,kind:'cost' as const},
  {label:'Winner Net Profit / Loss',value:result.winner?result.net:null,kind:'signed' as const},
  {label:'Your Investigation Spend',value:result.playerExpenses,kind:'cost' as const},
  {label:'Your Auction Result',value:result.winner==='You'?result.net:-result.playerExpenses,kind:'signed' as const},
 ];
 return <dl className="auction-result-metrics">{metrics.map(metric=><div key={metric.label} className={auctionMetricTone(metric.value,metric.kind)}><dt>{metric.label}</dt><dd>{metric.value===null?'N/A':auctionUsd(metric.value)}</dd></div>)}</dl>;
}
