import InfoHint from '../InfoHint';
const usd=(cents:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100);

// Same slots in the owner-loading shell and resolved wallet; prices never size the rows.
export default function AuctionWalletSummary({cash,net,loading=false,pending=false}:{cash?:number;net?:number|null;loading?:boolean;pending?:boolean}){
 return <div className="auction-wallet-title"><div><span className="games-eyebrow">Virtual Net Worth</span><p className="auction-net-worth" aria-hidden={pending||undefined}>
  <span className="auction-cash-value">{pending||cash==null?<span className="auction-loading-line"/>:usd(cash)}</span>{' '}
  <span className="auction-worth-holdings">+ (<span className="auction-inventory-value">{pending?<span className="auction-loading-line"/>:loading?'Loading…':net==null?'N/A':usd(net)} cards</span>)</span>
  {!pending&&<InfoHint label="Inventory valuation and selling fees">Inventory and showcase value use the latest catalog loaded here, less the fixed 10% virtual selling fee. Showcase cards must return to inventory before sale. Missing prices are unavailable, never zero. Market prices are not guaranteed sale proceeds. Use Refresh market to reload the catalog.</InfoHint>}
 </p></div></div>;
}
