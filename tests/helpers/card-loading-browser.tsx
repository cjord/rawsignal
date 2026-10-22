import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import MarketLeaderboard from '../../app/leaderboard/MarketLeaderboard';
import FullMarketCard from '../../app/leaderboard/FullMarketCard';
function Fixture(){
 const [ready,setReady]=useState(false),view=new URLSearchParams(location.search).get('view')??'large',sealed=view==='sealed-full',full=view!=='large';
 Object.assign(window,{revealMarket:()=>setReady(true)});
 const metrics=<span className="full-prices">{Array.from({length:sealed?10:5},(_,i)=><span key={i}><small>Market</small><b>N/A</b></span>)}</span>,chart=<span className="market-loading-chart"><small>Market history</small><b>No history available</b><i/></span>;
 const card=full?<FullMarketCard className={sealed?'sealed-full-card':'leader-row full-card'} artClassName={sealed?'sealed-full-art':'full-art'} dataClassName={sealed?'sealed-full-data':'full-data'} titleClassName={sealed?'sealed-full-title':'full-title'} alt="Unavailable artwork" title="An exact catalog printing" meta="Normal · Rare" secondary={sealed?undefined:<em>Origins · 2025</em>} rank={sealed?undefined:1} content={sealed?<>{chart}{metrics}</>:metrics} history={sealed?undefined:chart} historyClassName="full-history"/>:<article className="leader-row"><span className="identity"><span className="deferred-image"/><b>An exact catalog printing</b><small>Normal · Rare</small></span><span className="set-name">Origins · 2025</span><span className="market-price">N/A</span><span className="change-pair">N/A · N/A</span></article>;
 return <main className="page"><MarketLeaderboard className="leaderboard" id="loading-fixture" header={null} controls={null} sortSurface={null} rowsClassName={sealed?'sealed-rows sealed-view-full':`rows view-${view}`} state={ready?'ready':'loading'} loadingLabel="Loading catalog cards" skeletonCount={8} errorMessage="Unavailable" emptyMessage="No cards" onRetry={()=>{}} rows={Array.from({length:8},(_,i)=><div className="fixture-result" key={i}>{card}</div>)}/></main>;
}
createRoot(document.getElementById('fixture')!).render(<Fixture/>);
