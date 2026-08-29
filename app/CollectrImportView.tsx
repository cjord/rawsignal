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
import HistoryPanel,{standardHistoryMetrics} from "./HistoryPanel";
import HistoryPopover from "./leaderboard/HistoryPopover";
import ProductIdentity from "./leaderboard/ProductIdentity";
import {NumberedPagination,SegmentedView} from "./MarketUI";
import {SignalBadge} from "./SignalControls";
import {usePersistedSignals} from "./data/usePersistedSignals";
import {historyTargetKey,useHistoryOnce} from "./data/usePriceHistoryBatch";
import {importDiff,readStoredImport,storeImport,type StoredCollectrImport} from "./state/collectr-import";
import {cardFavorite} from "./state/favorites";
import {useScalperMode} from "./state/scalper-mode";
import {useFavorites} from "./state/useFavorites";
import {parseStrictness,STRICTNESS_KEY,usePreference} from "./state/usePreference";
import {formatFullDate,formatPercent,formatUsd} from "../core/domain/formatters";
import type {CollectrImportCard,CollectrImportPayload} from "./api/collectr/route";

type Lens="all"|"hold"|"sell";
type ViewMode="medium"|"text";
type ImportMarket="all"|"pokemon"|"riftbound";
type SortCol="cond"|"card"|"signal"|"set"|"collectr"|"market"|"change7"|"change30";

function SortHead({col,label,sortCol,sortDir,onSort}:{col:SortCol;label:string;sortCol:SortCol;sortDir:"asc"|"desc";onSort:(col:SortCol)=>void}){
 const active=sortCol===col;
 return <span role="columnheader" aria-sort={active?(sortDir==="asc"?"ascending":"descending"):"none"}><button type="button" onClick={()=>onSort(col)}>{label}<span className={`sort-mark ${active?"active":""}`} aria-hidden="true">{active?(sortDir==="asc"?"▲":"▼"):"◇"}</span></button></span>;
}
const MARKET_OPTIONS=[{key:"all",label:"All"},{key:"pokemon",label:"Pokémon"},{key:"riftbound",label:"Riftbound"}] as const;
const LENS_OPTIONS=[{key:"all",label:"All cards"},{key:"hold",label:"Hold"},{key:"sell",label:"Hot Sells"}];
const VIEW_OPTIONS:[{key:ViewMode;label:string;icon:string},{key:ViewMode;label:string;icon:string}]=[{key:"medium",label:"Medium",icon:"▤"},{key:"text",label:"Text",icon:"☷"}];
const usd=(value:number|null|undefined)=>value==null?"—":formatUsd(value);

const effectivePrice=(card:CollectrImportCard)=>card.matched?.marketPrice??card.collectrPrice??0;
const cardGame=(card:CollectrImportCard):ImportMarket|null=>card.matched?(card.matched.game as ImportMarket):card.game;

function favoriteEntryFor(card:CollectrImportCard){
 const match=card.matched!;
 return cardFavorite({game:match.game,productId:card.productId,name:match.name,set:match.set,number:card.number,section:match.section,image:match.image,marketPrice:match.marketPrice});
}

