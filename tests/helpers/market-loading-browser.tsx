import {useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {renderToString} from 'react-dom/server';
import AccountProvider,{useAccount} from '../../app/account/AccountProvider';
import Home from '../../app/page';
import SetsView from '../../app/SetsView';
import MetricsView from '../../app/MetricsView';
import {usePreference,parseStrictness,STRICTNESS_KEY} from '../../app/state/usePreference';
import type {MetricsPayload} from '../../core/domain/metrics';
const metrics:MetricsPayload={generatedAt:'2026-10-21',rolledUpAt:'2026-10-21',series:{},overview:[],sets:[],sealedCategories:[],eras:[],momentum:[],movers:[]};
function Probe(){const account=useAccount(),[strictness]=usePreference(STRICTNESS_KEY,parseStrictness,'balanced');useEffect(()=>{document.documentElement.dataset.marketMounts=String(Number(document.documentElement.dataset.marketMounts??0)+1)},[]);return <><output aria-label="Account Phase">{account.loading?'loading':account.user?.id??'guest'}</output><output aria-label="Saved Strictness">{strictness}</output></>}
const view=new URLSearchParams(location.search).get('fixtureView');
const app=<AccountProvider enabled publicMarket><Probe/>{view==='sets'?<SetsView payload={{generatedAt:'2026-10-21',sets:[]}}/>:view==='metrics'?<MetricsView payload={metrics}/>:<Home/>}</AccountProvider>;
Object.assign(window,{marketServerMarkup:renderToString(app)});
createRoot(document.getElementById('fixture')!).render(app);
