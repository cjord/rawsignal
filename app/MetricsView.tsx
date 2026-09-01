"use client";
import {useMemo,useState} from "react";
import InfoHint from "./InfoHint";
import MarketTabs from "./MarketTabs";
import {readStoredMarket,storeMarket} from "./state/market-memory";
import {METRICS_MARKETS,serializeMetricsScope,useMetricsScopeUrl,type MetricsMarket,type MetricsMode} from "./state/metrics-query";
import {parseStrictness,STRICTNESS_KEY,usePreference} from "./state/usePreference";
import PriceChart from "./PriceChart";
import TopBar from "./TopBar";
import SiteFooter from "./SiteFooter";
import HistoryPanel,{standardHistoryMetrics,type HistoryMetric} from "./HistoryPanel";
import {NumberedPagination,SegmentedView} from "./MarketUI";
import FavoriteStar from "./FavoriteStar";
import MarketRow from "./leaderboard/MarketRow";
import HistoryPopover from "./leaderboard/HistoryPopover";
import ProductIdentity from "./leaderboard/ProductIdentity";
import {favoriteKey,type FavoriteEntry} from "./state/favorites";
import {historyTargetKey,useHistoryOnce,type HistoryTarget} from "./data/usePriceHistoryBatch";
import {canonicalSealedType} from "../core/catalog-query";
import {deriveHistoryMetrics} from "../core/domain/history-metrics";
import {POKEMON_ERAS,eraLabel} from "../core/domain/eras";
import {formatGameName,formatPercent,formatUsd,setSlug} from "../core/domain/formatters";
import type {PriceHistory,PricePoint,SignalStrictness} from "../core/domain/types";
import type {MetricsCategoryRow,MetricsEraRow,MetricsMover,MetricsPayload,MetricsSetRow} from "../core/domain/metrics";

type Mode=MetricsMode;
type Market=MetricsMarket;
const MODE_VIEWS:[{key:Mode;label:string;icon:string},{key:Mode;label:string;icon:string}]=[{key:"singles",label:"Singles",icon:"◫"},{key:"sealed",label:"Sealed",icon:"▣"}];
const marketTabOptions=(mode:Mode)=>METRICS_MARKETS[mode].map(item=>({key:item,label:item==="all"?"All":formatGameName(item)}));

const pct=(value:number|null)=>value==null?"N/A":formatPercent(value);
const tone=(value:number|null)=>value==null||value===0?undefined:value<0?"down":"up";
const compactUsd=(value:number)=>value>=1_000_000?`$${(value/1_000_000).toFixed(2)}M`:value>=10_000?`$${Math.round(value/1000).toLocaleString()}k`:formatUsd(value);
const changesOf=(points:PricePoint[])=>{
 if(points.length<2)return {change7:null,change30:null,change90:null};
 const metrics=deriveHistoryMetrics(points);
 return {change7:metrics.change7,change30:metrics.change30,change90:metrics.change90};
};

// One naming scheme for every index card; combined keys map from the ALL scope.
const INDEX_META:Record<string,{title:string;note:string}>={
 "index:cards":{title:"RS-100 Cards",note:"Mean of the top 100 card prices each day, all games, rebalanced daily."},
 "index:sealed":{title:"RS-50 Sealed",note:"Mean of the top 50 sealed prices each day, all games; cases excluded."},
 "index:pokemon-cards":{title:"Pokémon-100",note:"Mean of the top 100 Pokémon card prices each day."},
 "index:riftbound-cards":{title:"Riftbound-50",note:"Mean of the top 50 Riftbound card prices each day."},
 "index:pokemon-sealed":{title:"Pokémon Sealed-50",note:"Mean of the top 50 Pokémon sealed prices each day; cases excluded."},
 "index:riftbound-sealed":{title:"Riftbound Sealed 66%",note:"Mean of the top 66% of Riftbound sealed prices each day — the baseline scales with this young catalog; cases excluded."},
 "index:onepiece-sealed":{title:"One Piece Sealed 66%",note:"Mean of the top 66% of One Piece sealed prices each day — the baseline scales with this young catalog."},
};
const indexKey=(mode:Mode,market:Market)=>market==="all"?(mode==="singles"?"index:cards":"index:sealed"):`index:${market}-${mode==="singles"?"cards":"sealed"}`;
const visibleIndexKeys=(mode:Mode,market:Market)=>market==="all"?[indexKey(mode,"all"),...METRICS_MARKETS[mode].filter(item=>item!=="all").map(item=>indexKey(mode,item))]:[indexKey(mode,market)];

