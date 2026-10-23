import {createRoot} from 'react-dom/client';
import FullViewCardWrap from '../../app/leaderboard/FullViewCardWrap';
import FullMarketCard from '../../app/leaderboard/FullMarketCard';
import MarketLeaderboard from '../../app/leaderboard/MarketLeaderboard';
import HistoryPanel from '../../app/HistoryPanel';
import {cardFavorite} from '../../app/state/favorites';

const sealed=new URLSearchParams(location.search).get('mode')==='sealed';
const points=Array.from({length:32},(_,i)=>({date:new Date(Date.UTC(2026,8,i+1)).toISOString().slice(0,10),price:100+i*2}));
const rows=Array.from({length:12},(_,i)=>{
 const product={game:'riftbound',productId:990000+i,name:`A Long Collection Name with Multiple Printing Details ${i+1}`,set:'Origins',number:String(i),section:'rares',image:null,marketPrice:i===2?null:162};
 const metrics=Array.from({length:sealed?10:8},(_,index)=>({label:`Market ${index+1}`,value:i===2?'N/A':'$12,345.67'}));
 const history=<HistoryPanel title={sealed?'Unopened Market History':'Near Mint Market History'} subtitle="Foil" points={i===2?[]:points} metrics={sealed?metrics:[]} large/>;
 return <FullViewCardWrap key={product.productId} signal={null} favorite={cardFavorite(product)} href={`/cards/${product.productId}`} label={`View fixture ${i+1}`}><FullMarketCard className={sealed?'sealed-full-card':'leader-row full-card'} artClassName={sealed?'sealed-full-art':'full-art'} dataClassName={sealed?'sealed-full-data':'full-data'} titleClassName={sealed?'sealed-full-title':'full-title'} alt="Unavailable artwork" title={product.name} meta="Foil · Rare" secondary={sealed?undefined:<em>Origins · 2026</em>} rank={sealed?undefined:i+1} content={sealed?history:<span className="full-prices">{metrics.map(metric=><span key={metric.label}><small>{metric.label}</small><b>{metric.value}</b></span>)}</span>} history={sealed?undefined:history} historyClassName="full-history"/></FullViewCardWrap>;
});
createRoot(document.getElementById('fixture')!).render(<main className="page"><header className="full-resize-intro"><h1>Full view resize fixture</h1></header><MarketLeaderboard className="leaderboard" id="resize-fixture" header={null} controls={null} sortSurface={null} rowsClassName={sealed?'sealed-rows sealed-view-full':'rows view-full'} state="ready" loadingLabel="Loading" skeletonCount={8} errorMessage="Unavailable" emptyMessage="No cards" onRetry={()=>{}} rows={rows}/></main>);
