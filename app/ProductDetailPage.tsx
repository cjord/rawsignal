"use client";
/* eslint-disable @next/next/no-html-link-for-pages, react-hooks/set-state-in-effect -- detail navigation preserves exact leaderboard URLs; the strictness preference hydrates after mount to match server HTML */
import {useEffect,useMemo,useRef,useState} from "react";
import DeferredImage from "./DeferredImage";
import InfoHint from "./InfoHint";
import PriceChart from "./PriceChart";
import SaleScenario from "./SaleScenario";
import TopBar from "./TopBar";
import {ChaseCardsSection,RelatedSealedSection} from "./detail-tables";
import {evaluateMarketSignal,type MarketSignal} from "./signal-utils";
import {calculateSealedScenario,type SealedScenario} from "./data/catalog-query";
import {detailPercentile} from "./domain/detail";
import {demandTrend,drawdownFromPeak,historyDepth,MIN_PEER_OBSERVATIONS,modeledFairValue,momentum,peerAnchorValue,rangePosition,salesWindow,trendSlope,volatilityRange} from "./domain/detail-metrics";
import {formatGameName,formatPercent,formatUsd,formatUtcDate} from "./domain/formatters";
import type {CatalogDetail,DetailPeerContext,DetailPeerQuartiles,DetailPriceVariant,GradedCardData,PeerAnchorStats,PriceHistory,SealedDetail,SignalStrictness} from "./domain/types";

const emptyHistory:PriceHistory={points:[],coverage:"none",change7:null,change30:null,change90:null,low30:null,high30:null,historyLow:null,historyHigh:null};
const numberParam=(params:URLSearchParams,key:string,fallback:number)=>{const raw=params.get(key);if(raw==null||raw.trim()==="")return fallback;const value=Number(raw);return Number.isFinite(value)?value:fallback};
const pct=(value:number|null)=>value==null?"N/A":formatPercent(value);

// hint stays visible for data (dates, delivered ranges); info tucks explanatory copy behind an ⓘ (todo D3).
function Metric({label,value,hint,info,tone}:{label:string;value:string;hint?:string;info?:string;tone?:"up"|"down"}){return <div className="detail-metric"><small>{label}{info&&<InfoHint label={`About ${label}`}>{info}</InfoHint>}</small><b className={tone}>{value}</b>{hint&&<span>{hint}</span>}</div>}


