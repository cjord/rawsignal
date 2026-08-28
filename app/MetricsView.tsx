"use client";
/* eslint-disable react-hooks/set-state-in-effect -- scope and the strictness preference hydrate from the URL and storage after mount */
import {useEffect,useMemo,useState} from "react";
import InfoHint from "./InfoHint";
import PriceChart from "./PriceChart";
import TopBar from "./TopBar";
import {deriveHistoryMetrics} from "./domain/history-metrics";
import {formatGameName,formatPercent,formatUsd} from "./domain/formatters";
import type {PricePoint,SignalStrictness} from "./domain/types";
import type {MetricsCategoryRow,MetricsMover,MetricsPayload,MetricsSetRow} from "./data/metrics-service";

type Mode="singles"|"sealed";
type Market="all"|"pokemon"|"riftbound"|"onepiece";
const MODE_MARKETS:Record<Mode,Market[]>={singles:["all","pokemon","riftbound"],sealed:["all","pokemon","riftbound","onepiece"]};

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
const visibleIndexKeys=(mode:Mode,market:Market)=>market==="all"?[indexKey(mode,"all"),...MODE_MARKETS[mode].filter(item=>item!=="all").map(item=>indexKey(mode,item))]:[indexKey(mode,market)];

function ChangeTiles({change7,change30,change90}:{change7:number|null;change30:number|null;change90:number|null}){
 return <div className="metrics-window-tiles">
  {([["7D",change7],["30D",change30],["90D",change90]] as const).map(([label,value])=><div className="detail-metric metrics-window-tile" key={label}><small>{label}</small><b className={tone(value)}>{pct(value)}</b></div>)}
 </div>;
}

