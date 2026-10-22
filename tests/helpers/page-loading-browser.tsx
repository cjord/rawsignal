import {createRoot} from 'react-dom/client';
import {renderToString} from 'react-dom/server';
import AccountProvider from '../../app/account/AccountProvider';
import SetsView from '../../app/SetsView';
import MetricsView from '../../app/MetricsView';
import AuctionBackdrop from '../../app/games/AuctionBackdrop';
import {initialSetsScope} from '../../app/state/sets-scope';
import {initialMetricsScope} from '../../app/state/metrics-scope';
import type {SetDirectoryRow} from '../../core/domain/sets';
import type {MetricsPayload} from '../../core/domain/metrics';
const sets:SetDirectoryRow[]=['riftbound','pokemon'].map(game=>({game,set:game==='riftbound'?'Fixture Origins':'Fixture Pokémon',slug:game,group:game==='riftbound'?'core':'sv',releaseDate:null,releaseYear:2026,chase:1,sealed:0,trackedValue:100,change7:null,change30:null,buySignals:0,sellSignals:0,cover:null}));
const metrics:MetricsPayload={generatedAt:'2026-10-21',rolledUpAt:'2026-10-21',series:{},overview:['riftbound','pokemon'].map(game=>({key:game,label:game==='riftbound'?'Riftbound singles':'Pokémon singles',game,kind:'single',trackedValue:100,products:1,change7:null,change30:null,change90:null})),sets:[],sealedCategories:[],eras:[],momentum:[],movers:[]};
const params=new URLSearchParams(location.search),kind=params.get('kind'),seed=params.get('seed')==='1';
const app=<AccountProvider enabled={false}>{kind?.startsWith('backdrop')?<AuctionBackdrop seed={42} fill catalog={Array.from({length:36},(_,index)=>({image:kind==='backdrop-thumbnail'?`https://tcgplayer-cdn.tcgplayer.com/product/${991000+index}_in_1000x1000.jpg`:`https://backdrop.example/${index}.svg`}))}/>:kind==='sets'?<SetsView payload={{generatedAt:'2026-10-21',sets}} initialScope={seed?initialSetsScope(location.search):null}/>:<MetricsView payload={metrics} initialScope={seed?initialMetricsScope(location.search):null}/>}</AccountProvider>;
// Capture the real server-rendered component shape before browser effects run.
Object.assign(window,{scopeServerMarkup:renderToString(app)});
createRoot(document.getElementById('fixture')!).render(app);
