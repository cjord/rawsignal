import AuctionLink from './AuctionLink';

export default function AuctionWalletControls({pending=false,loading=false,refresh,reset}:{pending?:boolean;loading?:boolean;refresh?:()=>void;reset?:()=>void}){
 return <div className="auction-actions auction-wallet-controls">
  <div>{pending?<><button className="game-control" disabled>Inventory</button><button className="game-control" disabled>My Showcase</button></>:<><AuctionLink className="game-control game-control-primary" href="/games/riftbound-auction/inventory">Inventory</AuctionLink><AuctionLink className="game-control game-control-secondary" href="/games/riftbound-auction/showcase">My Showcase</AuctionLink></>}</div>
  <div><button className="game-control" type="button" disabled={pending||loading} onClick={refresh}>Refresh market</button><button className="game-control" type="button" disabled={pending} onClick={reset}>Reset cash &amp; inventory</button></div>
 </div>;
}
