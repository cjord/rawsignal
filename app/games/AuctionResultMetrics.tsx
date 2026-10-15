import type {Auction} from '../../core/domain/auction-types';
import {auctionMetricTone,auctionRevealQuote} from '../../core/domain/auction-display';
import {auctionUsd} from './AuctionWallet';
import AuctionBidder from './AuctionBidder';
import InfoHint from '../InfoHint';
export default function AuctionResultMetrics({auction,visible,done}:{auction:Auction;visible:number[];done:boolean}){
 const result=auction.result!,quote=auctionRevealQuote(auction,visible);
 const counting=!done,loading=counting&&visible.every(index=>auction.known.includes(index));
 const share=done?result.lossShares?.find(share=>share.name==='You')?.cents??0:0;
 const metrics=[
  {label:'Collection Market Value',value:quote.value,kind:'info' as const},
  {label:`Selling Fee (${auction.feeBps/100}%)`,value:quote.fee,kind:'cost' as const},
  {label:'Winner Net Profit / Loss',value:result.winner?quote.net:null,kind:'signed' as const},
  {label:'Your Investigation Spend',value:result.playerExpenses,kind:'cost' as const},
  {label:'Auction Entry Fee',value:auction.entryFee??0,kind:'cost' as const},
  {label:'Your Auction Result',value:result.winner==='You'?quote.net:share-result.playerExpenses-(auction.entryFee??0),kind:'signed' as const},
 ];
 return <><p className="games-note" role="status">{counting?`Counting Collection · ${visible.length} / ${auction.lot.length} cards · values reflect revealed cards only.`:'Collection Count Complete'} <InfoHint label="Collection value explanation">Market value uses frozen auction prices and adds up as cards flip. Winner net deducts selling fees and the winning bid; when you win, it also deducts your investigation spend and entry fee. Your Auction Result includes your own costs and any NPC loss share.</InfoHint></p><dl className="auction-result-metrics" aria-busy={counting}>{metrics.map(metric=><div key={metric.label} className={loading?'':auctionMetricTone(metric.value,metric.kind)}><dt>{metric.label}</dt><dd>{loading?<span className="detail-skeleton auction-value-skeleton" aria-label="Waiting for collection count"/>:metric.value===null?'N/A':auctionUsd(metric.kind==='cost'&&metric.value>0?-metric.value:metric.value)}</dd></div>)}</dl>{done&&!!result.lossShares?.length&&<div className="auction-loss-expand"><div className="auction-loss-content"><div className="auction-loss-shares"><h3>NPC Loss Shared</h3><p className="games-note">The winner’s loss after selling fees is split between the other three bidders. Your share has been added to your cash.</p><ul>{result.lossShares.map(share=><li key={share.name}><AuctionBidder name={share.name}/><strong>{auctionUsd(share.cents)}</strong></li>)}</ul></div></div></div>}</>;
}