function IndexCard({seriesKey,points}:{seriesKey:string;points:PricePoint[]}){
 const meta=INDEX_META[seriesKey],latest=points.at(-1),deltas=changesOf(points);
 return <div className="metrics-index-card"><header><b>{meta.title}</b>{latest&&<span className="metrics-index-value">{formatUsd(latest.price)}</span>}</header>
  {points.length>1?<><PriceChart points={points} label={meta.title}/><ChangeTiles {...deltas}/></>:<p className="detail-unavailable">History accumulating — this index needs more rolled-up days before it can draw a line.</p>}
  <p className="detail-note">{meta.note}</p></div>;
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

type SetColumn="set"|"trackedValue"|"medianPrice"|"cards"|"change30";
function SetTable({sets}:{sets:MetricsSetRow[]}){
 const {sort,direction,onSort}=useSort<SetColumn>("trackedValue");
 const rows=useMemo(()=>[...sets].sort((a,b)=>compare(a[sort],b[sort],direction)),[sets,sort,direction]);
 return <div className="detail-table-scroll"><table className="detail-variants-table metrics-table"><thead><tr>
  <SortTh label="Set" column="set" sort={sort} direction={direction} onSort={onSort}/>
  <th scope="col">Game</th>
  <SortTh label="Tracked value" column="trackedValue" sort={sort} direction={direction} onSort={onSort}/>
  <SortTh label="Median card" column="medianPrice" sort={sort} direction={direction} onSort={onSort}/>
  <SortTh label="Cards" column="cards" sort={sort} direction={direction} onSort={onSort}/>
  <SortTh label="30D momentum" column="change30" sort={sort} direction={direction} onSort={onSort}/>
 </tr></thead><tbody>
  {rows.map(row=><tr key={`${row.game}:${row.set}`}><th scope="row"><a href={`/?mode=singles&market=${row.game}&rarity=all&sets=${encodeURIComponent(row.set)}`}>{row.set}</a></th><td>{formatGameName(row.game)}</td><td>{compactUsd(row.trackedValue)}</td><td>{formatUsd(row.medianPrice)}</td><td>{row.cards.toLocaleString()}</td><td><span className={`metrics-chip ${tone(row.change30)??""}`}>{pct(row.change30)}</span></td></tr>)}
 </tbody></table></div>;
}

type CategoryColumn="category"|"trackedValue"|"medianPrice"|"products"|"change30";
function CategoryTable({categories}:{categories:MetricsCategoryRow[]}){
 const {sort,direction,onSort}=useSort<CategoryColumn>("trackedValue");
 const rows=useMemo(()=>[...categories].sort((a,b)=>compare(a[sort],b[sort],direction)),[categories,sort,direction]);
 return <div className="detail-table-scroll"><table className="detail-variants-table metrics-table"><thead><tr>
  <SortTh label="Category" column="category" sort={sort} direction={direction} onSort={onSort}/>
  <th scope="col">Game</th>
  <SortTh label="Tracked value" column="trackedValue" sort={sort} direction={direction} onSort={onSort}/>
  <SortTh label="Median product" column="medianPrice" sort={sort} direction={direction} onSort={onSort}/>
  <SortTh label="Products" column="products" sort={sort} direction={direction} onSort={onSort}/>
  <SortTh label="30D momentum" column="change30" sort={sort} direction={direction} onSort={onSort}/>
 </tr></thead><tbody>
  {rows.map(row=><tr key={`${row.game}:${row.category}`}><th scope="row"><a href={`/?mode=sealed${row.game==="pokemon"?"":`&market=${row.game}`}`}>{row.category}</a></th><td>{formatGameName(row.game)}</td><td>{compactUsd(row.trackedValue)}</td><td>{formatUsd(row.medianPrice)}</td><td>{row.products.toLocaleString()}</td><td><span className={`metrics-chip ${tone(row.change30)??""}`}>{pct(row.change30)}</span></td></tr>)}
 </tbody></table></div>;
}

function MoverList({title,movers,empty}:{title:string;movers:MetricsMover[];empty:string}){
 return <div className="metrics-mover-list"><h3>{title}</h3>
  {movers.length?<ol>{movers.map(mover=><li key={`${mover.window}:${mover.productId}`}>
   <a href={mover.kind==="single"?`/cards/${mover.productId}`:`/sealed/${mover.productId}`}><b>{mover.name}</b><span>{mover.set} · {formatGameName(mover.game)}</span></a>
   <span className="metrics-mover-price">{formatUsd(mover.price)}</span>
   <span className={`metrics-chip ${tone(mover.change)??""}`}>{pct(mover.change)}</span>
  </li>)}</ol>:<p className="detail-unavailable">{empty}</p>}
 </div>;
}

function RatioBar({label,advancers,decliners}:{label:string;advancers:number;decliners:number}){
 const total=advancers+decliners,share=total?Math.round(advancers/total*100):50;
 return <div className="metrics-ratio"><div className="metrics-ratio-head"><span>{label}</span><span><em className="up">{advancers.toLocaleString()} up</em> · <em className="down">{decliners.toLocaleString()} down</em></span></div>
  <div className="metrics-ratio-bar" role="img" aria-label={`${label}: ${advancers} advancers, ${decliners} decliners`}><span style={{width:`${share}%`}}/></div>
 </div>;
}

export default function MetricsView({payload}:{payload:MetricsPayload|null}){
 const [strictness,setStrictness]=useState<SignalStrictness>("balanced");
 const [mode,setMode]=useState<Mode>("singles");
 const [market,setMarket]=useState<Market>("all");
 const [moversWindow,setMoversWindow]=useState<"7d"|"30d">("7d");
 useEffect(()=>{
  const saved=localStorage.getItem("raw-signal-strictness");
  if(saved==="conservative"||saved==="aggressive")setStrictness(saved);
  const params=new URLSearchParams(location.search);
  const nextMode=params.get("mode")==="sealed"?"sealed":"singles";
  const requested=params.get("market")as Market|null;
  setMode(nextMode);
  setMarket(requested&&MODE_MARKETS[nextMode].includes(requested)?requested:"all");
 },[]);
 const changeStrictness=(value:SignalStrictness)=>{setStrictness(value);try{localStorage.setItem("raw-signal-strictness",value)}catch{/* Storage unavailable; page-local only. */}};
 const setScope=(nextMode:Mode,nextMarket:Market)=>{
  const resolved=MODE_MARKETS[nextMode].includes(nextMarket)?nextMarket:"all";
  setMode(nextMode);setMarket(resolved);
  const params=new URLSearchParams();
  if(nextMode!=="singles")params.set("mode",nextMode);
  if(resolved!=="all")params.set("market",resolved);
  history.replaceState(null,"",params.size?`/metrics?${params}`:"/metrics");
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
  const sets=mode==="singles"?(market==="all"?[...payload.sets].sort((a,b)=>b.trackedValue-a.trackedValue).slice(0,30):payload.sets.filter(row=>row.game===market)):[];
  const categories=mode==="sealed"?payload.sealedCategories.filter(row=>market==="all"||row.game===market):[];
  return {overview,combined,momentum,gainers,decliners,sets,categories};
 },[payload,series,kind,mode,market,moversWindow]);

 const compareKeys=market==="all"?[indexKey(mode,"pokemon"),indexKey(mode,"riftbound")]:null;
 const comparePokemon=compareKeys?series[compareKeys[0]]??[]:[];
 const compareRiftbound=compareKeys?series[compareKeys[1]]??[]:[];
 const rebaseFrom=compareRiftbound[0]?.date??"";
 const rebase=(points:PricePoint[])=>{
  const start=points.find(point=>point.date>=rebaseFrom);
  if(!start||start.price<=0)return [];
  return points.filter(point=>point.date>=rebaseFrom).map(point=>({date:point.date,price:(point.price/start.price)*100}));
 };
 const pokemonBase=rebase(comparePokemon),riftboundBase=rebase(compareRiftbound);

 return <main className="detail-page metrics-page"><TopBar className="detail-topbar" active="metrics" strictness={strictness} onStrictness={changeStrictness}/>
  <article className="detail-content">
   <header className="metrics-head"><span className="kicker">Market metrics</span><h1>The market, measured.</h1>{payload&&<p className="detail-note">Rolled up {payload.rolledUpAt.slice(0,10)} from daily TCGCSV market data · equal-weighted indexes, rebalanced daily · informational, not financial advice.</p>}</header>
   {!payload?<section className="detail-section"><header><span>Unavailable</span><h2>Metrics need the database</h2></header><p className="detail-unavailable">This page reads the daily market rollups in the database-backed deployment. The local development server and feed-only deployments have no rollup data, so nothing is estimated here — visit the published site instead.</p></section>:<>
   <div className="metrics-scope" role="group" aria-label="Metrics scope">
    <div className="metrics-seg" role="tablist" aria-label="Mode">{(["singles","sealed"] as const).map(item=><button key={item} type="button" role="tab" aria-selected={mode===item} className={mode===item?"active":""} onClick={()=>setScope(item,market)}>{item==="singles"?"Singles":"Sealed"}</button>)}</div>
    <div className="metrics-seg" role="tablist" aria-label="Market">{MODE_MARKETS[mode].map(item=><button key={item} type="button" role="tab" aria-selected={market===item} className={market===item?"active":""} onClick={()=>setScope(mode,item)}>{item==="all"?"All":formatGameName(item)}</button>)}</div>
   </div>
   <section className="detail-section"><header><span>Tracked market</span><h2>Overview<InfoHint label="About tracked value">Tracked value sums current market prices across every tracked product — coverage, not capitalization. Movement follows each scope&apos;s equal-weighted index series.</InfoHint></h2></header>
    <div className="metrics-market-grid">
     {scoped&&scoped.combined&&<div className="metrics-market-card metrics-market-all"><header><b>{mode==="singles"?"All singles":"All sealed"}</b></header><div className="metrics-market-value">{compactUsd(scoped.combined.trackedValue)}</div><span className="metrics-market-sub">{scoped.combined.products.toLocaleString()} products</span><ChangeTiles change7={scoped.combined.change7} change30={scoped.combined.change30} change90={scoped.combined.change90}/></div>}
     {scoped?.overview.map(row=><div className="metrics-market-card" key={row.key}><header><b>{row.label}</b></header><div className="metrics-market-value">{compactUsd(row.trackedValue)}</div><span className="metrics-market-sub">{row.products.toLocaleString()} products</span><ChangeTiles change7={row.change7} change30={row.change30} change90={row.change90}/></div>)}
    </div></section>
   <section className="detail-section"><header><span>Movers</span><h2>Top movers<InfoHint label="About movers">Largest price changes over the selected window among products worth at least $10 (singles) or $20 (sealed) before and after the move. Extreme swings that typically reflect listing turnover rather than market movement are excluded. Links open the product&apos;s detail page.</InfoHint></h2>
    <div className="metrics-seg metrics-seg-small" role="tablist" aria-label="Movers window">{(["7d","30d"] as const).map(item=><button key={item} type="button" role="tab" aria-selected={moversWindow===item} className={moversWindow===item?"active":""} onClick={()=>setMoversWindow(item)}>{item==="7d"?"7D":"30D"}</button>)}</div></header>
    <div className="metrics-movers">
     <MoverList title="Gainers" movers={scoped?.gainers??[]} empty="No qualifying gainers in this window."/>
     <MoverList title="Decliners" movers={scoped?.decliners??[]} empty="No qualifying decliners in this window."/>
    </div></section>
   <section className="detail-section"><header><span>Breadth</span><h2>Momentum<InfoHint label="About breadth">Advancers and decliners count tracked products whose price moved over each window. Broad moves are sturdier than narrow ones; all-time marks compare today&apos;s price against each product&apos;s stored history.</InfoHint></h2></header>
    {scoped&&<><RatioBar label="7 days" advancers={scoped.momentum.advancers7} decliners={scoped.momentum.decliners7}/>
    <RatioBar label="30 days" advancers={scoped.momentum.advancers30} decliners={scoped.momentum.decliners30}/>
    <div className="detail-history-grid metrics-breadth-tiles">
     <div className="detail-metric"><small>At all-time high</small><b>{scoped.momentum.atHistoricHigh.toLocaleString()}</b></div>
     <div className="detail-metric"><small>At all-time low</small><b>{scoped.momentum.atHistoricLow.toLocaleString()}</b></div>
     <div className="detail-metric"><small>Tracked products</small><b>{scoped.momentum.tracked.toLocaleString()}</b><span>{mode==="singles"?"Singles":"Sealed"} with current prices and stored metrics</span></div>
    </div></>}</section>
   <section className="detail-section"><header><span>Equal-weighted indexes</span><h2>Indexes<InfoHint label="About the indexes">Each index is the mean of that day&apos;s top prices in its scope, rebalanced daily. Days observing too little of the market are excluded, which is why some series start later than others.</InfoHint></h2></header>
    <div className="metrics-index-grid">{visibleIndexKeys(mode,market).map(key=><IndexCard key={key} seriesKey={key} points={series[key]??[]}/>)}</div></section>
   {compareKeys&&<section className="detail-section"><header><span>Cross-market</span><h2>Pokémon vs Riftbound</h2></header>
    {pokemonBase.length>1&&riftboundBase.length>1?<><div className="metrics-legend"><span className="legend-pokemon">{INDEX_META[compareKeys[0]].title}</span><span className="legend-riftbound">{INDEX_META[compareKeys[1]].title}</span></div><PriceChart points={pokemonBase} overlay={riftboundBase} label="base-100 comparison"/><p className="detail-note">Each game&apos;s equal-weighted index rebased to 100 at the first shared rollup date. Values are index points, not dollars.</p></>:<p className="detail-unavailable">The comparison needs rolled-up history for both games.</p>}</section>}
   {mode==="singles"?<section className="detail-section"><header><span>By set</span><h2>Set leaderboard<InfoHint label="About the leaderboard">Top sets by tracked singles value. The median is the middle card price in the set; 30D momentum is the median of member cards&apos; 30-day changes. Set names link to the filtered leaderboard.</InfoHint></h2></header><SetTable sets={scoped?.sets??[]}/></section>
   :<section className="detail-section"><header><span>By category</span><h2>Category leaderboard<InfoHint label="About the leaderboard">Sealed products grouped by category. The median is the middle product price in the category; 30D momentum is the median of member products&apos; 30-day changes.</InfoHint></h2></header><CategoryTable categories={scoped?.categories??[]}/></section>}
   </>}
  </article></main>;
}
