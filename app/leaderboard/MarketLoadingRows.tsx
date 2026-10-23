import FullMarketCard from './FullMarketCard';

function Lines(){return <><i className="market-loading-line"/><i className="market-loading-line is-short"/></>}
function Metrics({count=5}:{count?:number}){return <span className="full-prices">{Array.from({length:count},(_,i)=><span key={i}><Lines/></span>)}</span>}
function Chart(){return <span className="market-loading-chart"><Lines/><i/></span>}

/** Match the shared finished-card frames; artwork never gates text/data readiness. */
export default function MarketLoadingRows({rowsClassName,label,count}:{rowsClassName:string;label:string;count:number}){
 const classes=rowsClassName.split(' '),large=classes.includes('view-large'),full=classes.includes('view-full')||classes.includes('sealed-view-full'),sealed=classes.includes('sealed-view-full');
 if(!large&&!full)return <div className="row-skeletons" role="status" aria-label={label}>{Array.from({length:count},(_,i)=><span key={i} aria-hidden="true"/>)}</div>;
 return <div className={`market-card-skeletons${large?' is-large':''}`} role="status" aria-label={label}>{Array.from({length:count},(_,i)=>large?
  <div className="leader-row market-loading-card" key={i} aria-hidden="true"><span className="identity"><span className="deferred-image market-loading-art"/><Lines/></span><span className="set-name"><Lines/></span><span className="market-price"><i className="market-loading-line is-short"/></span><span className="change-pair"><Lines/></span></div>:
  <div key={i} aria-hidden="true"><FullMarketCard className={`${sealed?'sealed-full-card':'leader-row full-card'} market-loading-card`} artClassName={`${sealed?'sealed-full-art':'full-art'} market-loading-art`} dataClassName={sealed?'sealed-full-data':'full-data'} titleClassName={sealed?'sealed-full-title':'full-title'} alt="" title="" meta={<Lines/>} rank={sealed?undefined:i+1} content={sealed?<><Chart/><Metrics count={10}/></>:<Metrics/>} history={sealed?undefined:<Chart/>} historyClassName="full-history"/></div>
 )}</div>;
}