export default function CollectrImportView(){
 const [strictness,setStrictness]=usePreference(STRICTNESS_KEY,parseStrictness,"balanced");
 const [stored,setStored]=useState<StoredCollectrImport|null>(null);
 const [input,setInput]=useState("");
 const [phase,setPhase]=useState<"idle"|"top"|"full"|"csv">("idle");
 const [error,setError]=useState<string|null>(null);
 const [market,setMarket]=useState<ImportMarket>("all");
 const [lens,setLens]=useState<Lens>("all");
 const [view,setView]=useState<ViewMode>("medium");
 const [query,setQuery]=useState("");
 const [setFilter,setSetFilter]=useState<string[]>([]);
 const [minPrice,setMinPrice]=useState("");
 const [maxPrice,setMaxPrice]=useState("");
 const [added,setAdded]=useState<string|null>(null);
 const [sortCol,setSortCol]=useState<SortCol>("market");
 const [sortDir,setSortDir]=useState<"asc"|"desc">("desc");
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
  setLens("all");setQuery("");setSetFilter([]);setMinPrice("");setMaxPrice("");
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
 const cards=useMemo(()=>payload?[...payload.cards].sort((a,b)=>effectivePrice(b)-effectivePrice(a)):[],[payload]);
 const buySignals=usePersistedSignals({kind:"single",market:"all",side:"buy",strictness});
 const sellSignals=usePersistedSignals({kind:"single",market:"all",side:"sell",strictness});
 const holdIds=useMemo(()=>new Set(cards.filter(card=>buySignals.derived[card.productId]?.signal).map(card=>card.productId)),[cards,buySignals.derived]);
 const sellIds=useMemo(()=>new Set(cards.filter(card=>sellSignals.derived[card.productId]?.signal).map(card=>card.productId)),[cards,sellSignals.derived]);
 const signalsReady=buySignals.ready&&sellSignals.ready;

 const min=minPrice.trim()===""?null:Number(minPrice),max=maxPrice.trim()===""?null:Number(maxPrice);
 const visible=useMemo(()=>cards.filter(card=>{
  if(market!=="all"&&cardGame(card)!==market)return false;
  if(lens==="hold"&&!holdIds.has(card.productId))return false;
  if(lens==="sell"&&!sellIds.has(card.productId))return false;
  const haystack=`${card.matched?.name??card.name} ${card.matched?.set??card.set} ${card.number}`.toLowerCase();
  if(query.trim()&&!haystack.includes(query.trim().toLowerCase()))return false;
  const setName=card.matched?.set??card.set;
  if(setFilter.length&&!setFilter.includes(setName))return false;
  const price=effectivePrice(card);
  if(min!=null&&Number.isFinite(min)&&price<min)return false;
  if(max!=null&&Number.isFinite(max)&&price>max)return false;
  return true;
 }),[cards,market,lens,holdIds,sellIds,query,setFilter,min,max]);

 const matched=cards.filter(card=>card.matched);
 const unmatched=useMemo(()=>cards.filter(card=>!card.matched),[cards]);
 const marketTotal=matched.reduce((sum,card)=>sum+(card.matched!.marketPrice*card.quantity),0);
 const collectrTotal=cards.reduce((sum,card)=>sum+((card.collectrPrice??0)*card.quantity),0);
 const sellValue=useMemo(()=>cards.filter(card=>sellIds.has(card.productId)).reduce((sum,card)=>sum+effectivePrice(card)*card.quantity,0),[cards,sellIds]);
 const setOptions=useMemo(()=>{
  const names=new Set<string>();
  for(const card of cards){if(market!=="all"&&cardGame(card)!==market)continue;names.add(card.matched?.set??card.set)}
  return [...names].sort().map(name=>({key:name,label:name}));
 },[cards,market]);
 const diff=stored?importDiff(stored):null;

 const historyTargets=useMemo(()=>visible.filter(card=>card.matched).slice(0,120).map(card=>({productId:card.productId,printing:card.printing??"Normal"})),[visible]);
 const priceHistory=useHistoryOnce(historyTargets);

 const signalOf=(card:CollectrImportCard)=>lens==="sell"?sellSignals.derived[card.productId]?.signal:buySignals.derived[card.productId]?.signal??sellSignals.derived[card.productId]?.signal;
 const historyOf=(card:CollectrImportCard)=>card.matched?priceHistory[historyTargetKey({productId:card.productId,printing:card.printing??"Normal"})]:undefined;
 const sortValue=(card:CollectrImportCard):number|string|null=>{
  switch(sortCol){
   case "cond":return card.condition?card.condition.toLowerCase():null;
   case "card":return (card.matched?.name??card.name).toLowerCase();
   case "set":return (card.matched?.set??card.set).toLowerCase();
   case "collectr":return card.collectrPrice;
   case "market":return card.matched?card.matched.marketPrice:null;
   case "signal":{const sig=signalOf(card);return sig?sig.score:null;}
   case "change7":return historyOf(card)?.change7??null;
   case "change30":return historyOf(card)?.change30??null;
  }
 };
 // Sort the filtered rows; nulls (unmatched / no data) always sink to the bottom.
 const sortedVisible=useMemo(()=>[...visible].sort((a,b)=>{
  const av=sortValue(a),bv=sortValue(b);
  if(av==null&&bv==null)return 0;if(av==null)return 1;if(bv==null)return -1;
  const order=typeof av==="string"?av.localeCompare(String(bv)):Number(av)-Number(bv);
  return sortDir==="asc"?order:-order;
 // eslint-disable-next-line react-hooks/exhaustive-deps -- sortValue/signalOf/historyOf close over the deps listed
 }),[visible,sortCol,sortDir,lens,buySignals.derived,sellSignals.derived,priceHistory]);
 const pages=Math.max(1,Math.ceil(sortedVisible.length/perPage));
 const safePage=Math.min(page,pages);
 const pageRows=useMemo(()=>sortedVisible.slice((safePage-1)*perPage,safePage*perPage),[sortedVisible,safePage,perPage]);
 // A changed filter, lens, market, sort, or page-size resets to the first page.
 useEffect(()=>{setPage(1)},[market,lens,query,setFilter,minPrice,maxPrice,sortCol,sortDir,perPage]);

 const addAll=()=>{favorites.addMany(matched.map(favoriteEntryFor));setAdded(`Added ${matched.length} tracked cards to favorites.`)};
 const addHold=()=>{const holds=matched.filter(card=>holdIds.has(card.productId));favorites.addMany(holds.map(favoriteEntryFor));setAdded(`Added ${holds.length} Hold cards to favorites.`)};

 return <main className="detail-page import-page"><TopBar active="import" strictness={strictness} onStrictness={setStrictness}/>
  <header className="masthead" id="top">
   <p className="kicker">Collectr portfolio import</p>
   <h1>Your collection, <span>signal-checked.</span></h1>
  </header>
  <article className="detail-content">
   <section className="detail-section import-form-section"><header><span>Import</span><h2>Collectr Profile</h2></header>
    <p className="detail-note">Paste a public Collectr showcase link or @handle. The import matches every raw single against tracked market data, flags what the sell signals say to move and what the buy signals say to hold, and can star the lot into your Buy List. Import Top 30 grabs the showcase&apos;s most valuable cards instantly{scalperMode==="scalper"?"; Import All walks the entire collection through a real browser session and takes longer":""}. {payload?"Importing again replaces this page with the new profile.":"Graded cards and sealed products are skipped."}<InfoHint label="How matching works">Collectr and Raw Signal both key cards by TCGplayer product id, so matching is exact. Cards outside the tracked rarity sections show with a “not tracked” badge and Collectr&apos;s own value; they stay out of the Hold/Sell lenses and favorites.</InfoHint></p>
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
     <MarketTabs className="import-market-tabs" options={MARKET_OPTIONS} value={market} onChange={next=>setMarket(next as ImportMarket)} label="Import market"/>
     <SlidingTabs options={LENS_OPTIONS} selectedKey={lens} onSelect={key=>setLens(key as Lens)} label="Signal lens" className={lens==="hold"?"tone-buy":lens==="sell"?"tone-sell":""}/>
     <SegmentedView className="detail-table-views" value={view} onChange={setView} options={VIEW_OPTIONS} label="Row view"/>
    </div>
    {!signalsReady&&lens!=="all"&&<p className="detail-unavailable">{buySignals.resolved?"Persisted signals are refreshing (the nightly market walk is mid-run) — lenses return when today's snapshot publishes.":"Checking signals…"}</p>}
    <div className="import-filters">
     <label className="import-input import-search"><span aria-hidden="true">⌕</span><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search card, set, or number" aria-label="Search imported cards"/></label>
     <MultiSelectField className="toolbar-select" label="Sets" options={setOptions} selected={setFilter} onChange={setSetFilter} allLabel="All sets"/>
     <label className="import-input import-price"><span>Min $</span><input inputMode="decimal" value={minPrice} onChange={event=>setMinPrice(event.target.value)} aria-label="Minimum price"/></label>
     <label className="import-input import-price"><span>Max $</span><input inputMode="decimal" value={maxPrice} onChange={event=>setMaxPrice(event.target.value)} aria-label="Maximum price"/></label>
    </div>
    <div className={`import-table view-${view}`}>
     <div className="table-head import-head" role="row">
      <SortHead col="cond" label="Cond" sortCol={sortCol} sortDir={sortDir} onSort={onSort}/>
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
       const match=card.matched;
       const signal=signalsReady?signalOf(card):undefined;
       const cardHistory=historyOf(card);
       const change7=match?cardHistory?.change7??null:null;
       const change30=match?cardHistory?.change30??null:null;
       const body=<>
        <span className="import-cond">{card.condition??"—"} · ×{card.quantity}</span>
        <ProductIdentity className="identity" image={match?.image??card.image} alt="" title={match?.name??card.name} meta={`${card.number||"—"} · ${card.rarity||"—"}${card.printing?` · ${card.printing}`:""}`}/>
        <span className="import-signal">{signal?<SignalBadge signal={signal}/>:<span className="import-neutral">{match?"—":""}</span>}</span>
        <span className="set-name">{match?.set??card.set}</span>
        <span className="import-collectr">{usd(card.collectrPrice)}</span>
        <span className="market-price">{match?usd(match.marketPrice):<i className="import-untracked">Not tracked</i>}</span>
        <span className={`change change7 import-change${change7==null?" is-empty":change7<0?" down":" up"}`}>{match?(change7==null?"…":formatPercent(change7)):""}</span>
        <span className={`change change30 import-change${change30==null?" is-empty":change30<0?" down":" up"}`}>{match?(change30==null?"…":formatPercent(change30)):""}</span>
        <span className="row-star">{match?<FavoriteStar entry={favoriteEntryFor(card)}/>:null}</span>
       </>;
       return match?<a key={`${card.productId}-${rowKey}`} className="leader-row import-row" href={match.detailPath} aria-label={`View ${match.name} details`}>{body}
        {cardHistory&&<HistoryPopover className="hover-card" identityClassName="hover-card-art" image={match.image??""} alt={`${match.name} card`} label={`${match.name} price history`}><HistoryPanel title="Near Mint market history" subtitle={card.printing??"Normal"} points={cardHistory.points??[]} metrics={standardHistoryMetrics(match.marketPrice,null,cardHistory)}/></HistoryPopover>}
       </a>:<div key={`${card.productId}-u-${rowKey}`} className="leader-row import-row is-untracked">{body}</div>;
      })}
      {!sortedVisible.length&&<p className="empty">Nothing matches the current lens and filters.</p>}
     </div>
    </div>
    {sortedVisible.length>perPage&&<div className="pagination-row"><NumberedPagination page={safePage} pages={pages} onChange={setPage} label="Imported cards pages"/><PerPageSelect label="Cards per page" value={perPage} onChange={setPerPage}/></div>}
   </section>
   </>}
  </article></main>;
}
