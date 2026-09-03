"use client";
/* eslint-disable react-hooks/set-state-in-effect -- the stored import and the ?profile= deep link hydrate once from device storage after mount, the same pattern TopBar uses for display preferences */
import {useEffect,useMemo,useRef,useState} from "react";
import FavoriteStar from "./FavoriteStar";
import InfoHint from "./InfoHint";
import MarketTabs from "./MarketTabs";
import MultiSelectField from "./MultiSelectField";
import PerPageSelect from "./PerPageSelect";
import SlidingTabs from "./SlidingTabs";
import TopBar from "./TopBar";
import SiteFooter from "./SiteFooter";
import HistoryPanel,{standardHistoryMetrics} from "./HistoryPanel";
import HistoryPopover from "./leaderboard/HistoryPopover";
import ProductIdentity from "./leaderboard/ProductIdentity";
import {NumberedPagination,SegmentedView} from "./MarketUI";
import {SignalBadge} from "./SignalControls";
import {usePersistedSignals} from "./data/usePersistedSignals";
import {historyTargetKey,useHistoryOnce} from "./data/usePriceHistoryBatch";
import {importDiff,readStoredImport,storeImport,type StoredCollectrImport} from "./state/collectr-import";
import {filterImportCards,importSetOptions,orderByValue,pageWindow,portfolioTotals,sortImportCards,type ImportLens,type ImportMarket,type ImportScope,type ImportSortCol,type SortDir} from "./state/collectr-view";
import {cardFavorite,sealedFavorite} from "./state/favorites";
import {useScalperMode} from "./state/scalper-mode";
import {useFavorites} from "./state/useFavorites";
import {parseStrictness,STRICTNESS_KEY,usePreference} from "./state/usePreference";
import {formatFullDate,formatPercent,formatUsd} from "../core/domain/formatters";
import type {CollectrImportCard,CollectrImportPayload} from "./api/collectr/route";
import type {MarketSignal,PriceHistory} from "../core/domain/types";

type Lens=ImportLens;
type ViewMode="medium"|"text";
type Scope=ImportScope;
type SortCol=ImportSortCol;

function SortHead({col,label,sortCol,sortDir,onSort}:{col:SortCol;label:string;sortCol:SortCol;sortDir:"asc"|"desc";onSort:(col:SortCol)=>void}){
 const active=sortCol===col;
 return <span role="columnheader" aria-sort={active?(sortDir==="asc"?"ascending":"descending"):"none"}><button type="button" onClick={()=>onSort(col)}>{label}<span className={`sort-mark ${active?"active":""}`} aria-hidden="true">{active?(sortDir==="asc"?"▲":"▼"):"◇"}</span></button></span>;
}
const MARKET_OPTIONS=[{key:"all",label:"All"},{key:"pokemon",label:"Pokémon"},{key:"riftbound",label:"Riftbound"}] as const;
const SCOPE_OPTIONS=[{key:"all",label:"All"},{key:"singles",label:"Singles"},{key:"sealed",label:"Sealed"}];
const LENS_OPTIONS=[{key:"all",label:"All cards"},{key:"hold",label:"Hold"},{key:"sell",label:"Hot Sells"}];
const VIEW_OPTIONS:[{key:ViewMode;label:string;icon:string},{key:ViewMode;label:string;icon:string}]=[{key:"medium",label:"Medium",icon:"▤"},{key:"text",label:"Text",icon:"☷"}];
const usd=(value:number|null|undefined)=>value==null?"—":formatUsd(value);

function favoriteEntryFor(card:CollectrImportCard){
 const match=card.matched!;
 return card.kind==="sealed"
  ? sealedFavorite({game:match.game,productId:card.productId,name:match.name,set:match.set,image:match.image,marketPrice:match.marketPrice})
  : cardFavorite({game:match.game,productId:card.productId,name:match.name,set:match.set,number:card.number,section:match.section,image:match.image,marketPrice:match.marketPrice});
}

type ImportRowProps={card:CollectrImportCard;signal:MarketSignal|null|undefined;history:PriceHistory|undefined};

