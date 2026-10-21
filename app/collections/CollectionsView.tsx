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
import {parseCollectionQuery,serializeCollectionQuery,updateCollectionQuery,type CollectionFilters as Filters} from '../state/collection-query';
import {matchesHoldingHealth} from '../../core/domain/collection-health';
import {holdingCsv} from '../../core/domain/collection-export';
import CollectionCoverage from './CollectionCoverage';
import CollectionExportButton from './CollectionExportButton';
function useFilters(initial:string){const [value,setValue]=useState(()=>parseCollectionQuery(initial));useEffect(()=>{const pop=()=>setValue(parseCollectionQuery(location.search));window.addEventListener('popstate',pop);return()=>window.removeEventListener('popstate',pop)},[]);const update=(patch:Partial<Filters>)=>{const next=updateCollectionQuery(value,patch),query=serializeCollectionQuery(next);history.replaceState(null,'','/collections'+(query?'?'+query:''));setValue(next)};return [value,update] as const}
function LoadingCollection(){return <section className="detail-section collection-loading" aria-label="Loading Collections" aria-busy="true">
<div className="collection-metrics collection-overview-metrics">{[1,2,3,4,5,6].map(id=>
<div key={id} className="detail-skeleton collection-loading-metric"/>)}</div>
<div className="detail-skeleton collection-loading-toolbar"/>{[1,2,3].map(id=>
<div key={id} className="detail-skeleton collection-loading-row"/>)}</section>}
export default function CollectionsView({initialQuery=''}:{initialQuery?:string}){
 const account=useAccount(),store=useCollections(),[strictness,setStrictness]=usePreference(STRICTNESS_KEY,parseStrictness,'balanced'),[filter,change]=useFilters(initialQuery),[requested,setRequested]=useState(()=>requestedDialog(initialQuery)),[dialog,setDialog]=useState<'create'|'settings'|'add'|'import'|null>(()=>requestedDialog(initialQuery)),[lot,setLot]=useState<CollectionLot|null>(null),[sale,setSale]=useState<Holding|null>(null);
 const canAdd=hasCollections(store.data),initial=requested==='add'?initialProduct(initialQuery):undefined,busy=collectionBusy(store),closeRequest=()=>{setDialog(null);setRequested(null);change({})};
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
<CollectionPrivateBody store={store} busy={busy} canAdd={canAdd} pending={!!requested} filter={filter} change={change} onDialog={setDialog} onManage={setLot} onSell={setSale}/></>}
{store.data&&dialog==='create'&&<CollectionSettingsDialog onClose={()=>setDialog(null)} onCreated={()=>setDialog(requested)} onSave={store.act}/>}
{store.data&&dialog==='settings'&&<CollectionSettingsDialog collection={store.data.state.collections.find(row=>row.id===filter.collection)} onClose={()=>setDialog(null)} onSave={store.act}/>}
{canAdd&&store.data&&dialog==='add'&&<CollectionAddDialog initial={initial} collections={store.data.state.collections} selected={filter.collection} onSave={store.act} onClose={closeRequest}/>}
{canAdd&&store.data&&dialog==='import'&&<CollectionImportDialog state={store.data.state} revision={store.data.revision} selected={filter.collection} onSave={store.act} onClose={closeRequest}/>}
{lot&&store.data&&<CollectionLotDialog lot={lot} cardShow={cardShowLot(store.data,lot)} onSave={store.act} onClose={()=>setLot(null)}/>}
{sale&&store.data&&<CollectionSaleDialog holding={sale} events={store.data.state.events} collectionId={filter.collection} onSave={store.act} onClose={()=>setSale(null)}/>}
</main>
<SiteFooter/>
</>;
}
function requestedDialog(raw:string):'add'|'import'|null{const q=new URLSearchParams(raw);return q.has('add')?'add':q.has('reviewImport')?'import':null}
function collectionBusy(store:ReturnType<typeof useCollections>){return store.busy||store.loading||store.needsReload}
function CollectionPrivateBody({store,busy,canAdd,pending,filter,change,onDialog,onManage,onSell}:{store:ReturnType<typeof useCollections>;busy:boolean;canAdd:boolean;pending:boolean;filter:Filters;change:(patch:Partial<Filters>)=>void;onDialog:(value:'create'|'add'|'import'|'settings')=>void;onManage:(lot:CollectionLot)=>void;onSell:(holding:Holding)=>void}){return <><CollectionActions busy={busy} canAdd={canAdd} working={store.busy||store.loading} reloading={store.loading&&!!store.data} onDialog={onDialog} onReload={store.reload}/>{store.error&&<p className="account-notice" role="alert">{store.error} Unsaved form inputs stay in this tab. Close the dialog and reload before retrying an uncertain or conflicting save; there is no automatic overwrite.</p>}{store.loading&&!store.data?<LoadingCollection/>:store.data&&<>{!canAdd&&<CollectionOnboarding pending={pending} busy={busy} onCreate={()=>onDialog('create')}/>}<CollectionContent data={store.data} busy={busy} filter={filter} change={change} onSettings={()=>onDialog('settings')} onManage={onManage} onSell={onSell} onSave={store.act} onReview={collectionId=>void store.act({type:'review',collectionId}).catch(()=>{})}/></>}</>}
function CollectionActions({busy,canAdd,working,reloading,onDialog,onReload}:{busy:boolean;canAdd:boolean;working:boolean;reloading:boolean;onDialog:(value:'create'|'add'|'import')=>void;onReload:()=>void}){return <div className="collection-page-actions"><button className="game-control account-primary" onClick={()=>onDialog('create')} disabled={busy}>New Collection</button><button className="game-control" onClick={()=>onDialog('add')} disabled={busy||!canAdd}>Add Item</button><button className="game-control" onClick={()=>onDialog('import')} disabled={busy||!canAdd}>Review Collectr Import</button><button className="game-control" disabled={working} onClick={onReload}>Reload Saved Collection</button><span className="collection-reload-status" role="status">{reloading?'Loading Latest Save…':''}</span></div>}
function CollectionOnboarding({pending,busy,onCreate}:{pending:boolean;busy:boolean;onCreate:()=>void}){return <section className="detail-section collection-onboarding"><h2>Start Your First Collection</h2><ol><li>Create a named collection, such as Personal or Card Show Stock.</li><li>Add exact catalog printings or review your saved Collectr import.</li><li>Enter optional purchase costs, then mark a review point for future price changes.</li></ol>{pending&&<p>Your requested product or import will continue after you create a collection.</p>}<button className="game-control account-primary" disabled={busy} onClick={onCreate}>Create Your First Collection</button></section>}
function cardShowLot(data:ReturnType<typeof useCollections>['data'],lot:CollectionLot){return !!data?.state.collections.find(row=>row.id===lot.collectionId)?.cardShow}
function hasCollections(data:ReturnType<typeof useCollections>['data']){return Boolean(data&&data.state.collections.length)}
function initialProduct(raw:string){const query=new URLSearchParams(raw),id=Number(query.get('add'));return id>0?{productId:id,kind:query.get('kind')??'single',game:query.get('game')??'pokemon',printing:query.get('printing')??'Normal'}:undefined}
function CollectionContent({data,busy,filter,change,onSettings,onManage,onSell,onReview,onSave}:{data:NonNullable<ReturnType<typeof useCollections>['data']>;busy:boolean;filter:Filters;change:(patch:Partial<Filters>)=>void;onSettings:()=>void;onManage:(lot:CollectionLot)=>void;onSell:(holding:Holding)=>void;onReview:(collectionId:string)=>void;onSave:(action:unknown)=>Promise<unknown>}){
 const selected=data.state.collections.find(row=>row.id===filter.collection),scope=selected?.id??'all',holdings=collectionHoldings(data.state,data.prices,scope),visible=holdings.filter(row=>matchesHolding(row,filter)),sales=data.state.sales.filter(row=>scope==='all'||row.collectionId===scope),reviews=data.state.reviews.filter(row=>row.collectionId===scope),dated=data.prices.map(row=>row.asOf).filter((date):date is string=>!!date).sort();
 const events=data.state.events??[],expenses=scope==='all'?events.reduce((sum,event)=>sum+event.expensesCents,0):0;
 return <>
<div className="collection-toolbar">
<label>Collection<select value={scope} onChange={event=>change({collection:event.target.value})}>
<option value="all">All Collections</option>{data.state.collections.map(row=>
<option key={row.id} value={row.id}>{row.name}</option>)}</select>
</label>{selected&&<button className="game-control" disabled={busy} onClick={onSettings}>Collection Settings</button>}<small>{data.state.collections.length}/20 collections · {data.state.lots.length}/1,000 dated lots</small>
</div>
<p className="collection-scope-note">Overview: {selected?.name??'All Collections'} · ledger filters do not change these totals.</p><CollectionOverview holdings={holdings} sales={sales} expenses={expenses} allCollections={scope==='all'}/>
<CollectionCoverage holdings={holdings} onFilter={health=>change({health,section:'holdings'})}/>
<MarketTabs value={filter.section} onChange={section=>change({section:section as Filters['section']})} label="Collection Sections" options={[{key:'holdings',label:'Holdings'},{key:'sold',label:'Sold History'},{key:'shows',label:'Card Show Events'}]}/>
{data.pricingUnavailable&&<p className="account-notice">Current prices could not be checked. Holdings remain available; current values and comparisons show N/A, never old baselines as fresh prices.</p>}
{filter.section==='holdings'&&<><VisitMovers holdings={holdings} reviews={reviews} busy={busy} onReview={()=>onReview(scope)}/><HoldingsPanel data={data} holdings={visible} busy={busy} filter={filter} change={change} cardShow={selected?selected.cardShow:data.state.collections.some(row=>row.cardShow)} onManage={onManage} onSell={onSell}/></>}
{filter.section==='sold'&&<CollectionSales sales={sales} events={events} collections={data.state.collections} filter={filter} change={change} onSave={onSave}/>}
{filter.section==='shows'&&<CollectionEvents events={events} sales={data.state.sales} page={filter.page} onPage={page=>change({page})} onSave={onSave}/>}
<p className="games-note collection-provenance">TCGCSV / TCGplayer market snapshots · {data.prices.some(row=>row.source==='feed')?'Bundled feed fallback; source date unavailable':dated.length?`Oldest current source: ${dated[0].slice(0,10)} UTC`:'Source date unavailable'}. USD · Near Mint singles / unopened sealed. Private real-world holdings, not game inventory. Prices may lag, particularly on staging.</p>
</>;
}
function matchesHolding(row:Holding,filter:Filters){return (filter.game==='all'||row.product.game===filter.game)&&(filter.kind==='all'||row.product.kind===filter.kind)&&matchesHoldingHealth(row,filter.health)&&`${row.product.name} ${row.product.set} ${row.product.printing}`.toLowerCase().includes(filter.query.toLowerCase())}
function HoldingsPanel({data,holdings,busy,filter,change,cardShow,onManage,onSell}:{data:NonNullable<ReturnType<typeof useCollections>['data']>;holdings:Holding[];busy:boolean;filter:Filters;change:(patch:Partial<Filters>)=>void;cardShow:boolean;onManage:(lot:CollectionLot)=>void;onSell:(holding:Holding)=>void}){
 const sort=(column:Filters['sort'])=>change({sort:column,direction:filter.sort===column&&filter.direction==='desc'?'asc':'desc'});
 return <section className="detail-section">
<div className="collection-section-heading">
<h2>Holdings Ledger</h2>
<CollectionExportButton label="Export Holdings CSV" filename="raw-signal-holdings.csv" disabled={!holdings.length} build={()=>holdingCsv(holdings,data.state.collections)}/>
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
<label>Data Coverage<select value={filter.health} onChange={event=>change({health:event.target.value as Filters['health']})}><option value="all">All Holdings</option><option value="missing-price">Missing Market Prices</option><option value="missing-cost">Missing Purchase Costs</option><option value="missing-sticker">Missing Sticker Prices</option></select></label>
<MarketTabs value={filter.kind} onChange={kind=>change({kind})} label="Holding Type" options={[{key:'all',label:'All'},{key:'single',label:'Singles'},{key:'sealed',label:'Sealed'}]}/>
<button className="game-control" onClick={()=>change({query:'',game:'all',kind:'all',health:'all'})}>Clear Filters</button><small>{holdings.length} matching printings</small>
</div>
<CollectionLedger holdings={holdings} disabled={busy} view={filter.view} page={filter.page} onPage={page=>change({page})} cardShow={cardShow} sort={filter.sort} direction={filter.direction} onSort={sort} onManage={onManage} onSell={onSell}/>
</section>;
}