function ChangeTiles({change7,change30,change90}:{change7:number|null;change30:number|null;change90:number|null}){
 return <div className="metrics-window-tiles">
  {([["7D",change7],["30D",change30],["90D",change90]] as const).map(([label,value])=><div className="detail-metric metrics-window-tile" key={label}><small>{label}</small><b className={tone(value)}>{pct(value)}</b></div>)}
 </div>;
}

// Per-game median series pair with their index (audit N3): the index tracks the top of
// the market, the median tracks the typical card — divergence between them is a signal.
const MEDIAN_FOR:Record<string,string>={"index:pokemon-cards":"median:pokemon-singles","index:riftbound-cards":"median:riftbound-singles"};
const BENCHMARK_KEY="benchmark:sp500";

const rebaseSeries=(points:PricePoint[],from:string):PricePoint[]=>{
 const start=points.find(point=>point.date>=from);
 if(!start||start.price<=0)return [];
 return points.filter(point=>point.date>=from).map(point=>({date:point.date,price:(point.price/start.price)*100}));
};
const indexPointsFormat=(value:number)=>value.toFixed(1);

// Cross-market comparison: every market's index for the mode plus the S&P benchmark,
// rebased to 100 at the first date ALL included series share, one line each. The line
// classes pair with legend and tooltip swatches (metrics.css / globals chart block).
const comparisonLineClass=(index:number,key:string)=>key===BENCHMARK_KEY?"chart-series-sp":index===1?"chart-series-2":"chart-series-3";
function ComparisonCard({mode,series}:{mode:Mode;series:Record<string,PricePoint[]|undefined>}){
 const marketKeys=METRICS_MARKETS[mode].filter(item=>item!=="all").map(item=>indexKey(mode,item));
 const lines=[
  ...marketKeys.filter(key=>(series[key]?.length??0)>1).map(key=>({key,label:INDEX_META[key].title,points:series[key] as PricePoint[]})),
  ...((series[BENCHMARK_KEY]?.length??0)>1?[{key:BENCHMARK_KEY,label:"S&P 500 (SPY)",points:series[BENCHMARK_KEY] as PricePoint[]}]:[]),
 ];
 const from=lines.length?lines.map(line=>line.points[0].date).sort().at(-1)!:"";
 const rebased=lines.map(line=>({...line,points:rebaseSeries(line.points,from)})).filter(line=>line.points.length>1);
 const title=mode==="singles"?"Singles markets vs S&P":"Sealed markets vs S&P";
 if(rebased.length<2)return <div className="metrics-index-card metrics-compare-card"><header><b>{title}</b></header><p className="detail-unavailable">The comparison needs overlapping rolled-up history across markets.</p></div>;
 const [main,...overlays]=rebased;
 return <div className="metrics-index-card metrics-compare-card"><header><b>{title}</b></header>
  <div className="metrics-legend">{rebased.map((line,index)=><span key={line.key} className={`legend-line ${index===0?"legend-main":comparisonLineClass(index,line.key)}`}>{line.label}</span>)}</div>
  <PriceChart points={main.points} overlays={overlays.map((line,index)=>({label:line.label,points:line.points,className:comparisonLineClass(index+1,line.key)}))} mainLabel={main.label} formatValue={indexPointsFormat} label={`${title} comparison`}/>
  <p className="detail-note">Each line rebased to 100 at the first date every series shares. Values are index points, not dollars; hover reads all lines at once.</p></div>;
}

