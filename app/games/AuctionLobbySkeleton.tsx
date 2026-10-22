import AuctionLobby from './AuctionLobby';
import AuctionStatistics from './AuctionStatistics';
import AuctionWalletSummary from './AuctionWalletSummary';
export default function AuctionLobbySkeleton(){
 return <div className="auction-lobby-scene auction-lobby-pending" aria-busy="true"><p className="auction-loading-announcement" role="status">Loading Auction Progress…</p><section className="detail-section auction-wallet" aria-label="Virtual bankroll loading"><AuctionWalletSummary pending/><div className="auction-actions"><button className="game-control" type="button" disabled>Refresh market</button><button className="game-control" type="button" disabled>Reset cash &amp; inventory</button></div><p className="games-note auction-inventory-price-notice"/><div className="auction-inventory" aria-hidden="true"><span className="auction-inventory-summary-placeholder">▸ Inventory (…)</span></div></section><AuctionLobby pending available={false} preparing={false} imageError="" enter={async()=>{}} cash={0} feeBps={1000}/><AuctionStatistics save={null}/></div>;
}
