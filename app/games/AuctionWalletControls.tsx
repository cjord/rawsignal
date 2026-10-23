export default function AuctionWalletControls({pending=false,reset}:{pending?:boolean;reset?:()=>void}){
 return <div className="auction-actions auction-wallet-controls">
  <button className="game-control game-control-danger" type="button" disabled={pending} onClick={reset}>Reset cash &amp; inventory</button>
 </div>;
}