function IndexCard({seriesKey,points,medianPoints,benchmark}:{seriesKey:string;points:PricePoint[];medianPoints?:PricePoint[];benchmark?:PricePoint[]}){
 const meta=INDEX_META[seriesKey];
 const [view,setView]=useState<"index"|"median"|"sp">("index");
 const hasMedian=Boolean(medianPoints&&medianPoints.length>1);
 const hasBenchmark=Boolean(benchmark&&benchmark.length>1&&points.length>1);
 const options=[["index","Index"] as const,...(hasMedian?[["median","Median"] as const]:[]),...(hasBenchmark?[["sp","vs S&P"] as const]:[])];
 const active=view==="median"&&!hasMedian?"index":view==="sp"&&!hasBenchmark?"index":view;
 const shown=active==="median"?medianPoints as PricePoint[]:points;
 const latest=shown.at(-1),deltas=changesOf(shown);
 const accumulating=points.length<=1;
 const from=active==="sp"?[points[0]?.date??"",(benchmark as PricePoint[])[0]?.date??""].sort().at(-1)??"":"";
 const spBase=active==="sp"?rebaseSeries(points,from):[];
 const spOverlay=active==="sp"?rebaseSeries(benchmark as PricePoint[],from):[];
 return <div className={`metrics-index-card ${accumulating?"is-accumulating":""}`}><header><b>{meta.title}</b>
  {options.length>1&&!accumulating&&<div className="metrics-seg metrics-seg-small" role="tablist" aria-label={`${meta.title} series`}>{options.map(([key,label])=><button key={key} type="button" role="tab" aria-selected={active===key} className={active===key?"active":""} onClick={()=>setView(key)}>{label}</button>)}</div>}
  {latest&&active!=="sp"&&<span className="metrics-index-value">{formatUsd(latest.price)}</span>}</header>
  {active==="sp"?(spBase.length>1&&spOverlay.length>1?<><div className="metrics-legend"><span className="legend-line legend-main">{meta.title}</span><span className="legend-line chart-series-sp">S&amp;P 500 (SPY)</span></div><PriceChart points={spBase} overlays={[{label:"S&P 500 (SPY)",points:spOverlay,className:"chart-series-sp"}]} mainLabel={meta.title} formatValue={indexPointsFormat} label={`${meta.title} vs S&P`}/></>:<p className="detail-unavailable">The comparison needs overlapping history for both series.</p>)
  :shown.length>1?<><PriceChart points={shown} label={`${meta.title} ${active}`}/><ChangeTiles {...deltas}/></>:<p className="detail-unavailable">History accumulating — one rolled-up day so far; the line grows daily.</p>}
  <p className="detail-note">{active==="sp"?"Both series rebased to 100 at the first shared date. S&P 500 via the SPY ETF (Alpha Vantage) — index points, not dollars.":active==="median"&&hasMedian?"Median tracked card price each day — the typical card, where the index tracks the top of the market.":meta.note}</p></div>;
}

function EraTable({eras}:{eras:MetricsEraRow[]}){
 const order=new Map(POKEMON_ERAS.map((era,index)=>[era.key,index]));
 const rows=[...eras].sort((a,b)=>(order.get(a.era)??99)-(order.get(b.era)??99));
 return <div className="detail-table-scroll"><table className="detail-variants-table metrics-table"><thead><tr>
  <th scope="col">Era</th><th scope="col">Tracked value</th><th scope="col">Cards</th><th scope="col">Sets</th><th scope="col">30D momentum</th>
 </tr></thead><tbody>
  {rows.map(row=><tr key={row.era}><th scope="row">{eraLabel(row.era)}</th><td>{compactUsd(row.trackedValue)}</td><td>{row.cards.toLocaleString()}</td><td>{row.sets}</td><td><span className={`metrics-chip ${tone(row.change30)??""}`}>{pct(row.change30)}</span></td></tr>)}
 </tbody></table></div>;
}

function SortTh<T extends string>({label,column,sort,direction,onSort}:{label:string;column:T;sort:T;direction:"asc"|"desc";onSort:(column:T)=>void}){
 const active=sort===column;
 return <th scope="col" aria-sort={active?(direction==="asc"?"ascending":"descending"):"none"}><button type="button" onClick={()=>onSort(column)}>{label}<span className={`sort-mark ${active?"active":""}`} aria-hidden="true">{active?(direction==="asc"?"▲":"▼"):"◇"}</span></button></th>;
}

function useSort<T extends string>(initial:T){
 const [sort,setSort]=useState<T>(initial),[direction,setDirection]=useState<"asc"|"desc">("desc");
 const onSort=(column:T)=>{if(column===sort)setDirection(value=>value==="asc"?"desc":"asc");else{setSort(column);setDirection("desc")}};
 return {sort,direction,onSort};
}
const compare=(a:number|string|null,b:number|string|null,direction:"asc"|"desc")=>{
 if(a==null&&b==null)return 0;
 if(a==null)return 1;
 if(b==null)return -1;
 const order=typeof a==="string"?String(a).localeCompare(String(b)):Number(a)-Number(b);
 return direction==="asc"?order:-order;
};

