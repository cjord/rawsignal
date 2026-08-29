"use client";
import DeferredImage from "./DeferredImage";
import PriceChart from "./PriceChart";
import TopBar from "./TopBar";
import {ChaseCardsSection,RelatedSealedSection} from "./detail-tables";
import {parseStrictness,STRICTNESS_KEY,usePreference} from "./state/usePreference";
import {setGroupLabel} from "../core/domain/eras";
import {formatGameName,formatPercent,formatUsd,formatUtcDate} from "../core/domain/formatters";
import type {SetDetailPayload} from "../core/domain/sets";
import type {PricePoint} from "../core/domain/types";
import {setLogoFor} from "./data/set-logos";

const indexFormat=(value:number)=>Math.round(value).toLocaleString();
const NEW_SET_DAYS=60;

// Both lines rebased to 1,000 at each series' own start: levels become comparable
// while every window delta stays true to the underlying sums.
const rebaseTo1000=(points:PricePoint[]):PricePoint[]=>{
 const start=points[0];
 if(!start||start.price<=0)return [];
 return points.map(point=>({date:point.date,price:(point.price/start.price)*1000}));
};

const tone=(value:number|null)=>value==null||value===0?undefined:value<0?"down":"up";

export default function SetDetailView({payload}:{payload:SetDetailPayload}){
 const [strictness,setStrictness]=usePreference(STRICTNESS_KEY,parseStrictness,"balanced");
 const logo=setLogoFor(payload.game,payload.set);
 const released=payload.releaseDate?new Date(`${payload.releaseDate}T00:00:00Z`):null;
 const ageDays=released?Math.floor((Date.parse(payload.generatedAt)-released.getTime())/86400000):null;
 const ageMonths=ageDays==null?null:Math.floor(ageDays/30.44);
 const ageLabel=ageMonths==null?null:ageMonths<1?"new this month":ageMonths<12?`${ageMonths} month${ageMonths===1?"":"s"} old`:`${Math.floor(ageMonths/12)}y ${ageMonths%12}m old`;
 const singles=rebaseTo1000(payload.singlesIndex),sealedLine=rebaseTo1000(payload.sealedIndex);
 const mainLine=singles.length>1?singles:sealedLine,overlayLine=singles.length>1&&sealedLine.length>1?sealedLine:null;
 const mainLabel=singles.length>1?"Singles value":"Sealed value";
 const dataThrough=(payload.singlesIndex.at(-1)?.date??payload.sealedIndex.at(-1)?.date)??null;
 const chaseCards=[...payload.cards].filter(card=>payload.packPrice==null||card.marketPrice>payload.packPrice).sort((a,b)=>b.marketPrice-a.marketPrice).slice(0,12);
 const cardListHref=`/?mode=singles&market=${payload.game}&rarity=all&sets=${encodeURIComponent(payload.set)}`;
 return <main className="detail-page sets-page set-detail-page"><TopBar active="sets" strictness={strictness} onStrictness={setStrictness}/>
  <article className="detail-content">
   <p className="kicker set-breadcrumb"><a href={`/sets?market=${payload.game}`}>Sets</a> / {payload.set}</p>
   <header className="set-detail-head">
    {logo?<span className="set-detail-logo"><DeferredImage src={logo.logo} alt={`${payload.set} logo`} className="set-logo-image"/></span>
     :<span className={`set-tile-mark mark-${payload.game}`} aria-hidden="true">{payload.set}</span>}
    <div className="set-detail-title">
     <h1>{payload.set}{ageDays!=null&&ageDays<=NEW_SET_DAYS&&<span className="set-badge-new">New set</span>}</h1>
     <p className="set-detail-meta">{setGroupLabel(payload.game,payload.group)} · {formatGameName(payload.game)}{payload.releaseDate&&<> · released {formatUtcDate(payload.releaseDate,true)}</>}{ageLabel&&<> · {ageLabel}</>}{dataThrough&&<> · data through {formatUtcDate(dataThrough,true)}</>}</p>
    </div>
    <a className="set-detail-cardlist" href={cardListHref}>Open card list →</a>
   </header>
   <div className="detail-history-grid set-detail-tiles">
    <div className="detail-metric"><small>Chase cards</small><b>{payload.chaseCount}</b><span>{payload.packPrice!=null?`priced above the ${formatUsd(payload.packPrice)} pack`:"tracked in this set"}</span></div>
    <div className="detail-metric"><small>Chase market</small><b>{formatUsd(payload.chaseMarket)}</b><span>summed card value</span></div>
    <div className="detail-metric"><small>Sealed SKUs</small><b>{payload.sealedCount}</b><span>tracked products</span></div>
    <div className="detail-metric"><small>Pack EV</small>{payload.packEv!=null?<><b className={payload.evRatio!=null?(payload.evRatio>=1?"up":"down"):undefined}>{formatUsd(payload.packEv)}</b><span>{payload.evRatio!=null?`${payload.evRatio.toFixed(2)}× the ${formatUsd(payload.packPrice)} pack`:"per pack opened"}</span></>:<><b>—</b><span>needs pull-rate data</span></>}</div>
    <div className="detail-metric"><small>Singles 30D</small><b className={tone(payload.singlesChange30)}>{payload.singlesChange30==null?"—":formatPercent(payload.singlesChange30)}</b><span>median member change</span></div>
    <div className="detail-metric"><small>Sealed 30D</small><b className={tone(payload.sealedChange30)}>{payload.sealedChange30==null?"—":formatPercent(payload.sealedChange30)}</b><span>median member change</span></div>
   </div>
   <section className="detail-section"><header><span>{payload.set} index · base 1,000</span><h2>Set Value</h2></header>
    {mainLine.length>1?<>
     {overlayLine&&<div className="metrics-legend"><span className="legend-line legend-main">Singles value</span><span className="legend-line chart-series-2">Sealed value</span></div>}
     <PriceChart points={mainLine} overlays={overlayLine?[{label:"Sealed value",points:overlayLine,className:"chart-series-2"}]:undefined} mainLabel={mainLabel} formatValue={indexFormat} label={`${payload.set} set value`}/>
     <p className="detail-note">Each line sums the day&apos;s observed member prices, rebased to 1,000 at its first tracked day. Days observing under 60% of the set are excluded rather than estimated.</p>
    </>:<p className="detail-unavailable">The set index accumulates from daily observations — not enough tracked days yet.</p>}
   </section>
   <RelatedSealedSection products={payload.sealed} setName={payload.set} market={payload.game}/>
   <ChaseCardsSection cards={chaseCards} packPrice={payload.packPrice} setName={payload.set}/>
  </article></main>;
}
