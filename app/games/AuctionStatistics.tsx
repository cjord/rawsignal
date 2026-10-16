import type {AuctionSave} from '../../core/domain/auction-types';
import InfoHint from '../InfoHint';
import {auctionUsd} from './AuctionWallet';

export default function AuctionStatistics({save}:{save:AuctionSave}){
 const stats=save.statistics;
 if(!stats)return <section className="detail-section auction-statistics"><h2>Your Auction Statistics</h2><p className="games-note">Normal-play tracking begins with your next auction. Daily challenge cash and results are separate. Older auctions cannot be reconstructed from your wallet.</p></section>;
 const rows=[['Auctions Started',String(stats.started)],['Auctions Won',`${stats.won} / ${stats.settled}`],['Win Rate',stats.settled?`${(100*stats.won/stats.settled).toFixed(1)}%`:'—'],['Net Auction P/L',auctionUsd(stats.profit)],['Investigation Spend',auctionUsd(stats.investigations)],['Best Auction Profit',auctionUsd(stats.bestProfit)],['NPC Loss Shares',auctionUsd(stats.rebates)],['Early Buyout Wins',String(stats.buyouts)]];
 return <section className="detail-section auction-statistics"><h2>Your Auction Statistics <InfoHint label="Statistics definitions">Tracked in this browser from this update onward. Win rate counts settled auctions only; {stats.abandoned} abandoned auctions are excluded. Net Auction P/L includes abandoned entry/investigation costs and NPC loss shares. Won cards are valued at frozen entry prices after selling fees, not realized sales or subsequent market changes. Resetting progress clears these statistics.</InfoHint></h2><dl className="auction-statistics-grid">{rows.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>;
}