type SetColumn="set"|"trackedValue"|"medianPrice"|"cards"|"change30"|"sealedChange30"|"evRatio";
function SetTable({sets}:{sets:MetricsSetRow[]}){
 const {sort,direction,onSort}=useSort<SetColumn>("trackedValue");
 const [page,setPage]=useState(1);
 const rows=useMemo(()=>[...sets].sort((a,b)=>compare(a[sort],b[sort],direction)),[sets,sort,direction]);
 const pages=Math.max(1,Math.ceil(rows.length/10)),current=Math.min(page,pages),visible=rows.slice((current-1)*10,current*10);
 const sortAnd=(column:SetColumn)=>{setPage(1);onSort(column)};
 return <><div className="detail-table-scroll"><table className="detail-variants-table metrics-table"><thead><tr>
  <SortTh label="Set" column="set" sort={sort} direction={direction} onSort={sortAnd}/>
  <th scope="col">Game</th>
  <SortTh label="Tracked value" column="trackedValue" sort={sort} direction={direction} onSort={sortAnd}/>
  <SortTh label="Median card" column="medianPrice" sort={sort} direction={direction} onSort={sortAnd}/>
  <SortTh label="Cards" column="cards" sort={sort} direction={direction} onSort={sortAnd}/>
  <SortTh label="30D momentum" column="change30" sort={sort} direction={direction} onSort={sortAnd}/>
  <SortTh label="Sealed 30D" column="sealedChange30" sort={sort} direction={direction} onSort={sortAnd}/>
  <SortTh label="Pack EV" column="evRatio" sort={sort} direction={direction} onSort={sortAnd}/>
 </tr></thead><tbody>
  {visible.map(row=><tr key={`${row.game}:${row.set}`} className="is-clickable" onClick={()=>{location.assign(`/sets/${row.game}/${setSlug(row.set)}`)}}><th scope="row"><a href={`/sets/${row.game}/${setSlug(row.set)}`} onClick={event=>event.stopPropagation()}>{row.set}</a></th><td>{formatGameName(row.game)}</td><td>{compactUsd(row.trackedValue)}</td><td>{formatUsd(row.medianPrice)}</td><td>{row.cards.toLocaleString()}</td><td><span className={`metrics-chip ${tone(row.change30)??""}`}>{pct(row.change30)}</span></td><td><span className={`metrics-chip ${tone(row.sealedChange30)??""}`}>{pct(row.sealedChange30)}</span></td><td>{row.packEv!=null?<span className="metrics-ev">{formatUsd(row.packEv)}{row.evRatio!=null&&<em className={`metrics-chip ${row.evRatio>=1?"up":"down"}`}>{row.evRatio.toFixed(2)}×</em>}</span>:"N/A"}</td></tr>)}
 </tbody></table></div>
 {pages>1&&<NumberedPagination page={current} pages={pages} onChange={setPage} label="Set leaderboard pages"/>}</>;
}

type CategoryColumn="category"|"trackedValue"|"medianPrice"|"products"|"change7"|"change30"|"change90";
function CategoryTable({categories}:{categories:MetricsCategoryRow[]}){
 const {sort,direction,onSort}=useSort<CategoryColumn>("trackedValue");
 const [page,setPage]=useState(1);
 const rows=useMemo(()=>[...categories].sort((a,b)=>compare(a[sort],b[sort],direction)),[categories,sort,direction]);
 const pages=Math.max(1,Math.ceil(rows.length/10)),current=Math.min(page,pages),visible=rows.slice((current-1)*10,current*10);
 const sortAnd=(column:CategoryColumn)=>{setPage(1);onSort(column)};
 return <><div className="detail-table-scroll"><table className="detail-variants-table metrics-table"><thead><tr>
  <SortTh label="Category" column="category" sort={sort} direction={direction} onSort={sortAnd}/>
  <th scope="col">Game</th>
  <SortTh label="Tracked value" column="trackedValue" sort={sort} direction={direction} onSort={sortAnd}/>
  <SortTh label="Median product" column="medianPrice" sort={sort} direction={direction} onSort={sortAnd}/>
  <SortTh label="Products" column="products" sort={sort} direction={direction} onSort={sortAnd}/>
  <SortTh label="7D momentum" column="change7" sort={sort} direction={direction} onSort={sortAnd}/>
  <SortTh label="30D momentum" column="change30" sort={sort} direction={direction} onSort={sortAnd}/>
  <SortTh label="90D momentum" column="change90" sort={sort} direction={direction} onSort={sortAnd}/>
 </tr></thead><tbody>
  {visible.map(row=>{
   // The leaderboard filters on normalized product types: resolve this category through
   // the same normalizer so the deep link lands on matching rows, not an empty list.
   const href=`/?mode=sealed&market=${row.game}&type=${encodeURIComponent(canonicalSealedType(row.category))}`;
   return <tr key={`${row.game}:${row.category}`} className="is-clickable" onClick={()=>{location.assign(href)}}>
    <th scope="row"><a href={href} onClick={event=>event.stopPropagation()}>{row.category}</a></th>
    <td>{formatGameName(row.game)}</td><td>{compactUsd(row.trackedValue)}</td><td>{formatUsd(row.medianPrice)}</td><td>{row.products.toLocaleString()}</td>
    <td><span className={`metrics-chip ${tone(row.change7)??""}`}>{pct(row.change7)}</span></td>
    <td><span className={`metrics-chip ${tone(row.change30)??""}`}>{pct(row.change30)}</span></td>
    <td><span className={`metrics-chip ${tone(row.change90)??""}`}>{pct(row.change90)}</span></td>
   </tr>;
  })}
 </tbody></table></div>
 {pages>1&&<NumberedPagination page={current} pages={pages} onChange={setPage} label="Category leaderboard pages"/>}</>;
}