function SourceFacts({detail}:{detail:CatalogDetail}){const source=detail.source,premium=detail.kind==="sealed"&&detail.msrp&&detail.marketPrice!=null?(detail.marketPrice-detail.msrp)/detail.msrp*100:null,rows=[source.setAbbreviation&&["Set abbreviation",source.setAbbreviation],source.publishedOn&&["Set published",source.publishedOn.slice(0,10)],source.modifiedOn&&["Product updated",source.modifiedOn.slice(0,10)],source.isPresale===true&&["Presale","Yes"],premium!=null&&["MSRP premium",pct(premium)]].filter(Boolean) as string[][];return rows.length?<dl className="detail-facts">{rows.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>:<p className="detail-unavailable">Additional source metadata is unavailable for this product.</p>}

function PeerLine({peers,current,noun}:{peers:DetailPeerContext;current:number|null;noun:string}){
 const delta=peers.averagePrice&&current!=null?((current-peers.averagePrice)/peers.averagePrice)*100:null;
 const percentile=peers.position!=null&&peers.cohortSize>0?Math.max(1,Math.ceil(peers.position/peers.cohortSize*100)):null;
 // Labels arrive already plural ("Illustration Rare cards in Surging Sparks", "Elite Trainer Boxes") — never suffix them.
 return <p className="detail-peer-context">Average {peers.label}: <b>{formatUsd(peers.averagePrice,"N/A")}</b> across {peers.count.toLocaleString()} others{delta!=null&&<> · this {noun} sits <b className={delta<0?"down":"up"}>{formatPercent(Math.abs(delta)).replace("+","")} {delta<0?"below":"above"}</b> that average</>}{peers.position!=null&&<> · <b>#{peers.position} of {peers.cohortSize.toLocaleString()}</b>{percentile!=null&&<span className="peer-percentile"> (top {percentile}%)</span>}</>}.</p>;
}

// Quartile strip: where this product's price sits within the cohort spread — the same visual
// language as the range-position gauge.
function PeerSpread({quartiles,current}:{quartiles:DetailPeerQuartiles;current:number|null}){
 if(current==null||current<=0)return null;
 const span=Math.max(quartiles.max-quartiles.min,1e-9),pct=(value:number)=>`${Math.max(0,Math.min(100,(value-quartiles.min)/span*100))}%`;
 return <div className="peer-spread" role="img" aria-label={`Cohort prices span ${formatUsd(quartiles.min)} to ${formatUsd(quartiles.max)} with a median of ${formatUsd(quartiles.median)}; this price is ${formatUsd(current)}`}>
  <div className="peer-spread-track"><i className="peer-spread-iqr" style={{left:pct(quartiles.q1),width:`calc(${pct(quartiles.q3)} - ${pct(quartiles.q1)})`}}/><i className="peer-spread-median" style={{left:pct(quartiles.median)}}/><i className="peer-spread-marker" style={{left:pct(current)}}/></div>
  <div className="peer-spread-labels"><span>{formatUsd(quartiles.min)}</span><span>Median {formatUsd(quartiles.median)}</span><span>{formatUsd(quartiles.max)}</span></div>
 </div>;
}

function PeerContextNote({detail,cardChange30}:{detail:CatalogDetail;cardChange30?:number|null}){
 const noun=detail.kind==="single"?"card":"product",setPeers=detail.kind==="single"?detail.setPeerContext:null;
 const anchor=detail.kind==="single"?detail.peerAnchor:null;
 const peerMomentum=anchor&&anchor.avg30!=null&&anchor.avg30>0?((anchor.current-anchor.avg30)/anchor.avg30)*100:null;
 return <>
  {setPeers&&setPeers.count>0&&<PeerLine peers={setPeers} current={detail.marketPrice} noun={noun}/>}
  {setPeers?.quartiles&&<PeerSpread quartiles={setPeers.quartiles} current={detail.marketPrice}/>}
  {peerMomentum!=null&&<p className="detail-peer-context peer-momentum">30D momentum: peers <b className={peerMomentum<0?"down":"up"}>{formatPercent(peerMomentum)}</b>{cardChange30!=null&&<> · this {noun} <b className={cardChange30<0?"down":"up"}>{formatPercent(cardChange30)}</b></>}.</p>}
  {detail.peerContext&&detail.peerContext.count>0&&<PeerLine peers={detail.peerContext} current={detail.marketPrice} noun={noun}/>}
 </>;
}

function SimilarItems({detail}:{detail:CatalogDetail}){return <section className="detail-section"><header><span>Explore the market</span><h2>Similar {detail.kind==="single"?"cards":"products"}</h2></header>{detail.similar.length?<div className="similar-grid">{detail.similar.map(item=><a href={item.href} className="similar-card" key={`${item.kind}:${item.productId}`}><DeferredImage src={item.image} alt=""/><span><b>{item.name}</b><small>{item.set}</small><strong>{formatUsd(item.marketPrice,"N/A")}</strong></span></a>)}</div>:<p className="detail-unavailable">No close comparisons are available.</p>}</section>}

function SealedScenarioPanel({detail}:{detail:SealedDetail}){
 const initial=useMemo(()=>new URLSearchParams(typeof location==="undefined"?"":location.search),[]),[basis,setBasis]=useState<"market"|"median">(initial.get("basis")==="median"?"median":"market"),[keepPct,setKeepPct]=useState(numberParam(initial,"keepPct",100)),[taxOn,setTaxOn]=useState(initial.get("taxOn")==="1"),[taxRate,setTaxRate]=useState(numberParam(initial,"taxRate",8)),[shipping,setShipping]=useState(numberParam(initial,"shipping",0)),[profitableOnly,setProfitableOnly]=useState(false);
 const scenario:SealedScenario={basis,keepPct,taxOn,taxRate,shipping},result=calculateSealedScenario(detail,scenario);
 useEffect(()=>{const url=new URL(location.href);url.searchParams.set("basis",basis);if(keepPct===100)url.searchParams.delete("keepPct");else url.searchParams.set("keepPct",String(keepPct));if(taxOn)url.searchParams.set("taxOn","1");else url.searchParams.delete("taxOn");if(taxRate===8)url.searchParams.delete("taxRate");else url.searchParams.set("taxRate",String(taxRate));if(shipping)url.searchParams.set("shipping",String(shipping));else url.searchParams.delete("shipping");history.replaceState(null,"",url)},[basis,keepPct,taxOn,taxRate,shipping]);
 return <section className="detail-section detail-scenario"><header><span>What-if calculator</span><h2>Sale scenario</h2><div className="price-basis" aria-label="Scenario price basis"><i aria-hidden="true"/><button className={basis==="market"?"active":""} onClick={()=>setBasis("market")}>Market</button><button className={basis==="median"?"active":""} onClick={()=>setBasis("median")}>Median</button></div></header><SaleScenario keepPct={keepPct} onKeepPct={setKeepPct} taxOn={taxOn} onTaxOn={setTaxOn} taxRate={taxRate} onTaxRate={setTaxRate} shipping={shipping} onShipping={setShipping} profitableOnly={profitableOnly} onProfitableOnly={setProfitableOnly}/><div className="detail-scenario-results"><Metric label="Selected value" value={formatUsd(result.value,"N/A")}/><Metric label="Total cost" value={formatUsd(result.cost,"N/A")}/><Metric label="Net proceeds" value={formatUsd(result.proceeds,"N/A")}/><Metric label="Estimated profit" value={result.profit==null?"N/A":`${result.profit>=0?"+":""}${formatUsd(result.profit)}`} tone={result.profit==null?undefined:result.profit<0?"down":"up"}/><Metric label="Return" value={pct(result.profitPct)} tone={result.profitPct==null?undefined:result.profitPct<0?"down":"up"}/></div><p className="detail-note">Scenario inputs are estimates, not predictions. Missing MSRP or market pricing remains N/A.</p></section>
}

function MarkersGrid({history,current}:{history:PriceHistory;current:number|null}){
 const volatility=volatilityRange(history.points,90),trend=trendSlope(history.points,30),drift=momentum(current,history.points,30),drawdown=drawdownFromPeak(current,history.points,90);
 return <div className="detail-history-grid"><Metric label="Volatility (90D)" value={volatility==null?"N/A":`${volatility.toFixed(1)}%`} info="The 10–90th percentile spread of the last 90 days of prices, relative to the median."/><Metric label="Momentum (30D)" value={pct(drift)} info="Current price versus the trailing 30-day average." tone={drift==null?undefined:drift<0?"down":"up"}/><Metric label="Off 90D peak" value={drawdown==null?"N/A":drawdown===0?"At peak":formatPercent(drawdown)} tone={drawdown==null||drawdown===0?undefined:"down"}/><Metric label="Trend (30D)" value={trend==null?"N/A":`${trend>=0?"+":"−"}$${Math.abs(trend).toFixed(Math.abs(trend)<10?2:0)}/wk`} info="Fitted weekly slope of the last 30 days of observations." tone={trend==null?undefined:trend<0?"down":"up"}/></div>;
}

function SalesGrid({history}:{history:PriceHistory}){
 const sales=history.sales;
 if(!sales)return <p className="detail-unavailable">Sales activity is unavailable for this history source.</p>;
 const recent=salesWindow(sales.buckets,30),perWeek=sales.totalQuantity==null?null:sales.totalQuantity/(sales.windowDays/7);
 return <div className="detail-history-grid"><Metric label="Sold (90D)" value={sales.totalQuantity==null?"N/A":sales.totalQuantity.toLocaleString()} hint={sales.totalTransactions==null?undefined:`${sales.totalTransactions.toLocaleString()} transactions`}/><Metric label="Sales / week" value={perWeek==null?"N/A":perWeek.toFixed(1)} info="Average units sold per week across the trailing 90-day window."/><Metric label="Sold (30D)" value={recent.quantity.toLocaleString()}/><Metric label="Realized range (30D)" value={recent.low!=null&&recent.high!=null?`${formatUsd(recent.low)}–${formatUsd(recent.high)}`:"N/A"} info="The span of actual completed-sale prices; delivered figures include shipping." hint={recent.lowWithShipping!=null&&recent.highWithShipping!=null?`Delivered ${formatUsd(recent.lowWithShipping)}–${formatUsd(recent.highWithShipping)}`:undefined}/></div>;
}

function PrintingsTable({detail,printing,onSelect}:{detail:CatalogDetail;printing:string;onSelect:(variant:DetailPriceVariant)=>void}){
 if(detail.priceVariants.length<2)return null;
 const markets=detail.priceVariants.map(item=>item.marketPrice).filter((value):value is number=>value!=null&&value>0),cheapest=markets.length?Math.min(...markets):null;
 return <><h3 className="detail-subhead">All printings</h3><div className="detail-table-scroll"><table className="detail-variants-table"><thead><tr><th scope="col">Printing</th><th scope="col">Market</th><th scope="col">Listing low</th><th scope="col">Median</th><th scope="col">Vs cheapest</th></tr></thead><tbody>{detail.priceVariants.map(item=>{const premium=item.marketPrice!=null&&cheapest?((item.marketPrice-cheapest)/cheapest)*100:null,activeRow=item.printing===printing;return <tr key={item.printing} className={activeRow?"active":""}><th scope="row"><button type="button" onClick={()=>onSelect(item)} aria-pressed={activeRow}>{item.printing}</button></th><td>{formatUsd(item.marketPrice,"N/A")}</td><td>{formatUsd(item.lowPrice,"N/A")}</td><td>{formatUsd(item.midPrice,"N/A")}</td><td>{premium==null?"N/A":premium<0.5?"Cheapest":`+${premium.toFixed(0)}%`}</td></tr>})}</tbody></table></div><p className="detail-note">Selecting a printing switches the chart, metrics, and signal check to that printing&apos;s history.</p></>;
}

function FairValuePanel({history,loading,current,midPrice,kind,peerAnchor}:{history:PriceHistory|null;loading:boolean;current:number|null;midPrice:number|null;kind:"single"|"sealed";peerAnchor:PeerAnchorStats|null}){
 if(!history&&loading&&current!=null&&current>0)return <section className="detail-section detail-fair-value" aria-busy="true"><header><span>Valuation model</span><h2>Modeled fair value</h2></header><div className="detail-skeleton-lines" aria-hidden="true"><span className="detail-skeleton" style={{height:"44px",width:"38%"}}/><span className="detail-skeleton" style={{height:"16px",width:"56%"}}/><span className="detail-skeleton" style={{height:"7px"}}/></div></section>;
 if(!history||current==null||current<=0)return null;
 const anchor=peerAnchorValue(history.points,peerAnchor);
 const fair=modeledFairValue(history.points,midPrice,anchor);
 if(fair==null)return null;
 const premium=((current-fair)/fair)*100,position=Math.max(0,Math.min(100,50+premium));
 const tone=premium>5?"above":premium<-5?"below":"near";
 const trend=history.sales?demandTrend(history.sales.buckets):null;
 const perWeek=history.sales?.totalQuantity!=null?history.sales.totalQuantity/((history.sales.windowDays||90)/7):null;
 const swing=volatilityRange(history.points,90);
 return <section className="detail-section detail-fair-value">
  <header><span>Valuation model</span><h2>Modeled fair value</h2></header>
  <div className="fair-value-row"><strong className="fair-current">{formatUsd(current)}</strong><span className={`fair-chip is-${tone}`}>{tone==="above"?`↑ Premium ${formatPercent(premium)}`:tone==="below"?`↓ Discount ${formatPercent(Math.abs(premium)).replace("+","")}`:"≈ Near fair"}</span></div>
  <p className="fair-model-line">Modeled fair value <b>{formatUsd(fair)}</b><InfoHint label="How fair value is modeled">{anchor!=null
   ?<>Transparent blend of this printing&apos;s 90-day median (40%), 30-day median (24%), current median listing (16%), and set-rarity peer anchor (20%), renormalized when a component is unavailable.</>
   :<>Transparent blend of this {kind==="single"?"printing":"product"}&apos;s 90-day median (50%), 30-day median (30%), and current median listing (20%), renormalized when a component is unavailable.{peerAnchor!=null&&peerAnchor.observations<MIN_PEER_OBSERVATIONS&&<> A set-rarity peer anchor activates after {MIN_PEER_OBSERVATIONS} daily peer observations ({peerAnchor.observations} so far).</>}</>
  }</InfoHint></p>
  <p className="fair-headline">Priced {tone==="near"?"near":tone} fair value.</p>
  <div className={`fair-gauge tone-${tone}`} role="img" aria-label={`Price sits ${formatPercent(premium)} versus the modeled fair value`}><i style={{left:`${position}%`}}/></div>
  <div className="fair-gauge-labels"><span>Below fair</span><span>Fair</span><span>Above fair</span></div>
  <div className="fair-chips">{anchor!=null&&<span>Set-rarity anchored</span>}{trend&&<span className={trend.label==="rising"?"up":trend.label==="cooling"?"down":""}>Demand {trend.label}</span>}{perWeek!=null&&<span>{perWeek.toFixed(1)}/wk sold</span>}{swing!=null&&<span>{swing<8?"Low":swing<20?"Moderate":"High"} volatility</span>}</div>
  <p className="detail-note">An informational model — not a valuation guarantee or financial advice.</p>
 </section>;
}

const gradeLabel=(key:string)=>{if(key==="ungraded")return "Raw (eBay)";const match=key.match(/^([a-z]+)([\d_]+)$/);return match?`${match[1].toUpperCase()} ${match[2].replace("_",".")}`:key.toUpperCase()};

function GradedMarketSection({graded,current}:{graded:GradedCardData|null;current:number|null}){
 if(!graded)return null;
 const rows=Object.entries(graded.grades).filter(([,stat])=>stat.count>=2).sort((a,b)=>(b[1].smartPrice??b[1].median??0)-(a[1].smartPrice??a[1].median??0)).slice(0,10);
 if(!rows.length)return null;
 return <section className="detail-section"><header><span>Graded market</span><h2>Graded sales</h2></header>
  <div className="detail-table-scroll"><table className="detail-variants-table"><thead><tr><th scope="col">Grade</th><th scope="col">Sales</th><th scope="col">Median</th><th scope="col">Smart market</th><th scope="col">Trend</th><th scope="col">Vs raw</th></tr></thead><tbody>
  {rows.map(([key,stat])=>{const anchor=stat.smartPrice??stat.median,multiple=anchor!=null&&current?anchor/current:null;return <tr key={key}><th scope="row">{gradeLabel(key)}</th><td>{stat.count.toLocaleString()}</td><td>{formatUsd(stat.median,"N/A")}</td><td>{formatUsd(stat.smartPrice,"N/A")}{stat.confidence&&<small className="grade-confidence">{stat.confidence}</small>}</td><td className={stat.trend??""}>{stat.trend==="up"?"▲ up":stat.trend==="down"?"▼ down":"—"}</td><td>{multiple!=null?`${multiple.toFixed(1)}×`:"N/A"}</td></tr>})}
  </tbody></table></div>
  <p className="detail-note">eBay completed sales via PokemonPriceTracker · updated {graded.updatedAt}. Marketplace data — not a valuation guarantee.<InfoHint label="About smart market prices">Smart market is the provider&apos;s filtered, weighted sale price with its stated confidence. Grading population counts are unavailable on the current plan.</InfoHint></p>
 </section>;
}

function PullRatesSection({detail}:{detail:SealedDetail}){
 if(!detail.pullRates.length)return null;
 return <section className="detail-section"><header><span>Pack odds</span><h2>Pull rates</h2></header>
  <div className="detail-table-scroll"><table className="detail-variants-table"><thead><tr><th scope="col">Rarity</th><th scope="col">Cards in set</th><th scope="col">Any hit</th><th scope="col">Specific card</th><th scope="col">Cost per hit</th><th scope="col">Avg market</th></tr></thead><tbody>
  {detail.pullRates.map(row=><tr key={row.rarity}><th scope="row">{row.rarity}</th><td>{row.cardCount}</td><td>1 in {row.packsPerHit}</td><td>1 in ~{Math.round(row.packsPerHit*row.cardCount).toLocaleString()}</td><td>{formatUsd(row.costPerHit,"N/A")}</td><td>{formatUsd(row.averageMarket,"N/A")}</td></tr>)}
  </tbody></table></div>
  <p className="detail-note">Community-measured pull-rate estimates{detail.packPrice!=null?` · costs use the ${formatUsd(detail.packPrice)} single-pack market price`:""}.<InfoHint label="About pull-rate accuracy">Odds vary by product and print run; treat community-measured rates as approximations, not guarantees.</InfoHint></p>
 </section>;
}

function DetailSignalBadge({signal}:{signal:MarketSignal}){return <span className={`signal-badge ${signal.side} confidence-${signal.confidence}`} title={signal.detail}><b>{signal.reason}</b><small>{signal.score} signal · {signal.confidence} confidence</small></span>}

function SignalsPanel({history,loading,current,strictness}:{history:PriceHistory|null;loading:boolean;current:number|null;strictness:SignalStrictness}){
 return <section className="detail-section" aria-busy={loading||undefined}><header><span>Signal check</span><h2>Hot Buy / Hot Sell</h2></header>{history?<div className="detail-signals">{(["buy","sell"] as const).map(side=>{const evaluation=evaluateMarketSignal(history.points,side,strictness,current);return <div key={side} className={`detail-signal-card${evaluation.eligible?` is-${side}`:""}`}><small>{side==="buy"?"Hot Buy":"Hot Sell"}</small>{evaluation.eligible?<><DetailSignalBadge signal={evaluation.signal}/><p>{evaluation.signal.detail}</p></>:<p className="detail-signal-miss"><b>Not qualifying.</b> {evaluation.detail}</p>}</div>})}</div>:loading?<div className="detail-signals" aria-hidden="true"><span className="detail-signal-card detail-skeleton"/><span className="detail-signal-card detail-skeleton"/></div>:<p className="detail-unavailable">Signal evaluation needs price history.</p>}<p className="detail-note">Checked at {strictness} strictness — adjustable in display settings. Signals are informational qualification checks against this printing&apos;s history. They are not guarantees or financial advice.</p></section>;
}

export default function ProductDetailPage({detail,market,serverTiming}:{detail:CatalogDetail;market?:string;serverTiming?:string|null}){
 const [variant,setVariant]=useState(detail.priceVariants.find(item=>item.printing===(detail.kind==="single"?detail.printing:"Sealed"))??detail.priceVariants[0]),[historyResult,setHistoryResult]=useState<{key:string;value:PriceHistory|null;error:boolean}>({key:"",value:null,error:false}),[strictness,setStrictness]=useState<SignalStrictness>("balanced");
 const fallback=detail.kind==="single"?`/?mode=singles&market=${detail.game}`:`/?mode=sealed&market=${market??detail.game}`,current=variant?.marketPrice??detail.marketPrice,printing=variant?.printing??(detail.kind==="single"?detail.printing:"Sealed"),historyKey=`${detail.kind}:${detail.productId}:${printing}`;
 useEffect(()=>{const controller=new AbortController(),params=new URLSearchParams({productId:String(detail.productId),printing});if(detail.kind==="sealed")params.set("sealed","1");fetch(`/api/history?${params}`,{signal:controller.signal}).then(response=>{if(!response.ok)throw new Error();return response.json()}).then(value=>setHistoryResult({key:historyKey,value:value as PriceHistory,error:false})).catch(error=>{if(error.name!=="AbortError")setHistoryResult({key:historyKey,value:null,error:true})});return()=>controller.abort()},[detail.kind,detail.productId,printing,historyKey]);
 useEffect(()=>{const saved=localStorage.getItem("raw-signal-strictness");if(saved==="conservative"||saved==="aggressive")setStrictness(saved)},[]);
 const changeStrictness=(value:SignalStrictness)=>{setStrictness(value);try{localStorage.setItem("raw-signal-strictness",value)}catch{/* Storage unavailable (private mode); the preference applies for this page only. */}};
 const historyData=historyResult.key===historyKey?historyResult.value:null,historyError=historyResult.key===historyKey&&historyResult.error,h=historyData??emptyHistory,depth=historyDepth(historyData),rankPct=detailPercentile(detail),position=rangePosition(current,h.historyLow,h.historyHigh);
 const sourceLabel=detail.source.sourceUpdatedAt?`Source updated ${detail.source.sourceUpdatedAt.slice(0,10)}`:"Current TCGCSV / TCGplayer snapshot";
 const marketKey=detail.kind==="single"?detail.game:(market??detail.game);
 const gameHref=detail.kind==="single"?`/?mode=singles&market=${detail.game}&rarity=all`:`/?mode=sealed&market=${marketKey}`;
 const setHref=`${gameHref}&sets=${encodeURIComponent(detail.set)}`;
 // Always return to the exact filtered leaderboard the visitor left, not whatever history entry precedes this card.
 const backToResults=()=>{let saved:string|null=null;try{saved=sessionStorage.getItem("raw-signal-last-list-url")}catch{/* Storage unavailable (private mode); fall back to the default list. */}location.assign(saved??fallback)};
 // Cursor-tracking tilt on the hero art (mouse only): a deliberate interactive exception to
 // the flat-hover rule, recorded in docs/design-baseline.md.
 const artRef=useRef<HTMLDivElement>(null);
 const onArtMove=(event:React.PointerEvent<HTMLDivElement>)=>{const element=artRef.current;if(!element||event.pointerType!=="mouse")return;const rect=element.getBoundingClientRect(),x=(event.clientX-rect.left)/rect.width-.5,y=(event.clientY-rect.top)/rect.height-.5;element.style.setProperty("--tilt-x",`${(-y*9).toFixed(2)}deg`);element.style.setProperty("--tilt-y",`${(x*11).toFixed(2)}deg`)};
 const onArtLeave=()=>{const element=artRef.current;if(element){element.style.setProperty("--tilt-x","0deg");element.style.setProperty("--tilt-y","0deg")}};
 return <main className="detail-page" data-server-timing={serverTiming??undefined}><TopBar className="detail-topbar" active={detail.kind==="single"?detail.game:"sealed"} strictness={strictness} onStrictness={changeStrictness} actions={<button type="button" className="detail-back" onClick={backToResults}>← Back to results</button>}/><article className="detail-content"><nav className="detail-breadcrumb" aria-label="Breadcrumb"><a href="/">Market Rankings</a><span aria-hidden="true">/</span><a href={gameHref}>{formatGameName(marketKey)}</a><span aria-hidden="true">/</span><a href={setHref}>{detail.set}</a></nav><section className="detail-hero"><div ref={artRef} className="detail-art" onPointerMove={onArtMove} onPointerLeave={onArtLeave}><DeferredImage src={detail.image} alt={`${detail.name} ${detail.kind==="single"?"card":"product"}`}/></div><div className="detail-overview"><div className="detail-eyebrow"><span className="kicker">{detail.kind==="single"?`${detail.rarity} · ${detail.printing}`:`${detail.category} · Sealed product`}</span><div className="detail-actions"><a className="tcgplayer-button" href={detail.url} target="_blank" rel="noopener noreferrer">{detail.exactTcgplayerUrl?"View":"Search"} on TCGplayer ↗</a></div></div><h1>{detail.name}</h1><p>{detail.set}{detail.kind==="single"?` · ${detail.number}`:""}</p><div className="detail-primary-price"><small>TCGplayer market</small><strong>{formatUsd(current,"N/A")}</strong></div><div className="detail-overview-grid"><Metric label="Listing low" value={formatUsd(variant?.lowPrice,"N/A")}/><Metric label="Median" value={formatUsd(variant?.midPrice,"N/A")}/>{detail.kind==="sealed"&&<Metric label="MSRP" value={formatUsd(detail.msrp,"N/A")} hint={detail.msrpSource??"Unavailable"}/>}<Metric label="Market rank" value={detail.marketRank?`#${detail.marketRank} of ${detail.marketRankTotal}`:"N/A"} hint={rankPct?`Top ${100-rankPct+1}% of peers`:undefined}/>{detail.kind==="single"&&detail.pullRate&&<Metric label="Pull rate" value={`1 in ~${Math.round(detail.pullRate.packsPerCard).toLocaleString()} packs`} hint={detail.pullRate.costPerCard!=null?`≈${formatUsd(detail.pullRate.costPerCard)} in packs · community estimate`:"Community estimate"}/>}</div><PeerContextNote detail={detail} cardChange30={h.change30}/></div></section>
 <FairValuePanel history={historyData} loading={!historyData&&!historyError} current={current} midPrice={variant?.midPrice??null} kind={detail.kind} peerAnchor={detail.kind==="single"?detail.peerAnchor:null}/>
 <section className="detail-section detail-history"><header><span>Market movement</span><h2>Price history</h2>{detail.priceVariants.length>1&&<label className="detail-variant"><span>Printing</span><select value={variant?.printing} onChange={event=>setVariant(detail.priceVariants.find(item=>item.printing===event.target.value) as DetailPriceVariant)}>{detail.priceVariants.map(item=><option key={item.printing}>{item.printing}</option>)}</select></label>}</header>{historyError?<p className="detail-unavailable">Price history is temporarily unavailable.</p>:!historyData?<div aria-busy="true"><div className="detail-chart-loading" aria-label="Loading price history"/><div className="detail-history-grid" aria-hidden="true">{Array.from({length:7},(_,index)=><span key={index} className="detail-metric detail-skeleton"/>)}</div></div>:<><PriceChart points={h.points} volumes={h.sales?.buckets} label="market" large/><div className="detail-history-grid"><Metric label="7 day" value={pct(h.change7)} tone={h.change7==null?undefined:h.change7<0?"down":"up"}/><Metric label="30 day" value={pct(h.change30)} tone={h.change30==null?undefined:h.change30<0?"down":"up"}/><Metric label="90 day" value={pct(h.change90)} tone={h.change90==null?undefined:h.change90<0?"down":"up"}/><Metric label="30D range" value={h.low30!=null&&h.high30!=null?`${formatUsd(h.low30)}–${formatUsd(h.high30)}`:"N/A"}/><Metric label="All-time range" value={h.historyLow!=null&&h.historyHigh!=null?`${formatUsd(h.historyLow)}–${formatUsd(h.historyHigh)}`:"N/A"}/><Metric label="Range position" value={position==null?"N/A":`${position.toFixed(0)}%`} info="Where the current price sits within the all-time observed range: 0% is the low, 100% the high." tone={position==null?undefined:position<=35?"up":position>=75?"down":undefined}/><Metric label="Observations" value={String(depth.count)} hint={depth.first&&depth.last?`${formatUtcDate(depth.first,true)} – ${formatUtcDate(depth.last,true)}`:undefined}/></div>
 <h3 className="detail-subhead">Volatility &amp; momentum</h3><MarkersGrid history={h} current={current}/>
 <h3 className="detail-subhead">Sales activity</h3><SalesGrid history={h}/>
 <PrintingsTable detail={detail} printing={printing} onSelect={setVariant}/>
 <p className="detail-note">{h.coverage==="exact"?"Exact":"Fallback"} {h.variant??variant?.printing} · {h.condition??"market"} history. Sales counts are TCGplayer completed sales for this printing and condition, reported in three-day buckets over the trailing 90 days.</p></>}</section>
 <SignalsPanel history={historyData} loading={!historyData&&!historyError} current={current} strictness={strictness}/>
 {detail.kind==="single"&&<GradedMarketSection graded={detail.graded} current={current}/>}
 {detail.kind==="single"&&<RelatedSealedSection products={detail.relatedSealed} setName={detail.set} market={detail.game}/>}
 {detail.kind==="sealed"&&<SealedScenarioPanel detail={detail}/>}
 {detail.kind==="sealed"&&<PullRatesSection detail={detail}/>}
 {detail.kind==="sealed"&&<ChaseCardsSection cards={detail.chaseCards} packPrice={detail.packPrice} setName={detail.set}/>}
 {detail.kind==="sealed"&&<RelatedSealedSection products={detail.relatedSealed} setName={detail.set} market={market}/>}
 <details className="detail-section detail-collapsible"><summary><span>Product overview</span><h2>{detail.kind==="single"?"Card details":"Product details"}</h2><i className="detail-collapse-mark" aria-hidden="true">▸</i></summary><div className="detail-info-layout"><SourceFacts detail={detail}/>{detail.metadata.length?<dl className="detail-metadata">{detail.metadata.map(field=><div key={`${field.name}:${field.value}`}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl>:<p className="detail-unavailable">No additional category-specific fields were supplied for this product.</p>}</div>{detail.source.presaleNote&&<p className="detail-note">Presale note: {detail.source.presaleNote}</p>}<p className="detail-note">{sourceLabel}. Market prices and history are informational and are not guarantees of future value.</p></details><SimilarItems detail={detail}/></article></main>;
}
