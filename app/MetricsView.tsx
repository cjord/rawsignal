"use client";
/* eslint-disable @next/next/no-html-link-for-pages, react-hooks/set-state-in-effect -- set links re-enter the leaderboard with full query state; the strictness preference hydrates after mount */
import {useEffect,useState} from "react";
import PriceChart from "./PriceChart";
import TopBar from "./TopBar";
import {formatGameName,formatPercent,formatUsd} from "./domain/formatters";
import type {PricePoint,SignalStrictness} from "./domain/types";
import type {MetricsPayload,MetricsSetRow} from "./data/metrics-service";

const pct=(value:number|null)=>value==null?"N/A":formatPercent(value);
const tone=(value:number|null)=>value==null||value===0?undefined:value<0?"down":"up";
const compactUsd=(value:number)=>value>=1_000_000?`$${(value/1_000_000).toFixed(2)}M`:value>=10_000?`$${Math.round(value/1000).toLocaleString()}k`:formatUsd(value);

function Tile({label,value,hint,toneClass}:{label:string;value:string;hint?:string;toneClass?:"up"|"down"}){
 return <div className="detail-metric"><small>{label}</small><b className={toneClass}>{value}</b>{hint&&<span>{hint}</span>}</div>;
}

// Both series rebased to 100 at their first shared date so trajectories compare directly.
function rebase(points:PricePoint[],from:string):PricePoint[]{
 const start=points.find(point=>point.date>=from);
 if(!start||start.price<=0)return [];
 return points.filter(point=>point.date>=from).map(point=>({date:point.date,price:(point.price/start.price)*100}));
}

function IndexCard({title,points,note}:{title:string;points:PricePoint[];note:string}){
 const latest=points.at(-1);
 return <div className="metrics-index-card"><header><b>{title}</b>{latest&&<span className="metrics-index-value">{formatUsd(latest.price)}</span>}</header>
  {points.length>1?<PriceChart points={points} label={title}/>:<p className="detail-unavailable">Not enough rolled-up history yet.</p>}
  <p className="detail-note">{note}</p></div>;
}

function SetTable({sets}:{sets:MetricsSetRow[]}){
 return <div className="detail-table-scroll"><table className="detail-variants-table"><thead><tr><th scope="col">Set</th><th scope="col">Game</th><th scope="col">Tracked value</th><th scope="col">Median card</th><th scope="col">Cards</th><th scope="col">30D momentum</th></tr></thead><tbody>
  {sets.map(row=><tr key={`${row.game}:${row.set}`}><th scope="row"><a href={`/?mode=singles&market=${row.game}&rarity=all&sets=${encodeURIComponent(row.set)}`}>{row.set}</a></th><td>{formatGameName(row.game)}</td><td>{compactUsd(row.trackedValue)}</td><td>{formatUsd(row.medianPrice)}</td><td>{row.cards.toLocaleString()}</td><td className={tone(row.change30)??""}>{pct(row.change30)}</td></tr>)}
 </tbody></table></div>;
}