const moverTarget=(mover:MetricsMover):HistoryTarget=>mover.kind==="single"?{productId:mover.productId,printing:mover.printing}:{productId:mover.productId,printing:"Sealed",sealed:true};
const moverFavorite=(mover:MetricsMover):FavoriteEntry=>({key:favoriteKey(mover.kind,mover.productId),kind:mover.kind,game:mover.game,productId:mover.productId,name:mover.name,set:mover.set,number:null,section:null,image:mover.image||null,price:mover.price,addedAt:""});
const moverMetrics=(mover:MetricsMover,history?:PriceHistory):HistoryMetric[]=>standardHistoryMetrics(mover.price,mover.mid,history,"N/A");

function MoverTable({title,movers,history,empty}:{title:string;movers:MetricsMover[];history:Record<string,PriceHistory>;empty:string}){
 return <div className="metrics-mover-list"><h3>{title}</h3>
  {movers.length?<>
   <div className="metrics-mover-head" aria-hidden="true"><span/><span>Name</span><span>Market Price</span><span>% Change</span></div>
   <div className="metrics-mover-rows">{movers.map(mover=>{
    const h=history[historyTargetKey(moverTarget(mover))];
    return <MarketRow className="metrics-mover-row" key={`${mover.window}:${mover.kind}:${mover.productId}`} href={mover.kind==="single"?`/cards/${mover.productId}`:`/sealed/${mover.productId}`} label={`View ${mover.name} details`}
     popover={<HistoryPopover className="hover-card" identityClassName="hover-card-art" image={mover.image} alt={`${mover.name} ${mover.kind==="single"?"card":"product"}`} label={`${mover.name} price history`}>
      <HistoryPanel title={mover.kind==="single"?"Near Mint market history":"Sealed market history"} subtitle={mover.kind==="single"?mover.printing:"Unopened"} points={h?.points??[]} metrics={moverMetrics(mover,h)}/>
     </HistoryPopover>}>
     <span className="mover-star"><FavoriteStar entry={moverFavorite(mover)}/></span>
     <ProductIdentity className="identity mover-identity" image={mover.image} alt="" title={mover.name} meta={`${mover.set} · ${formatGameName(mover.game)}`}/>
     <span className="metrics-mover-price">{formatUsd(mover.price)}</span>
     <span className={`metrics-chip ${tone(mover.change)??""}`}>{pct(mover.change)}</span>
    </MarketRow>;
   })}</div>
  </>:<p className="detail-unavailable">{empty}</p>}
 </div>;
}

