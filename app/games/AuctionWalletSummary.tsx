import InfoHint from '../InfoHint';
import type {ReactNode} from 'react';
import type {AuctionWalletValues} from '../../core/domain/auction-wallet';
const usd=(cents:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100);
type Bucket=AuctionWalletValues['inventory'];
function WalletHint({pending,label,children}:{pending:boolean;label:string;children:ReactNode}){
 return pending?<span className="auction-wallet-hint-placeholder" aria-hidden="true"/>:<InfoHint label={label}>{children}</InfoHint>;
}
function cardAmount(value:Bucket|undefined,waiting:boolean,field:'gross'|'net'){
 if(waiting)return 'Loading…';
 if(value?.unpriced)return 'N/A';
 return usd(value?.[field]??0);
}

function CardValue({kind,value,loading,pending}:{kind:'inventory'|'showcase';value?:Bucket;loading:boolean;pending:boolean}){
 const title=kind==='inventory'?'Sellable Inventory':'Protected Showcase',waiting=pending||loading&&Boolean(value?.count);
 return <div className={`auction-wallet-metric auction-wallet-${kind}`}>
  <span className="auction-wallet-label">{title}<WalletHint pending={pending} label={`${title} valuation`}>{kind==='showcase'?'Return showcase cards to inventory before selling. ':''}Gross market value: {cardAmount(value,waiting,'gross')}. {Boolean(value?.unpriced)&&!waiting&&`Known after-fee subtotal: ${usd(value?.net??0)}; ${value?.unpriced} unpriced. `}Displayed card values are after the fixed 10% virtual selling fee, rounded by printing across owned cards. Missing prices are excluded from known subtotals, never valued at zero. Market prices are not guaranteed sale proceeds.</WalletHint></span>
  <strong className={`auction-${kind}-value`}>{cardAmount(value,waiting,'net')}</strong>
  <small>{pending?'Loading card count…':`${value?.count??0} cards · ${kind==='showcase'?'Protected from sales':'After 10% fee'}`}</small>
 </div>;
}

// Identical owner-loading and resolved slots; cash never waits for catalog/artwork.
export default function AuctionWalletSummary({values,loading=false,pending=false}:{values?:AuctionWalletValues;loading?:boolean;pending?:boolean}){
 const waiting=pending||loading&&Boolean((values?.inventory.count??0)+(values?.showcase.count??0));
 return <div className="auction-wallet-summary" aria-busy={pending||undefined}>
  <div className="auction-wallet-cash"><div><span className="games-eyebrow">Auction Wallet</span><h2>Available Cash</h2></div><strong className="auction-cash-value">{pending?<span className="auction-loading-line"/>:usd(values?.cash??0)}</strong><small>Spendable now · Normal auctions</small></div>
  <div className="auction-wallet-breakdown">
   <div className="auction-wallet-metric auction-wallet-total"><span className="auction-wallet-label">Virtual Net Worth<WalletHint pending={pending} label="Virtual net worth calculation">Cash plus inventory and protected showcase value after the 10% selling fee. This is not lifetime profit or immediately spendable cash. Daily Challenge funds are separate. Prices and source date are shown in Market Snapshot below.</WalletHint></span><strong className="auction-net-worth">{waiting?'Loading…':values?.netWorth==null?'N/A':usd(values.netWorth)}</strong><small>Cash + inventory + showcase</small></div>
   <CardValue kind="inventory" value={values?.inventory} loading={loading} pending={pending}/>
   <CardValue kind="showcase" value={values?.showcase} loading={loading} pending={pending}/>
  </div>
  <p className="games-note auction-wallet-coverage">{pending?'Loading wallet…':waiting?'Loading card values; your cash is ready.':values?.unpriced?`${values.unpriced} unpriced card${values.unpriced===1?'':'s'} · Known net worth: ${usd(values.knownNetWorth)} (cash + priced cards).`:'Card values are after the 10% selling fee. Showcase cards are protected from sales.'}</p>
 </div>;
}