// One table row. Matched rows link to the detail page and carry the hover history panel;
// unmatched rows render the same cells with Collectr's own price and no market data.
function ImportRow({card,signal,history}:ImportRowProps){
 const match=card.matched;
 const change7=match?history?.change7??null:null;
 const change30=match?history?.change30??null:null;
 const meta=card.kind==="sealed"?(match?.rarity||"Sealed"):`${card.number||"—"} · ${card.rarity||"—"}${card.printing?` · ${card.printing}`:""}`;
 const body=<>
  <span className="import-cond">{card.kind==="sealed"?`×${card.quantity}`:`${card.condition??"—"} · ×${card.quantity}`}</span>
  <ProductIdentity className="identity" image={match?.image??card.image} alt="" title={match?.name??card.name} meta={meta}/>
  <span className="import-signal">{signal?<SignalBadge signal={signal}/>:<span className="import-neutral">{match?"—":""}</span>}</span>
  <span className="set-name">{match?.set??card.set}</span>
  <span className="import-collectr">{usd(card.collectrPrice)}</span>
  <span className="market-price">{match?usd(match.marketPrice):<i className="import-untracked">Not tracked</i>}</span>
  <span className={`change change7 import-change${change7==null?" is-empty":change7<0?" down":" up"}`}>{match?(change7==null?"…":formatPercent(change7)):""}</span>
  <span className={`change change30 import-change${change30==null?" is-empty":change30<0?" down":" up"}`}>{match?(change30==null?"…":formatPercent(change30)):""}</span>
  <span className="row-star">{match?<FavoriteStar entry={favoriteEntryFor(card)}/>:null}</span>
 </>;
 if(!match)return <div className="leader-row import-row is-untracked">{body}</div>;
 return <a className="leader-row import-row" href={match.detailPath} aria-label={`View ${match.name} details`}>{body}
  {history&&<HistoryPopover className="hover-card" identityClassName="hover-card-art" image={match.image??""} alt={`${match.name} card`} label={`${match.name} price history`}><HistoryPanel title={card.kind==="sealed"?"Market Price History":"Near Mint Market History"} subtitle={card.kind==="sealed"?(match.rarity||"Sealed"):(card.printing??"Normal")} points={history.points??[]} metrics={standardHistoryMetrics(match.marketPrice,null,history)}/></HistoryPopover>}
 </a>;
}

