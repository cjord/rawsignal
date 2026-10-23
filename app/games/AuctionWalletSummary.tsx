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
 const title=kind==='inventory'?'Sellable Inventory':'Showcase Value',waiting=pending||loading&&Boolean(value?.count);
 return <div className={`auction-wallet-metric auction-wallet-${kind}`}>
  <span className="auction-wallet-label">{title}</span>
  <div className="auction-wallet-amount"><strong className={`auction-${kind}-value`}>{cardAmount(value,waiting,'net')}</strong><span>{pending?'– … Cards':`– ${value?.count??0} Cards`}</span></div>
 </div>;
}

function ValuationHint({values,loading,pending}:{values?:AuctionWalletValues;loading:boolean;pending:boolean}){
 return <WalletHint pending={pending} label="Wallet valuation">Card values are after the 10% selling fee. Gross market values: inventory {cardAmount(values?.inventory,loading&&Boolean(values?.inventory.count),'gross')}; showcase {cardAmount(values?.showcase,loading&&Boolean(values?.showcase.count),'gross')}. Total net worth includes cash and both card values, not Daily Challenge funds. Return showcase cards to inventory before selling. Unpriced cards stay N/A; known subtotals exclude them. Market prices are not guaranteed sale proceeds.</WalletHint>;
}

// Identical owner-loading and resolved slots; cash never waits for catalog/artwork.
export default function AuctionWalletSummary({values,loading=false,pending=false}:{values?:AuctionWalletValues;loading?:boolean;pending?:boolean}){
 const waiting=pending||loading&&Boolean((values?.inventory.count??0)+(values?.showcase.count??0));
 return <div className="auction-wallet-summary" aria-busy={pending||undefined}>
  <div className="auction-wallet-cash"><div><div className="auction-wallet-caption"><span className="games-eyebrow">Auction Wallet</span><ValuationHint values={values} loading={loading} pending={pending}/></div><h2>Available Cash</h2></div><strong className="auction-cash-value">{pending?<span className="auction-loading-line"/>:usd(values?.cash??0)}</strong></div>
  <div className="auction-wallet-breakdown">
   <div className="auction-wallet-metric auction-wallet-total"><span className="auction-wallet-label">Total Net Worth</span><div><strong className="auction-net-worth">{waiting?'Loading…':values?.netWorth==null?'N/A':usd(values.netWorth)}</strong><small className="auction-wallet-coverage">{!waiting&&values?.unpriced?`${values.unpriced} unpriced · Known ${usd(values.knownNetWorth)}`:'\u00a0'}</small></div></div>
   <CardValue kind="inventory" value={values?.inventory} loading={loading} pending={pending}/>
   <CardValue kind="showcase" value={values?.showcase} loading={loading} pending={pending}/>
  </div>
 </div>;
}