export default function MetricsView({payload}:{payload:MetricsPayload|null}){
 const [strictness,setStrictness]=useState<SignalStrictness>("balanced");
 useEffect(()=>{const saved=localStorage.getItem("raw-signal-strictness");if(saved==="conservative"||saved==="aggressive")setStrictness(saved)},[]);
 const changeStrictness=(value:SignalStrictness)=>{setStrictness(value);try{localStorage.setItem("raw-signal-strictness",value)}catch{/* Storage unavailable; page-local only. */}};
 const series=payload?.series??{};
 const pokemonBase=payload?rebase(series["median:pokemon-singles"]??[],(series["median:riftbound-singles"]??[])[0]?.date??""):[];
 const riftboundBase=payload?rebase(series["median:riftbound-singles"]??[],(series["median:riftbound-singles"]??[])[0]?.date??""):[];
 return <main className="detail-page metrics-page"><TopBar className="detail-topbar" active="metrics" strictness={strictness} onStrictness={changeStrictness}/>
  <article className="detail-content">
   <header className="metrics-head"><span className="kicker">Market metrics</span><h1>The market, measured.</h1>{payload&&<p className="detail-note">Rolled up {payload.rolledUpAt.slice(0,10)} from daily TCGCSV market data · equal-weighted indexes, rebalanced daily · informational, not financial advice.</p>}</header>
   {!payload?<section className="detail-section"><header><span>Unavailable</span><h2>Metrics need the database</h2></header><p className="detail-unavailable">This page reads the daily market rollups in the database-backed deployment. The local development server and feed-only deployments have no rollup data, so nothing is estimated here — visit the published site instead.</p></section>:<>
   <section className="detail-section"><header><span>Tracked market</span><h2>Overview</h2></header>
    <div className="detail-history-grid metrics-overview">{payload.overview.map(row=><div className="detail-metric" key={row.key}><small>{row.label}</small><b>{compactUsd(row.trackedValue)}</b><span>{row.products.toLocaleString()} products{row.breakdown?` · ${row.breakdown}`:""}</span><span className="metrics-changes"><em className={tone(row.change7)??""}>{pct(row.change7)} 7D</em><em className={tone(row.change30)??""}>{pct(row.change30)} 30D</em><em className={tone(row.change90)??""}>{pct(row.change90)} 90D</em></span></div>)}</div>
    <p className="detail-note">Tracked value sums current market prices across every tracked product — coverage, not capitalization. Movement follows the median (singles) and sealed-index series.</p></section>
   <section className="detail-section"><header><span>Equal-weighted indexes</span><h2>Indexes</h2></header>
    <div className="metrics-index-grid">
     <IndexCard title="RS-100 Cards" points={series["index:cards"]??[]} note="Mean of the top 100 card prices each day, all games, rebalanced daily."/>
     <IndexCard title="RS-50 Sealed" points={series["index:sealed"]??[]} note="Mean of the top 50 sealed prices each day; Pokémon cases excluded."/>
     <IndexCard title="Pokémon-100" points={series["index:pokemon-cards"]??[]} note="Mean of the top 100 Pokémon card prices each day."/>
     <IndexCard title="Riftbound-50" points={series["index:riftbound-cards"]??[]} note="Mean of the top 50 Riftbound card prices each day."/>
    </div></section>
   <section className="detail-section"><header><span>Cross-market</span><h2>Pokémon vs Riftbound</h2></header>
    {pokemonBase.length>1&&riftboundBase.length>1?<><div className="metrics-legend"><span className="legend-pokemon">Pokémon median</span><span className="legend-riftbound">Riftbound median</span></div><PriceChart points={pokemonBase} overlay={riftboundBase} label="base-100 comparison"/><p className="detail-note">Both games&apos; median card prices rebased to 100 at the first shared rollup date. Values are index points, not dollars.</p></>:<p className="detail-unavailable">The comparison needs rolled-up history for both games.</p>}</section>
   <section className="detail-section"><header><span>By set</span><h2>Set leaderboard</h2></header><SetTable sets={payload.sets}/><p className="detail-note">Top sets by tracked singles value. 30D momentum is the median of member cards&apos; 30-day changes. Set names link to the filtered leaderboard.</p></section>
   <section className="detail-section"><header><span>Breadth</span><h2>Momentum</h2></header>
    <div className="detail-history-grid"><Tile label="Advancers (7D)" value={payload.momentum.advancers7.toLocaleString()} toneClass="up"/><Tile label="Decliners (7D)" value={payload.momentum.decliners7.toLocaleString()} toneClass="down"/><Tile label="Advancers (30D)" value={payload.momentum.advancers30.toLocaleString()} toneClass="up"/><Tile label="Decliners (30D)" value={payload.momentum.decliners30.toLocaleString()} toneClass="down"/><Tile label="At all-time high" value={payload.momentum.atHistoricHigh.toLocaleString()}/><Tile label="At all-time low" value={payload.momentum.atHistoricLow.toLocaleString()}/><Tile label="Tracked cards" value={payload.momentum.tracked.toLocaleString()} hint="Singles with current prices and stored metrics"/></div></section>
   </>}
  </article></main>;
}