export default function CollectrImportView(){
 const [strictness,setStrictness]=usePreference(STRICTNESS_KEY,parseStrictness,"balanced");
 const [stored,setStored]=useState<StoredCollectrImport|null>(null);
 const [input,setInput]=useState("");
 const [phase,setPhase]=useState<"idle"|"top"|"full"|"csv">("idle");
 const [error,setError]=useState<string|null>(null);
 const [market,setMarket]=useState<ImportMarket>("all");
 const [scope,setScope]=useState<Scope>("all");
 const [lens,setLens]=useState<Lens>("all");
 const [view,setView]=useState<ViewMode>("medium");
 const [query,setQuery]=useState("");
 const [setFilter,setSetFilter]=useState<string[]>([]);
 const [minPrice,setMinPrice]=useState("");
 const [maxPrice,setMaxPrice]=useState("");
 const [added,setAdded]=useState<string|null>(null);
 const [sortCol,setSortCol]=useState<SortCol>("market");
 const [sortDir,setSortDir]=useState<SortDir>("desc");
 const [page,setPage]=useState(1);
 const [perPage,setPerPage]=useState(30);
 const onSort=(col:SortCol)=>{if(col===sortCol)setSortDir(dir=>dir==="asc"?"desc":"asc");else{setSortCol(col);setSortDir("desc")}};
 const inputRef=useRef<HTMLInputElement>(null);
 const favorites=useFavorites();
 // "Import All" spins up a real browser session per import, so it's gated behind Scalper
 // mode (the power-user toggle) to keep casual traffic on the instant top-30 path.
 const scalperMode=useScalperMode();

 // Restore the last import on arrival; a ?profile= deep link pre-fills the form and
 // waits for one explicit click (no surprise external fetches).
 useEffect(()=>{
  const existing=readStoredImport();
  if(existing)setStored(existing);
  const requested=new URLSearchParams(location.search).get("profile");
  if(requested){setInput(requested);if(!existing||existing.payload.profile.handle!==requested.replace(/^@/,"").toLowerCase())inputRef.current?.focus()}
  else if(existing)setInput(`@${existing.payload.profile.handle}`);
 },[]);

 const loading=phase!=="idle";
 const acceptPayload=(body:CollectrImportPayload)=>{
  setStored(storeImport(body));
  setLens("all");setScope("all");setQuery("");setSetFilter([]);setMinPrice("");setMaxPrice("");
  window.history.replaceState(null,"",body.source==="csv"?"/import":`/import?profile=@${body.profile.handle}`);
 };
 const runImport=async(mode:"top"|"full")=>{
  if(loading)return;
  setPhase(mode);setError(null);setAdded(null);
  try{
   const response=await fetch(`/api/collectr?profile=${encodeURIComponent(input.trim())}${mode==="full"?"&mode=full":""}`);
   const body=await response.json() as CollectrImportPayload&{error?:string};
   if(!response.ok||body.error){setError(body.error??`Import failed (HTTP ${response.status})`);return}
   acceptPayload(body);
  }catch{setError("Import failed — check the link and try again.")}
  finally{setPhase("idle")}
 };
 const runCsv=async(file:File)=>{
  if(loading)return;
  setPhase("csv");setError(null);setAdded(null);
  try{
   const response=await fetch("/api/collectr",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({csv:await file.text(),filename:file.name})});
   const body=await response.json() as CollectrImportPayload&{error?:string};
   if(!response.ok||body.error){setError(body.error??`CSV import failed (HTTP ${response.status})`);return}
   acceptPayload(body);
  }catch{setError("CSV import failed — is that the collection export from Collectr?")}
  finally{setPhase("idle")}
 };

 const payload=stored?.payload??null;
 const cards=useMemo(()=>payload?orderByValue(payload.cards):[],[payload]);
 const buySignals=usePersistedSignals({kind:"single",market:"all",side:"buy",strictness});
 const sellSignals=usePersistedSignals({kind:"single",market:"all",side:"sell",strictness});
 const buySealed=usePersistedSignals({kind:"sealed",market:"all",side:"buy",strictness});
 const sellSealed=usePersistedSignals({kind:"sealed",market:"all",side:"sell",strictness});
 // Look up a card's signal in the right store: singles vs sealed have separate boards.
 const buyDerivedFor=(card:CollectrImportCard)=>(card.kind==="sealed"?buySealed:buySignals).derived[card.productId];
 const sellDerivedFor=(card:CollectrImportCard)=>(card.kind==="sealed"?sellSealed:sellSignals).derived[card.productId];
 const holdIds=useMemo(()=>new Set(cards.filter(card=>(card.kind==="sealed"?buySealed:buySignals).derived[card.productId]?.signal).map(card=>card.productId)),[cards,buySignals,buySealed]);
 const sellIds=useMemo(()=>new Set(cards.filter(card=>(card.kind==="sealed"?sellSealed:sellSignals).derived[card.productId]?.signal).map(card=>card.productId)),[cards,sellSignals,sellSealed]);
 const signalsReady=buySignals.ready&&sellSignals.ready&&buySealed.ready&&sellSealed.ready;

 const visible=useMemo(()=>filterImportCards(cards,{scope,market,lens,holdIds,sellIds,query,setFilter,minPrice,maxPrice}),[cards,scope,market,lens,holdIds,sellIds,query,setFilter,minPrice,maxPrice]);

 const {matched,unmatched,marketTotal,collectrTotal,sellValue}=useMemo(()=>portfolioTotals(cards,sellIds),[cards,sellIds]);
 const setOptions=useMemo(()=>importSetOptions(cards,market),[cards,market]);
 const diff=stored?importDiff(stored):null;

 const historyTargets=useMemo(()=>visible.filter(card=>card.matched).slice(0,120).map(card=>({productId:card.productId,printing:card.printing??"Normal",sealed:card.kind==="sealed"})),[visible]);
 const priceHistory=useHistoryOnce(historyTargets);

 const signalOf=(card:CollectrImportCard)=>lens==="sell"?sellDerivedFor(card)?.signal:buyDerivedFor(card)?.signal??sellDerivedFor(card)?.signal;
 const historyOf=(card:CollectrImportCard)=>card.matched?priceHistory[historyTargetKey({productId:card.productId,printing:card.printing??"Normal",sealed:card.kind==="sealed"})]:undefined;
 // Sort the filtered rows; nulls (unmatched / no data) always sink to the bottom.
 const sortedVisible=useMemo(()=>sortImportCards(visible,sortCol,sortDir,{signalScore:card=>signalOf(card)?.score,history:historyOf}),
 // eslint-disable-next-line react-hooks/exhaustive-deps -- signalOf/historyOf close over the deps listed
 [visible,sortCol,sortDir,lens,buySignals.derived,sellSignals.derived,buySealed.derived,sellSealed.derived,priceHistory]);
 const {pages,page:safePage,rows:pageRows}=useMemo(()=>pageWindow(sortedVisible,page,perPage),[sortedVisible,page,perPage]);
 // A changed filter, lens, market, sort, or page-size resets to the first page.
 useEffect(()=>{setPage(1)},[market,scope,lens,query,setFilter,minPrice,maxPrice,sortCol,sortDir,perPage]);

 const addAll=()=>{favorites.addMany(matched.map(favoriteEntryFor));setAdded(`Added ${matched.length} tracked items to favorites.`)};
 const addHold=()=>{const holds=matched.filter(card=>holdIds.has(card.productId));favorites.addMany(holds.map(favoriteEntryFor));setAdded(`Added ${holds.length} Hold items to favorites.`)};

 return <><main className="detail-page import-page"><TopBar active="import" strictness={strictness} onStrictness={setStrictness}/>
  <header className="masthead" id="top">
   <p className="kicker">Collectr portfolio import</p>
   <h1>Your collection, <span>signal-checked.</span></h1>
  </header>
  <article className="detail-content">
   <section className="detail-section import-form-section"><header><span>Import</span><h2>Collectr Profile</h2></header>
    <p className="detail-note">Paste a public Collectr showcase link or @handle. The import matches every card and sealed product against tracked market data, flags what the sell signals say to move and what the buy signals say to hold, and can star the lot into your Buy List. Import Top 30 grabs the showcase&apos;s most valuable items instantly{scalperMode==="scalper"?"; Import All walks the entire collection through a real browser session and takes longer":""}. {payload?"Importing again replaces this page with the new profile.":"Graded cards are skipped; sealed products are included."}<InfoHint label="How matching works">Collectr and Raw Signal both key products by TCGplayer product id, so matching is exact. Items outside the tracked catalog show with a “not tracked” badge and Collectr&apos;s own value; they stay out of the Hold/Sell lenses and favorites.</InfoHint></p>
    <div className="import-form">
     <label className="import-input"><span aria-hidden="true">⌕</span><input ref={inputRef} value={input} placeholder="https://app.getcollectr.com/showcase/profile/@yourhandle" onChange={event=>setInput(event.target.value)} onKeyDown={event=>{if(event.key==="Enter")runImport(scalperMode==="scalper"?"full":"top")}} aria-label="Collectr showcase link or handle"/></label>
     <button type="button" className="import-run import-run-secondary" onClick={()=>runImport("top")} disabled={loading}>{phase==="top"?"Importing…":"Import Top 30"}</button>
     {scalperMode==="scalper"&&<button type="button" className="import-run import-run-danger" onClick={()=>runImport("full")} disabled={loading}>{phase==="full"?"Importing…":"Import All"}</button>}
    </div>
    <p className="import-alt">or <label className="import-csv-link">import your Collectr Pro CSV export<input className="import-csv-input" type="file" accept=".csv,text/csv" disabled={loading} onChange={event=>{const file=event.target.files?.[0];event.target.value="";if(file)runCsv(file)}} aria-label="Import a Collectr Pro CSV export"/></label>{phase==="csv"&&" — importing…"}<InfoHint label="About CSV import">Collection CSV export needs a Collectr Pro subscription — in Collectr, open your collection and choose Export, then drop the file here. The file is parsed for matching only; nothing is stored server-side. No Pro? The showcase importers above work for any public profile.</InfoHint></p>
    {error&&<p className="import-error" role="alert">{error}</p>}
    {loading&&<div className="row-skeletons import-skeletons" aria-label="Importing collection"><span/><span/><span/><span/></div>}
    {phase==="full"&&<p className="detail-note">Walking the full collection through a real browser session — large collections can take up to a minute.</p>}
   </section>

   {payload&&!loading&&<>
   <section className="detail-section"><header>
    <div className="import-header-top">
     <span>{payload.source==="csv"?payload.profile.name:`${payload.profile.name} · @${payload.profile.handle}`}</span>
     <div className="import-portfolio-actions">
      <div className="import-actions">
       <button type="button" className="hot-add-button" onClick={addAll} disabled={!matched.length}>★ Add all tracked to favorites</button>
       <button type="button" className="hot-add-button" onClick={addHold} disabled={!signalsReady||!holdIds.size}>★ Add Hold cards only</button>
      </div>
      {added&&<span className="import-added" role="status">{added}</span>}
     </div>
    </div>
    <div className="import-header-title">
     <h2>Portfolio<InfoHint label="About these numbers">NM market sums our Near Mint market prices (× quantity) for matched cards only. The Collectr value is their condition-adjusted estimate for every imported card. Coverage counts cards matched to the tracked catalog.</InfoHint></h2>
     <span className="section-aside"><span>Imported {new Date(payload.importedAt).toLocaleString("en-US",{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"})}</span>{signalsReady&&buySignals.asOfDate&&<span>Signals as of {formatFullDate(buySignals.asOfDate)}</span>}</span>
    </div></header>
    <div className="detail-history-grid import-summary-tiles">
     <div className="detail-metric"><small>NM market</small><b>{usd(marketTotal)}</b><span>{matched.length} tracked cards</span></div>
     <div className="detail-metric"><small>Collectr value</small><b>{usd(payload.profile.collectrValue??collectrTotal)}</b><span>condition-adjusted</span></div>
     <div className={`detail-metric import-coverage${unmatched.length?" has-pop":""}`}><small>Coverage{unmatched.length>0&&<i className="import-info-dot" aria-hidden="true">i</i>}</small><b>{cards.length?Math.round(matched.length/cards.length*100):0}%</b><span>{matched.length} of {cards.length} matched</span>
      {unmatched.length>0&&<div className="import-coverage-pop" role="tooltip"><b>Not matched · {unmatched.length}</b><ul>{unmatched.slice(0,60).map((card,index)=><li key={index}>{card.name||"Unknown card"}{card.number?<span> · {card.number}</span>:null}</li>)}</ul>{unmatched.length>60&&<p>+{unmatched.length-60} more</p>}</div>}
     </div>
     <div className="detail-metric"><small>Hold</small><b className="up">{holdIds.size}</b><span>buy-signal backed</span></div>
     <div className="detail-metric"><small>Sell candidates</small><b className="down">{sellIds.size}</b><span>worth {usd(sellValue)} at market</span></div>
     <div className="detail-metric"><small>Skipped</small><b>{payload.skippedGraded+payload.skippedSealed}</b><span>{payload.skippedGraded} graded · {payload.skippedSealed} sealed</span></div>
    </div>
    {(diff||payload.partial||payload.fullError)&&<p className="detail-note">{diff&&<>Since last import: {diff.added} new · {diff.removed} removed. </>}{payload.fullError&&<>Full import fell back to the showcase page ({payload.fullError}). </>}{payload.partial&&(payload.source==="browser"?<>Partial import — the browser walk stopped early, so this shows {payload.cards.length} cards of {payload.profile.totalCards}.</>:<>Partial import — Collectr&apos;s API declined pagination, so this shows the {payload.cards.length} most valuable cards of {payload.profile.totalCards}.</>)}</p>}
   </section>

   <section className="detail-section">
    <header><span>Signal check</span><h2>{lens==="hold"?"Hold — Do Not Sell These":lens==="sell"?"Sell Candidates":"All Imported Cards"}<InfoHint label="About the lenses">Hold lists cards with a live buy signal at your strictness — the market says they sit near a floor, the opposite of a good time to sell. Hot Sells lists cards with a live sell signal — near a historical high with retrace risk. Everything else is neutral: no strong signal either way.</InfoHint></h2></header>
    <div className="signal-navigation import-nav">
     <SlidingTabs options={SCOPE_OPTIONS} selectedKey={scope} onSelect={key=>setScope(key as Scope)} label="Import scope"/>
     <MarketTabs className="import-market-tabs" options={MARKET_OPTIONS} value={market} onChange={next=>setMarket(next as ImportMarket)} label="Import market"/>
     <SlidingTabs options={LENS_OPTIONS} selectedKey={lens} onSelect={key=>setLens(key as Lens)} label="Signal lens" className={lens==="hold"?"tone-buy":lens==="sell"?"tone-sell":""}/>
    </div>
    {!signalsReady&&lens!=="all"&&<p className="detail-unavailable">{buySignals.resolved?"Persisted signals are refreshing (the nightly market walk is mid-run) — lenses return when today's snapshot publishes.":"Checking signals…"}</p>}
    <div className="import-filters">
     <label className="import-input import-search"><span aria-hidden="true">⌕</span><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search card, set, or number" aria-label="Search imported cards"/></label>
     <MultiSelectField className="toolbar-select" label="Sets" options={setOptions} selected={setFilter} onChange={setSetFilter} allLabel="All sets"/>
     <label className="import-input import-price"><span>Min $</span><input inputMode="decimal" value={minPrice} onChange={event=>setMinPrice(event.target.value)} aria-label="Minimum price"/></label>
     <label className="import-input import-price"><span>Max $</span><input inputMode="decimal" value={maxPrice} onChange={event=>setMaxPrice(event.target.value)} aria-label="Maximum price"/></label>
     <SegmentedView className="detail-table-views import-view-toggle" value={view} onChange={setView} options={VIEW_OPTIONS} label="Row view"/>
    </div>
    <div className={`import-table view-${view}`}>
     <div className="table-head import-head" role="row">
      <SortHead col="qty" label="QTY" sortCol={sortCol} sortDir={sortDir} onSort={onSort}/>
      <SortHead col="card" label="Card" sortCol={sortCol} sortDir={sortDir} onSort={onSort}/>
      <SortHead col="signal" label="Signal" sortCol={sortCol} sortDir={sortDir} onSort={onSort}/>
      <SortHead col="set" label="Set" sortCol={sortCol} sortDir={sortDir} onSort={onSort}/>
      <SortHead col="collectr" label="Collectr" sortCol={sortCol} sortDir={sortDir} onSort={onSort}/>
      <SortHead col="market" label="NM Market" sortCol={sortCol} sortDir={sortDir} onSort={onSort}/>
      <SortHead col="change7" label="7D" sortCol={sortCol} sortDir={sortDir} onSort={onSort}/>
      <SortHead col="change30" label="30D" sortCol={sortCol} sortDir={sortDir} onSort={onSort}/>
     </div>
     <div className="rows" role="rowgroup">
      {pageRows.map((card,rowIndex)=>{
       const rowKey=(safePage-1)*perPage+rowIndex;
       return <ImportRow key={`${card.productId}-${card.matched?"":"u-"}${rowKey}`} card={card} signal={signalsReady?signalOf(card):undefined} history={historyOf(card)}/>;
      })}
      {!sortedVisible.length&&<p className="empty">Nothing matches the current lens and filters.</p>}
     </div>
    </div>
    {sortedVisible.length>perPage&&<div className="pagination-row"><NumberedPagination page={safePage} pages={pages} onChange={setPage} label="Imported cards pages"/><PerPageSelect label="Cards per page" value={perPage} onChange={setPerPage}/></div>}
   </section>
   </>}
  </article></main><SiteFooter/></>;
}
