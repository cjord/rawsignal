import AuctionLobby from './AuctionLobby';
import AuctionStatistics from './AuctionStatistics';
import AuctionWalletSummary from './AuctionWalletSummary';
import AuctionWalletControls from './AuctionWalletControls';
export default function AuctionLobbySkeleton(){
 return <div className="auction-lobby-scene auction-lobby-pending" aria-busy="true"><p className="auction-loading-announcement" role="status">Loading Auction Progress…</p><section className="detail-section auction-wallet" aria-label="Virtual bankroll loading"><AuctionWalletSummary pending/><AuctionWalletControls pending/></section><AuctionLobby pending available={false} preparing={false} imageError="" enter={async()=>{}} cash={0} feeBps={1000}/><AuctionStatistics save={null}/></div>;
}