function RatioBar({label,advancers,decliners}:{label:string;advancers:number;decliners:number}){
 const total=advancers+decliners;
 const share=total?Math.round(advancers/total*100):null;
 const net=advancers-decliners;
 return <div className="metrics-ratio">
  <div className="metrics-ratio-head">
   <span className="metrics-ratio-label">{label}</span>
   {share!=null&&<b className={`metrics-ratio-share ${share>=50?"up":"down"}`}>{share}% advancing</b>}
   <span className="metrics-ratio-counts">
    <em className="up">▲ {advancers.toLocaleString()}</em>
    <em className="down">▼ {decliners.toLocaleString()}</em>
    <em className={`metrics-ratio-net ${net>=0?"up":"down"}`}>{net>=0?"+":""}{net.toLocaleString()} net</em>
   </span>
  </div>
  <div className="metrics-ratio-bar" role="img" aria-label={`${label}: ${advancers.toLocaleString()} advancers, ${decliners.toLocaleString()} decliners${share!=null?` — ${share}% advancing`:""}`}>
   <span style={{width:`${share??50}%`}}/><i aria-hidden="true"/>
  </div>
 </div>;
}

export default function MetricsView({payload}:{payload:MetricsPayload|null}){
 const [strictness,changeStrictness]=usePreference<SignalStrictness>(STRICTNESS_KEY,parseStrictness,"balanced");
 const [mode,setMode]=useState<Mode>("singles");
 const [market,setMarket]=useState<Market>("all");
 const [moversWindow,setMoversWindow]=useState<"7d"|"30d"|"90d">("7d");
 // Scope rides the URL through the shared push/popstate discipline (decision D14):
 // the URL wins; otherwise the market remembered from the other pages; else Pokémon.
 const writeScope=useMetricsScopeUrl(({mode:nextMode,requestedMarket})=>{
  const requested=(requestedMarket??readStoredMarket())as Market|null;
  const resolved=requested&&METRICS_MARKETS[nextMode].includes(requested)?requested:"pokemon";
  setMode(nextMode);
  setMarket(resolved);
  storeMarket(resolved);
  // Stamp the resolved scope into the current entry (replace, not push) so the landing
  // entry is itself back-navigable after later scope pushes.
  history.replaceState(null,"",`/metrics?${serializeMetricsScope(nextMode,resolved)}`);
 });
 const setScope=(nextMode:Mode,nextMarket:Market)=>{
  const resolved=METRICS_MARKETS[nextMode].includes(nextMarket)?nextMarket:"pokemon";
  // Re-clicking the active tab must not push a duplicate history entry.
  if(nextMode===mode&&resolved===market)return;
  setMode(nextMode);setMarket(resolved);
  storeMarket(resolved);
  writeScope(nextMode,resolved);
 };

 const kind=mode==="singles"?"single":"sealed";
 const series=useMemo(()=>payload?.series??{},[payload]);
 const scoped=useMemo(()=>{
  if(!payload)return null;
  const overview=payload.overview.filter(row=>row.kind===kind&&(market==="all"||row.game===market));
  const combined=market==="all"?{trackedValue:overview.reduce((sum,row)=>sum+row.trackedValue,0),products:overview.reduce((sum,row)=>sum+row.products,0),...changesOf(series[indexKey(mode,"all")]??[])}:null;
  const momentumRows=payload.momentum.filter(row=>row.kind===kind&&(market==="all"||row.game===market));
  const momentum=momentumRows.reduce((sum,row)=>({tracked:sum.tracked+row.tracked,advancers7:sum.advancers7+row.advancers7,decliners7:sum.decliners7+row.decliners7,advancers30:sum.advancers30+row.advancers30,decliners30:sum.decliners30+row.decliners30,atHistoricHigh:sum.atHistoricHigh+row.atHistoricHigh,atHistoricLow:sum.atHistoricLow+row.atHistoricLow}),{tracked:0,advancers7:0,decliners7:0,advancers30:0,decliners30:0,atHistoricHigh:0,atHistoricLow:0});
  const scopedMovers=payload.movers.filter(mover=>mover.kind===kind&&mover.window===moversWindow&&(market==="all"||mover.game===market));
  const gainers=scopedMovers.filter(mover=>mover.direction==="up").sort((a,b)=>b.change-a.change).slice(0,8);
  const decliners=scopedMovers.filter(mover=>mover.direction==="down").sort((a,b)=>a.change-b.change).slice(0,8);
  const sets=mode==="singles"?(market==="all"?[...payload.sets].sort((a,b)=>b.trackedValue-a.trackedValue).slice(0,50):payload.sets.filter(row=>row.game===market)):[];
  const categories=mode==="sealed"?payload.sealedCategories.filter(row=>market==="all"||row.game===market):[];
  return {overview,combined,momentum,gainers,decliners,sets,categories};
 },[payload,series,kind,mode,market,moversWindow]);
 const moverTargets=useMemo(()=>scoped?[...scoped.gainers,...scoped.decliners].map(moverTarget):[],[scoped]);
 const moverHistory=useHistoryOnce(moverTargets);

 return <><main className="detail-page metrics-page"><TopBar active="metrics" strictness={strictness} onStrictness={changeStrictness}/>
  <header className="masthead" id="top">
   <p className="kicker">Daily TCG market intelligence</p>
   <h1>The card market, <span>without the noise.</span></h1>
  </header>
  {payload&&<>
   <div className="product-navigation"><SegmentedView value={mode} options={MODE_VIEWS} label="Product type" className="product-toggle" onChange={(next:Mode)=>setScope(next,market)}/></div>
   <div className="signal-navigation metrics-market-nav"><MarketTabs className="metrics-market-tabs" options={marketTabOptions(mode)} value={market} onChange={next=>setScope(mode,next as Market)}/></div>
  </>}
  <article className="detail-content">
   {!payload?<section className="detail-section"><header><span>Unavailable</span><h2>Metrics need the database</h2></header><p className="detail-unavailable">This page reads the daily market rollups in the database-backed deployment. The local development server and feed-only deployments have no rollup data, so nothing is estimated here — visit the published site instead.</p></section>:<>
   <p className="detail-note metrics-rollup-note">Rolled up {payload.rolledUpAt.slice(0,10)} from daily TCGCSV market data · equal-weighted indexes, rebalanced daily · informational, not financial advice.</p>
   <section className="detail-section"><header><span>Tracked market</span><h2>Overview<InfoHint label="About tracked value">Tracked value sums current market prices across every tracked product — coverage, not capitalization. Movement follows each scope&apos;s equal-weighted index series.</InfoHint></h2></header>
    <div className="metrics-market-grid">
     {scoped&&scoped.combined&&<div className="metrics-market-card metrics-market-all"><header><b>{mode==="singles"?"All singles":"All sealed"}</b></header><div className="metrics-market-value">{compactUsd(scoped.combined.trackedValue)}</div><span className="metrics-market-sub">{scoped.combined.products.toLocaleString()} products</span><ChangeTiles change7={scoped.combined.change7} change30={scoped.combined.change30} change90={scoped.combined.change90}/>{(()=>{const sp=(series[BENCHMARK_KEY]?.length??0)>1?changesOf(series[BENCHMARK_KEY]):null;return sp?<span className="metrics-sp-line">vs S&amp;P 500 (SPY): market <em className={tone(scoped.combined.change90)??""}>{pct(scoped.combined.change90)}</em> · S&amp;P <em className={tone(sp.change90)??""}>{pct(sp.change90)}</em> over 90D</span>:null})()}</div>}
     {scoped?.overview.map(row=><div className="metrics-market-card" key={row.key}><header><b>{row.label}</b></header><div className="metrics-market-value">{compactUsd(row.trackedValue)}</div><span className="metrics-market-sub">{row.products.toLocaleString()} products</span><ChangeTiles change7={row.change7} change30={row.change30} change90={row.change90}/></div>)}
    </div></section>
   <section className="detail-section"><header><span>Movers</span><h2>Top Movers<InfoHint label="About movers">Largest price changes over the selected window among products worth at least $10 (singles) or $20 (sealed) before and after the move. Extreme swings that typically reflect listing turnover rather than market movement are excluded. Rows open the product&apos;s detail page; hover for its price history.</InfoHint></h2>
    <div className="metrics-seg metrics-seg-small" role="tablist" aria-label="Movers window">{(["7d","30d","90d"] as const).map(item=><button key={item} type="button" role="tab" aria-selected={moversWindow===item} className={moversWindow===item?"active":""} onClick={()=>setMoversWindow(item)}>{item.toUpperCase()}</button>)}</div></header>
    <div className="metrics-movers">
     <MoverTable title="Gainers" movers={scoped?.gainers??[]} history={moverHistory} empty="No qualifying gainers in this window."/>
     <MoverTable title="Decliners" movers={scoped?.decliners??[]} history={moverHistory} empty="No qualifying decliners in this window."/>
    </div></section>
   <section className="detail-section"><header><span>Breadth</span><h2>Momentum<InfoHint label="About breadth">Advancers and decliners count tracked products whose price moved over each window. Broad moves are sturdier than narrow ones; all-time marks compare today&apos;s price against each product&apos;s stored history.</InfoHint></h2></header>
    {scoped&&<><div className="metrics-ratio-stack">
     <RatioBar label="7 days" advancers={scoped.momentum.advancers7} decliners={scoped.momentum.decliners7}/>
     <RatioBar label="30 days" advancers={scoped.momentum.advancers30} decliners={scoped.momentum.decliners30}/>
    </div>
    <div className="detail-history-grid metrics-breadth-tiles">
     <div className="detail-metric"><small>At all-time high</small><b className={scoped.momentum.atHistoricHigh>0?"up":undefined}>{scoped.momentum.atHistoricHigh.toLocaleString()}</b>{scoped.momentum.tracked>0&&<span>{Math.round(scoped.momentum.atHistoricHigh/scoped.momentum.tracked*100)}% of tracked</span>}</div>
     <div className="detail-metric"><small>At all-time low</small><b className={scoped.momentum.atHistoricLow>0?"down":undefined}>{scoped.momentum.atHistoricLow.toLocaleString()}</b>{scoped.momentum.tracked>0&&<span>{Math.round(scoped.momentum.atHistoricLow/scoped.momentum.tracked*100)}% of tracked</span>}</div>
     <div className="detail-metric"><small>Tracked products</small><b>{scoped.momentum.tracked.toLocaleString()}</b><span>{mode==="singles"?"Singles":"Sealed"} with current prices and stored metrics</span></div>
    </div></>}</section>
   <section className="detail-section"><header><span>Equal-weighted indexes</span><h2>Indexes<InfoHint label="About the indexes">Each index is the mean of that day&apos;s top prices in its scope, rebalanced daily. Days observing too little of the market are excluded, which is why some series start later than others.</InfoHint></h2></header>
    <div className="metrics-index-grid">{visibleIndexKeys(mode,market).map(key=><IndexCard key={key} seriesKey={key} points={series[key]??[]} medianPoints={MEDIAN_FOR[key]?series[MEDIAN_FOR[key]]:undefined} benchmark={series[BENCHMARK_KEY]}/>)}</div></section>
   <section className="detail-section"><header><span>Cross-market</span><h2>Cross-Market vs S&amp;P<InfoHint label="About the comparison">Every market&apos;s equal-weighted index for the scope, with the S&amp;P 500 (via the SPY ETF) alongside, all rebased to 100 at the first date every line shares. Hover reads every line at the cursor date.</InfoHint></h2></header>
    <div className="metrics-index-grid metrics-compare-grid">
     <ComparisonCard mode={mode} series={series}/>
     {market==="all"&&<ComparisonCard mode={mode==="singles"?"sealed":"singles"} series={series}/>}
    </div></section>
   {mode==="singles"&&market==="pokemon"&&(payload.eras?.length??0)>0&&<section className="detail-section"><header><span>Pokémon by era</span><h2>Era performance<InfoHint label="About eras">Every tracked Pokémon set folded into its collector era (prefix first, release year otherwise). 30D momentum is the tracked-value-weighted mean of member sets&apos; median card changes — big sets move the era, minor sets don&apos;t swamp it.</InfoHint></h2></header><EraTable eras={payload.eras??[]}/></section>}
   {mode==="singles"?<section className="detail-section"><header><span>By set</span><h2>Set Leaderboard<InfoHint label="About the leaderboard">Top sets by tracked singles value. 30D momentum is the median of member cards&apos; 30-day changes; Sealed 30D is the same for the set&apos;s sealed products — a gap between them flags rotation between the two markets. Pack EV is the expected chase-card value of one booster from community pull-rate estimates times current singles prices (bulk excluded); the multiple compares it against the cheapest live pack price — above 1× means ripping beats buying the singles at these prices. Rows open the set&apos;s dedicated page.</InfoHint></h2></header><SetTable sets={scoped?.sets??[]}/></section>
   :<section className="detail-section"><header><span>By category</span><h2>Category Leaderboard<InfoHint label="About the leaderboard">Sealed products grouped by category. The median is the middle product price in the category; each momentum column is the median of member products&apos; changes over that window. Rows open the sealed leaderboard filtered to the category.</InfoHint></h2></header><CategoryTable categories={scoped?.categories??[]}/></section>}
   </>}
  </article></main><SiteFooter/></>;
}
