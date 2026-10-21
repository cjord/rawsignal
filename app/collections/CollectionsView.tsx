"use client";
import {useEffect,useState} from 'react';
import TopBar from '../TopBar';
import SiteFooter from '../SiteFooter';
import {useAccount} from '../account/context';
import {usePreference,STRICTNESS_KEY,parseStrictness} from '../state/usePreference';
import {SegmentedView} from '../MarketUI';
import MarketTabs from '../MarketTabs';
import {collectionHoldings,type Holding,type CollectionLot} from '../../core/domain/owned-collections';
import CollectionLedger from './CollectionLedger';
import {CollectionOverview,VisitMovers} from './CollectionOverview';
import CollectionAddDialog from './CollectionAddDialog';
import CollectionImportDialog from './CollectionImportDialog';
import {CollectionLotDialog,CollectionSaleDialog,CollectionSettingsDialog} from './CollectionManageDialog';
import {useCollections} from './useCollections';
import CollectionEvents from './CollectionEvents';
import CollectionSales from './CollectionSales';
type Filters={collection:string;query:string;game:string;kind:string;view:'table'|'grid';sort:'name'|'quantity'|'value'|'change'|'percent';direction:'asc'|'desc';section:'holdings'|'sold'|'shows'};
function filters(raw:string):Filters{const q=new URLSearchParams(raw);return {collection:q.get('collection')??'all',query:q.get('q')??'',game:['pokemon','riftbound','onepiece'].includes(q.get('game')??'')?q.get('game')!:'all',kind:['single','sealed'].includes(q.get('kind')??'')?q.get('kind')!:'all',view:q.get('view')==='grid'?'grid':'table',sort:['name','quantity','change','percent'].includes(q.get('sort')??'')?q.get('sort') as Filters['sort']:'value',direction:q.get('direction')==='asc'?'asc':'desc',section:q.get('section')==='shows'?'shows':q.get('section')==='sold'?'sold':'holdings'}}
function useFilters(initial:string){const [value,setValue]=useState(()=>filters(initial));useEffect(()=>{const pop=()=>setValue(filters(location.search));window.addEventListener('popstate',pop);return()=>window.removeEventListener('popstate',pop)},[]);const update=(patch:Partial<Filters>)=>{const next={...value,...patch},query=new URLSearchParams();for(const [key,item] of Object.entries(next))query.set(key==='query'?'q':key,item);history.replaceState(null,'','/collections?'+query);setValue(next)};return [value,update] as const}
function LoadingCollection(){return <section className="detail-section collection-loading" aria-label="Loading Collections" aria-busy="true">
<div className="collection-metrics collection-overview-metrics">{[1,2,3,4,5,6].map(id=>
<div key={id} className="detail-skeleton collection-loading-metric"/>)}</div>
<div className="detail-skeleton collection-loading-toolbar"/>{[1,2,3].map(id=>
<div key={id} className="detail-skeleton collection-loading-row"/>)}</section>}
export default function CollectionsView({initialQuery=''}:{initialQuery?:string}){
 const account=useAccount(),store=useCollections(),[strictness,setStrictness]=usePreference(STRICTNESS_KEY,parseStrictness,'balanced'),[filter,change]=useFilters(initialQuery),[dialog,setDialog]=useState<'create'|'settings'|'add'|'import'|null>(()=>new URLSearchParams(initialQuery).has('add')?'add':new URLSearchParams(initialQuery).has('reviewImport')?'import':null),[lot,setLot]=useState<CollectionLot|null>(null),[sale,setSale]=useState<Holding|null>(null);
 const canAdd=hasCollections(store.data),initial=initialProduct(initialQuery);
 return <>
<TopBar active="collections" strictness={strictness} onStrictness={setStrictness}/>
<main className="detail-content collections-page">
<header className="games-heading">
<span className="games-eyebrow">Raw Signal · Private Account Holdings</span>
<h1>Collections</h1>
<p>Track what you own, how the market has moved, and what changed since your last review.</p>
</header>{account.loading?<LoadingCollection/>:!account.user?<section className="detail-section">
<h2>Your Collection, Saved to Your Account</h2>
<p>Log in to track real cards and sealed products across devices. Guest and Auction House inventories are never imported automatically.</p>
<a className="game-control account-primary" href="/account">Log In to Collections</a>
</section>:!account.features?.collections?<section className="detail-section">
<p>Collections are not enabled in this environment yet.</p>
</section>:<>
<div className="collection-page-actions">
<button className="game-control account-primary" onClick={()=>setDialog('create')} disabled={store.busy}>New Collection</button>
<button className="game-control" onClick={()=>setDialog('add')} disabled={store.busy||!canAdd}>Add Item</button>
<button className="game-control" onClick={()=>setDialog('import')} disabled={store.busy||!canAdd}>Review Collectr Import</button>
<button className="game-control" disabled={store.busy||store.loading} onClick={store.reload}>Reload Saved Collection</button>
</div>{store.error&&<p className="account-notice" role="alert">{store.error} Unsaved form inputs stay in this tab. If another device changed the collection, reload before retrying; there is no automatic overwrite.</p>}{store.loading?<LoadingCollection/>:store.data&&<CollectionContent data={store.data} busy={store.busy} filter={filter} change={change} onSettings={()=>setDialog('settings')} onManage={setLot} onSell={setSale} onSave={store.act} onReview={collectionId=>void store.act({type:'review',collectionId}).catch(()=>{})}/>}</>}
{store.data&&dialog==='create'&&<CollectionSettingsDialog onClose={()=>setDialog(null)} onSave={store.act}/>}
{store.data&&dialog==='settings'&&<CollectionSettingsDialog collection={store.data.state.collections.find(row=>row.id===filter.collection)} onClose={()=>setDialog(null)} onSave={store.act}/>}
{canAdd&&store.data&&dialog==='add'&&<CollectionAddDialog initial={initial} collections={store.data.state.collections} selected={filter.collection} onSave={store.act} onClose={()=>setDialog(null)}/>}
{canAdd&&store.data&&dialog==='import'&&<CollectionImportDialog state={store.data.state} revision={store.data.revision} selected={filter.collection} onSave={store.act} onClose={()=>setDialog(null)}/>}
{lot&&<CollectionLotDialog lot={lot} cardShow={cardShowLot(store.data,lot)} onSave={store.act} onClose={()=>setLot(null)}/>}
{sale&&store.data&&<CollectionSaleDialog holding={sale} events={store.data.state.events} collectionId={filter.collection} onSave={store.act} onClose={()=>setSale(null)}/>}
</main>
<SiteFooter/>
</>;
}
function cardShowLot(data:ReturnType<typeof useCollections>['data'],lot:CollectionLot){return !!data?.state.collections.find(row=>row.id===lot.collectionId)?.cardShow}
function hasCollections(data:ReturnType<typeof useCollections>['data']){return Boolean(data&&data.state.collections.length)}
function initialProduct(raw:string){const query=new URLSearchParams(raw),id=Number(query.get('add'));return id>0?{productId:id,kind:query.get('kind')??'single',game:query.get('game')??'pokemon',printing:query.get('printing')??'Normal'}:undefined}
function CollectionContent({data,busy,filter,change,onSettings,onManage,onSell,onReview,onSave}:{data:NonNullable<ReturnType<typeof useCollections>['data']>;busy:boolean;filter:Filters;change:(patch:Partial<Filters>)=>void;onSettings:()=>void;onManage:(lot:CollectionLot)=>void;onSell:(holding:Holding)=>void;onReview:(collectionId:string)=>void;onSave:(action:unknown)=>Promise<unknown>}){
 const selected=data.state.collections.find(row=>row.id===filter.collection),scope=selected?.id??'all',holdings=collectionHoldings(data.state,data.prices,scope),visible=holdings.filter(row=>(filter.game==='all'||row.product.game===filter.game)&&(filter.kind==='all'||row.product.kind===filter.kind)&&`${row.product.name} ${row.product.set} ${row.product.printing}`.toLowerCase().includes(filter.query.toLowerCase())),sales=data.state.sales.filter(row=>scope==='all'||row.collectionId===scope),reviews=data.state.reviews.filter(row=>row.collectionId===scope),dated=data.prices.map(row=>row.asOf).filter((date):date is string=>!!date).sort();
 const events=data.state.events??[],expenses=scope==='all'?events.reduce((sum,event)=>sum+event.expensesCents,0):0;
 return <>
<div className="collection-toolbar">
<label>Collection<select value={scope} onChange={event=>change({collection:event.target.value})}>
<option value="all">All Collections</option>{data.state.collections.map(row=>
<option key={row.id} value={row.id}>{row.name}</option>)}</select>
</label>{selected&&<button className="game-control" disabled={busy} onClick={onSettings}>Collection Settings</button>}<small>{data.state.collections.length}/20 collections · {data.state.lots.length}/1,000 dated lots</small>
</div>
<CollectionOverview holdings={holdings} sales={sales} expenses={expenses} allCollections={scope==='all'}/>
<MarketTabs value={filter.section} onChange={section=>change({section:section as Filters['section']})} label="Collection Sections" options={[{key:'holdings',label:'Holdings'},{key:'sold',label:'Sold History'},{key:'shows',label:'Card Show Events'}]}/>
{data.pricingUnavailable&&<p className="account-notice">Current prices could not be checked. Holdings remain available; current values and comparisons show N/A, never old baselines as fresh prices.</p>}
{filter.section==='holdings'&&<><VisitMovers holdings={holdings} reviews={reviews} busy={busy} onReview={()=>onReview(scope)}/><HoldingsPanel holdings={visible} filter={filter} change={change} cardShow={selected?selected.cardShow:data.state.collections.some(row=>row.cardShow)} onManage={onManage} onSell={onSell}/></>}
{filter.section==='sold'&&<CollectionSales sales={sales} events={events} onSave={onSave}/>}
{filter.section==='shows'&&<CollectionEvents events={events} sales={data.state.sales} onSave={onSave}/>}
<p className="games-note collection-provenance">TCGCSV / TCGplayer market snapshots · {data.prices.some(row=>row.source==='feed')?'Bundled feed fallback; source date unavailable':dated.length?`Oldest current source: ${dated[0].slice(0,10)} UTC`:'Source date unavailable'}. USD · Near Mint singles / unopened sealed. Private real-world holdings, not game inventory. Prices may lag, particularly on staging.</p>
</>;
}
function HoldingsPanel({holdings,filter,change,cardShow,onManage,onSell}:{holdings:Holding[];filter:Filters;change:(patch:Partial<Filters>)=>void;cardShow:boolean;onManage:(lot:CollectionLot)=>void;onSell:(holding:Holding)=>void}){
 const sort=(column:Filters['sort'])=>change({sort:column,direction:filter.sort===column&&filter.direction==='desc'?'asc':'desc'});
 return <section className="detail-section">
<div className="collection-section-heading">
<h2>Holdings Ledger</h2>
<SegmentedView value={filter.view} onChange={view=>change({view})} options={[{key:'table',label:'Table',icon:'☷'},{key:'grid',label:'Card Grid',icon:'▦'}]}/>
</div>
<div className="collection-toolbar">
<label>Search Your Holdings<input value={filter.query} onChange={event=>change({query:event.target.value})} placeholder="Name, set or printing"/>
</label>
<label>Game<select value={filter.game} onChange={event=>change({game:event.target.value})}>
<option value="all">All Games</option>
<option value="pokemon">Pokémon</option>
<option value="riftbound">Riftbound</option>
<option value="onepiece">One Piece</option>
</select>
</label>
<MarketTabs value={filter.kind} onChange={kind=>change({kind})} label="Holding Type" options={[{key:'all',label:'All'},{key:'single',label:'Singles'},{key:'sealed',label:'Sealed'}]}/>
</div>
<CollectionLedger holdings={holdings} view={filter.view} cardShow={cardShow} sort={filter.sort} direction={filter.direction} onSort={sort} onManage={onManage} onSell={onSell}/>
</section>;
}
