"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- detail navigation preserves exact leaderboard URLs */
import {useEffect,useMemo,useRef,useState} from "react";
import DeferredImage from "./DeferredImage";
import PriceChart from "./PriceChart";
import SaleScenario from "./SaleScenario";
import {ChaseCardsSection,RelatedSealedSection} from "./detail-tables";
import {evaluateMarketSignal,type MarketSignal} from "./signal-utils";
import {calculateSealedScenario,type SealedScenario} from "./data/catalog-query";
import {detailPercentile} from "./domain/detail";
import {demandTrend,distanceAbove,distanceBelow,drawdownFromPeak,historyDepth,modeledFairValue,momentum,priceStreak,rangePosition,rangeWidth,salesWindow,trendSlope,volatilityRange} from "./domain/detail-metrics";
import {formatPercent,formatUsd,formatUtcDate} from "./domain/formatters";
import type {CatalogDetail,DetailPriceVariant,GradedCardData,PriceHistory,SealedDetail,SignalStrictness} from "./domain/types";

const emptyHistory:PriceHistory={points:[],coverage:"none",change7:null,change30:null,change90:null,low30:null,high30:null,historyLow:null,historyHigh:null};
const numberParam=(params:URLSearchParams,key:string,fallback:number)=>{const raw=params.get(key);if(raw==null||raw.trim()==="")return fallback;const value=Number(raw);return Number.isFinite(value)?value:fallback};
const pct=(value:number|null)=>value==null?"N/A":formatPercent(value);

function Metric({label,value,hint,tone}:{label:string;value:string;hint?:string;tone?:"up"|"down"}){return <div className="detail-metric"><small>{label}</small><b className={tone}>{value}</b>{hint&&<span>{hint}</span>}</div>}

function DetailChrome({fallback}:{fallback:string}){
 const [theme,setTheme]=useState<"dark"|"light">(()=>typeof document!=="undefined"&&document.documentElement.dataset.theme==="light"?"light":"dark");
 const [fontSize,setFontSize]=useState<"default"|"large">(()=>typeof document!=="undefined"&&document.documentElement.dataset.fontSize==="large"?"large":"default");
 const [settingsOpen,setSettingsOpen]=useState(false),settingsRef=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(!settingsOpen)return;const close=(event:PointerEvent)=>{if(!settingsRef.current?.contains(event.target as Node))setSettingsOpen(false)};window.addEventListener("pointerdown",close);return()=>window.removeEventListener("pointerdown",close)},[settingsOpen]);
 const toggle=()=>{const next=theme==="dark"?"light":"dark";setTheme(next);document.documentElement.dataset.theme=next;localStorage.setItem("raw-signal-theme",next)};
 const changeFontSize=(next:"default"|"large")=>{setFontSize(next);document.documentElement.dataset.fontSize=next;localStorage.setItem("raw-signal-font-size",next)};
 return <nav className="topbar detail-topbar"><a className="brand" href="/"><span>R</span> Raw Signal</a><div className="detail-nav-actions"><button type="button" className="detail-back" onClick={()=>history.length>1?history.back():location.assign(fallback)}>← Back to results</button>
  <div className="display-settings" ref={settingsRef}>
   <button type="button" className="settings-toggle" onClick={()=>setSettingsOpen(value=>!value)} aria-label="Display settings" aria-expanded={settingsOpen} aria-haspopup="menu"><span aria-hidden="true">⚙</span></button>
   {settingsOpen&&<div className="settings-menu" role="menu" aria-label="Display settings"><span>Font size</span><div className="font-size-options" role="group" aria-label="Font size"><button type="button" className={fontSize==="default"?"active":""} aria-pressed={fontSize==="default"} onClick={()=>changeFontSize("default")}><b>Aa</b><small>Default</small></button><button type="button" className={fontSize==="large"?"active":""} aria-pressed={fontSize==="large"} onClick={()=>changeFontSize("large")}><b>Aa</b><small>Larger</small></button></div></div>}
  </div>
  <button type="button" className="theme-toggle" onClick={toggle} aria-label={`Switch to ${theme==="dark"?"light":"dark"} mode`}><span aria-hidden="true">{theme==="dark"?"☀":"☾"}</span><b>{theme==="dark"?"Light":"Dark"}</b></button></div></nav>
}

function SourceFacts({detail}:{detail:CatalogDetail}){const source=detail.source,premium=detail.kind==="sealed"&&detail.msrp&&detail.marketPrice!=null?(detail.marketPrice-detail.msrp)/detail.msrp*100:null,rows=[source.setAbbreviation&&["Set abbreviation",source.setAbbreviation],source.publishedOn&&["Set published",source.publishedOn.slice(0,10)],source.modifiedOn&&["Product updated",source.modifiedOn.slice(0,10)],source.imageCount!=null&&["Images available",String(source.imageCount)],source.isPresale!=null&&["Presale",source.isPresale?"Yes":"No"],premium!=null&&["MSRP premium",pct(premium)]].filter(Boolean) as string[][];return rows.length?<dl className="detail-facts">{rows.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>:<p className="detail-unavailable">Additional source metadata is unavailable for this product.</p>}

function PeerLine({label,count,average,current,noun}:{label:string;count:number;average:number|null;current:number|null;noun:string}){
 const delta=average&&current!=null?((current-average)/average)*100:null;
 return <p className="detail-peer-context">Average {label.toLowerCase().endsWith("s")?label:`${label}s`}: <b>{formatUsd(average,"N/A")}</b> across {count.toLocaleString()} others{delta!=null&&<> · this {noun} sits <b className={delta<0?"down":"up"}>{formatPercent(Math.abs(delta)).replace("+","")} {delta<0?"below":"above"}</b> that average</>}.</p>;
}

function PeerContextNote({detail}:{detail:CatalogDetail}){
 const noun=detail.kind==="single"?"card":"product",setPeers=detail.kind==="single"?detail.setPeerContext:null;
 return <>
  {setPeers&&setPeers.count>0&&<PeerLine label={setPeers.label} count={setPeers.count} average={setPeers.averagePrice} current={detail.marketPrice} noun={noun}/>}
  {detail.peerContext&&detail.peerContext.count>0&&<PeerLine label={detail.peerContext.label} count={detail.peerContext.count} average={detail.peerContext.averagePrice} current={detail.marketPrice} noun={noun}/>}
 </>;
}

function SimilarItems({detail}:{detail:CatalogDetail}){return <section className="detail-section"><header><span>Explore the market</span><h2>Similar {detail.kind==="single"?"cards":"products"}</h2></header><PeerContextNote detail={detail}/>{detail.similar.length?<div className="similar-grid">{detail.similar.map(item=><a href={item.href} className="similar-card" key={`${item.kind}:${item.productId}`}><DeferredImage src={item.image} alt=""/><span><b>{item.name}</b><small>{item.set}</small><strong>{formatUsd(item.marketPrice,"N/A")}</strong></span></a>)}</div>:<p className="detail-unavailable">No close comparisons are available.</p>}</section>}

function SealedScenarioPanel({detail}:{detail:SealedDetail}){
 const initial=useMemo(()=>new URLSearchParams(typeof location==="undefined"?"":location.search),[]),[basis,setBasis]=useState<"market"|"median">(initial.get("basis")==="median"?"median":"market"),[keepPct,setKeepPct]=useState(numberParam(initial,"keepPct",100)),[taxOn,setTaxOn]=useState(initial.get("taxOn")==="1"),[taxRate,setTaxRate]=useState(numberParam(initial,"taxRate",8)),[shipping,setShipping]=useState(numberParam(initial,"shipping",0)),[profitableOnly,setProfitableOnly]=useState(false);
 const scenario:SealedScenario={basis,keepPct,taxOn,taxRate,shipping},result=calculateSealedScenario(detail,scenario);
 useEffect(()=>{const url=new URL(location.href);url.searchParams.set("basis",basis);if(keepPct===100)url.searchParams.delete("keepPct");else url.searchParams.set("keepPct",String(keepPct));if(taxOn)url.searchParams.set("taxOn","1");else url.searchParams.delete("taxOn");if(taxRate===8)url.searchParams.delete("taxRate");else url.searchParams.set("taxRate",String(taxRate));if(shipping)url.searchParams.set("shipping",String(shipping));else url.searchParams.delete("shipping");history.replaceState(null,"",url)},[basis,keepPct,taxOn,taxRate,shipping]);
 return <section className="detail-section detail-scenario"><header><span>What-if calculator</span><h2>Sale scenario</h2><div className="price-basis" aria-label="Scenario price basis"><i aria-hidden="true"/><button className={basis==="market"?"active":""} onClick={()=>setBasis("market")}>Market</button><button className={basis==="median"?"active":""} onClick={()=>setBasis("median")}>Median</button></div></header><SaleScenario keepPct={keepPct} onKeepPct={setKeepPct} taxOn={taxOn} onTaxOn={setTaxOn} taxRate={taxRate} onTaxRate={setTaxRate} shipping={shipping} onShipping={setShipping} profitableOnly={profitableOnly} onProfitableOnly={setProfitableOnly}/><div className="detail-scenario-results"><Metric label="Selected value" value={formatUsd(result.value,"N/A")}/><Metric label="Total cost" value={formatUsd(result.cost,"N/A")}/><Metric label="Net proceeds" value={formatUsd(result.proceeds,"N/A")}/><Metric label="Estimated profit" value={result.profit==null?"N/A":`${result.profit>=0?"+":""}${formatUsd(result.profit)}`} tone={result.profit==null?undefined:result.profit<0?"down":"up"}/><Metric label="Return" value={pct(result.profitPct)} tone={result.profitPct==null?undefined:result.profitPct<0?"down":"up"}/></div><p className="detail-note">Scenario inputs are estimates, not predictions. Missing MSRP or market pricing remains N/A.</p></section>
}

function MarkersGrid({history,current}:{history:PriceHistory;current:number|null}){
 const volatility=volatilityRange(history.points,90),trend=trendSlope(history.points,30),drift=momentum(current,history.points,30),drawdown=drawdownFromPeak(current,history.points,90),streak=priceStreak(history.points);
 return <div className="detail-history-grid"><Metric label="Volatility (90D)" value={volatility==null?"N/A":`${volatility.toFixed(1)}%`} hint="10–90th percentile range vs median"/><Metric label="Momentum (30D)" value={pct(drift)} hint="Current price vs 30D average" tone={drift==null?undefined:drift<0?"down":"up"}/><Metric label="Off 90D peak" value={drawdown==null?"N/A":drawdown===0?"At peak":formatPercent(drawdown)} tone={drawdown==null||drawdown===0?undefined:"down"}/><Metric label="Trend (30D)" value={trend==null?"N/A":`${trend>=0?"+":"−"}$${Math.abs(trend).toFixed(Math.abs(trend)<10?2:0)}/wk`} hint="Fitted slope of observations" tone={trend==null?undefined:trend<0?"down":"up"}/><Metric label="Streak" value={streak?`${streak.length} ${streak.direction>0?"rising":"falling"}`:"N/A"} hint="Consecutive observations" tone={streak?streak.direction>0?"up":"down":undefined}/></div>;
}

function SalesGrid({history}:{history:PriceHistory}){
 const sales=history.sales;
 if(!sales)return <p className="detail-unavailable">Sales activity is unavailable for this history source.</p>;
 const recent=salesWindow(sales.buckets,30),perWeek=sales.totalQuantity==null?null:sales.totalQuantity/(sales.windowDays/7);
 return <div className="detail-history-grid"><Metric label="Sold (90D)" value={sales.totalQuantity==null?"N/A":sales.totalQuantity.toLocaleString()} hint={sales.totalTransactions==null?undefined:`${sales.totalTransactions.toLocaleString()} transactions`}/><Metric label="Sales / week" value={perWeek==null?"N/A":perWeek.toFixed(1)} hint="90-day average"/><Metric label="Sold (30D)" value={recent.quantity.toLocaleString()}/><Metric label="Realized range (30D)" value={recent.low!=null&&recent.high!=null?`${formatUsd(recent.low)}–${formatUsd(recent.high)}`:"N/A"} hint={recent.lowWithShipping!=null&&recent.highWithShipping!=null?`Delivered ${formatUsd(recent.lowWithShipping)}–${formatUsd(recent.highWithShipping)}`:"Actual completed sales"}/></div>;
}

function PrintingsTable({detail,printing,onSelect}:{detail:CatalogDetail;printing:string;onSelect:(variant:DetailPriceVariant)=>void}){
 if(detail.priceVariants.length<2)return null;
 const markets=detail.priceVariants.map(item=>item.marketPrice).filter((value):value is number=>value!=null&&value>0),cheapest=markets.length?Math.min(...markets):null;
 return <><h3 className="detail-subhead">All printings</h3><div className="detail-table-scroll"><table className="detail-variants-table"><thead><tr><th scope="col">Printing</th><th scope="col">Market</th><th scope="col">Listing low</th><th scope="col">Direct low</th><th scope="col">Median</th><th scope="col">Listing high</th><th scope="col">Vs cheapest</th></tr></thead><tbody>{detail.priceVariants.map(item=>{const premium=item.marketPrice!=null&&cheapest?((item.marketPrice-cheapest)/cheapest)*100:null,activeRow=item.printing===printing;return <tr key={item.printing} className={activeRow?"active":""}><th scope="row"><button type="button" onClick={()=>onSelect(item)} aria-pressed={activeRow}>{item.printing}</button></th><td>{formatUsd(item.marketPrice,"N/A")}</td><td>{formatUsd(item.lowPrice,"N/A")}</td><td>{formatUsd(item.directLowPrice,"N/A")}</td><td>{formatUsd(item.midPrice,"N/A")}</td><td>{formatUsd(item.highPrice,"N/A")}</td><td>{premium==null?"N/A":premium<0.5?"Cheapest":`+${premium.toFixed(0)}%`}</td></tr>})}</tbody></table></div><p className="detail-note">Selecting a printing switches the chart, metrics, and signal check to that printing&apos;s history.</p></>;
}

function FairValuePanel({history,current,midPrice,kind}:{history:PriceHistory|null;current:number|null;midPrice:number|null;kind:"single"|"sealed"}){
 if(!history||current==null||current<=0)return null;
 const fair=modeledFairValue(history.points,midPrice);
 if(fair==null)return null;
 const premium=((current-fair)/fair)*100,position=Math.max(0,Math.min(100,50+premium));
 const tone=premium>5?"above":premium<-5?"below":"near";
 const trend=history.sales?demandTrend(history.sales.buckets):null;
 const perWeek=history.sales?.totalQuantity!=null?history.sales.totalQuantity/((history.sales.windowDays||90)/7):null;
 const swing=volatilityRange(history.points,90);
 return <section className="detail-section detail-fair-value">
  <header><span>Valuation model</span><h2>Modeled fair value</h2></header>
  <div className="fair-value-row"><strong className="fair-current">{formatUsd(current)}</strong><span className={`fair-chip is-${tone}`}>{tone==="above"?`↑ Premium ${formatPercent(premium)}`:tone==="below"?`↓ Discount ${formatPercent(Math.abs(premium)).replace("+","")}`:"≈ Near fair"}</span></div>
  <p className="fair-model-line">Modeled fair value <b>{formatUsd(fair)}</b></p>
  <p className="fair-headline">Priced {tone==="near"?"near":tone} fair value.</p>
  <div className={`fair-gauge tone-${tone}`} role="img" aria-label={`Price sits ${formatPercent(premium)} versus the modeled fair value`}><i style={{left:`${position}%`}}/></div>
  <div className="fair-gauge-labels"><span>Below fair</span><span>Fair</span><span>Above fair</span></div>
  <div className="fair-chips">{trend&&<span className={trend.label==="rising"?"up":trend.label==="cooling"?"down":""}>Demand {trend.label}</span>}{perWeek!=null&&<span>{perWeek.toFixed(1)}/wk sold</span>}{swing!=null&&<span>{swing<8?"Low":swing<20?"Moderate":"High"} volatility</span>}</div>
  <p className="detail-note">Transparent blend of this {kind==="single"?"printing":"product"}&apos;s 90-day median (50%), 30-day median (30%), and current median listing (20%), renormalized when a component is unavailable. An informational model — not a valuation guarantee or financial advice.</p>
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
  <p className="detail-note">eBay completed sales via PokemonPriceTracker · updated {graded.updatedAt} · smart market is the provider&apos;s filtered, weighted sale price with its stated confidence. Grading population counts are unavailable on the current plan. Marketplace data — not a valuation guarantee.</p>
 </section>;
}

function PullRatesSection({detail}:{detail:SealedDetail}){
 if(!detail.pullRates.length)return null;
 return <section className="detail-section"><header><span>Pack odds</span><h2>Pull rates</h2></header>
  <div className="detail-table-scroll"><table className="detail-variants-table"><thead><tr><th scope="col">Rarity</th><th scope="col">Cards in set</th><th scope="col">Any hit</th><th scope="col">Specific card</th><th scope="col">Cost per hit</th><th scope="col">Avg market</th></tr></thead><tbody>
  {detail.pullRates.map(row=><tr key={row.rarity}><th scope="row">{row.rarity}</th><td>{row.cardCount}</td><td>1 in {row.packsPerHit}</td><td>1 in ~{Math.round(row.packsPerHit*row.cardCount).toLocaleString()}</td><td>{formatUsd(row.costPerHit,"N/A")}</td><td>{formatUsd(row.averageMarket,"N/A")}</td></tr>)}
  </tbody></table></div>
  <p className="detail-note">Community-measured pull-rate estimates{detail.packPrice!=null?` · costs use the ${formatUsd(detail.packPrice)} single-pack market price`:""}. Odds vary by product and print run; treat them as approximations.</p>
 </section>;
}

function DetailSignalBadge({signal}:{signal:MarketSignal}){return <span className={`signal-badge ${signal.side} confidence-${signal.confidence}`} title={signal.detail}><b>{signal.reason}</b><small>{signal.score} signal · {signal.confidence} confidence</small></span>}

function SignalsPanel({history,current,strictness,onStrictness}:{history:PriceHistory|null;current:number|null;strictness:SignalStrictness;onStrictness:(value:SignalStrictness)=>void}){
 return <section className="detail-section"><header><span>Signal check</span><h2>Hot Buy / Hot Sell</h2><div className="detail-strictness"><label className="strictness-control"><span>Signal strictness</span><select value={strictness} onChange={event=>onStrictness(event.target.value as SignalStrictness)}><option value="conservative">Conservative</option><option value="balanced">Balanced</option><option value="aggressive">Aggressive</option></select><small>{strictness==="conservative"?"Strongest signals · tighter cutoff":strictness==="aggressive"?"Earlier signals · wider cutoff":"Useful signals · moderate cutoff"}</small></label></div></header>{history?<div className="detail-signals">{(["buy","sell"] as const).map(side=>{const evaluation=evaluateMarketSignal(history.points,side,strictness,current);return <div key={side} className={`detail-signal-card${evaluation.eligible?` is-${side}`:""}`}><small>{side==="buy"?"Hot Buy":"Hot Sell"}</small>{evaluation.eligible?<><DetailSignalBadge signal={evaluation.signal}/><p>{evaluation.signal.detail}</p></>:<p className="detail-signal-miss"><b>Not qualifying.</b> {evaluation.detail}</p>}</div>})}</div>:<p className="detail-unavailable">Signal evaluation needs price history.</p>}<p className="detail-note">Signals are informational qualification checks against this printing&apos;s history. They are not guarantees or financial advice.</p></section>;
}

export default function ProductDetailPage({detail,market}:{detail:CatalogDetail;market?:string}){
 const [variant,setVariant]=useState(detail.priceVariants.find(item=>item.printing===(detail.kind==="single"?detail.printing:"Sealed"))??detail.priceVariants[0]),[historyResult,setHistoryResult]=useState<{key:string;value:PriceHistory|null;error:boolean}>({key:"",value:null,error:false}),[strictness,setStrictness]=useState<SignalStrictness>("balanced");
 const fallback=detail.kind==="single"?`/?mode=singles&market=${detail.game}`:`/?mode=sealed&market=${market??detail.game}`,current=variant?.marketPrice??detail.marketPrice,printing=variant?.printing??(detail.kind==="single"?detail.printing:"Sealed"),historyKey=`${detail.kind}:${detail.productId}:${printing}`;
 useEffect(()=>{const controller=new AbortController(),params=new URLSearchParams({productId:String(detail.productId),printing});if(detail.kind==="sealed")params.set("sealed","1");fetch(`/api/history?${params}`,{signal:controller.signal}).then(response=>{if(!response.ok)throw new Error();return response.json()}).then(value=>setHistoryResult({key:historyKey,value:value as PriceHistory,error:false})).catch(error=>{if(error.name!=="AbortError")setHistoryResult({key:historyKey,value:null,error:true})});return()=>controller.abort()},[detail.kind,detail.productId,printing,historyKey]);
 const historyData=historyResult.key===historyKey?historyResult.value:null,historyError=historyResult.key===historyKey&&historyResult.error,h=historyData??emptyHistory,depth=historyDepth(historyData),rankPct=detailPercentile(detail),position=rangePosition(current,h.historyLow,h.historyHigh);
 const sourceLabel=detail.source.sourceUpdatedAt?`Source updated ${detail.source.sourceUpdatedAt.slice(0,10)}`:"Current TCGCSV / TCGplayer snapshot";
 return <main className="detail-page"><DetailChrome fallback={fallback}/><article className="detail-content"><a className="detail-breadcrumb" href={fallback}>Market rankings / {detail.game} / {detail.set}</a><section className="detail-hero"><div className="detail-art"><DeferredImage src={detail.image} alt={`${detail.name} ${detail.kind==="single"?"card":"product"}`}/></div><div className="detail-overview"><span className="kicker">{detail.kind==="single"?`${detail.rarity} · ${detail.printing}`:`${detail.category} · sealed product`}</span><h1>{detail.name}</h1><p>{detail.set}{detail.kind==="single"?` · ${detail.number}`:""}</p><div className="detail-primary-price"><small>TCGplayer market</small><strong>{formatUsd(current,"N/A")}</strong>{variant&&<span>{variant.printing}</span>}</div><div className="detail-actions"><a className="tcgplayer-button" href={detail.url} target="_blank" rel="noopener noreferrer">{detail.exactTcgplayerUrl?"View":"Search"} on TCGplayer ↗</a></div><div className="detail-overview-grid"><Metric label="Listing low" value={formatUsd(variant?.lowPrice,"N/A")}/><Metric label="Direct low" value={formatUsd(variant?.directLowPrice,"N/A")}/><Metric label="Median" value={formatUsd(variant?.midPrice,"N/A")}/><Metric label="Listing high" value={formatUsd(variant?.highPrice,"N/A")} hint="May include parked listings"/>{detail.kind==="sealed"&&<Metric label="MSRP" value={formatUsd(detail.msrp,"N/A")} hint={detail.msrpSource??"Unavailable"}/>}<Metric label="Market rank" value={detail.marketRank?`#${detail.marketRank} of ${detail.marketRankTotal}`:"N/A"} hint={rankPct?`Top ${100-rankPct+1}% of peers`:undefined}/>{detail.kind==="single"&&detail.pullRate&&<Metric label="Pull rate" value={`1 in ~${Math.round(detail.pullRate.packsPerCard).toLocaleString()} packs`} hint={detail.pullRate.costPerCard!=null?`≈${formatUsd(detail.pullRate.costPerCard)} in packs · community estimate`:"Community estimate"}/>}</div></div></section>
 <FairValuePanel history={historyData} current={current} midPrice={variant?.midPrice??null} kind={detail.kind}/>
 <section className="detail-section detail-history"><header><span>Market movement</span><h2>Price history</h2>{detail.priceVariants.length>1&&<label className="detail-variant"><span>Printing</span><select value={variant?.printing} onChange={event=>setVariant(detail.priceVariants.find(item=>item.printing===event.target.value) as DetailPriceVariant)}>{detail.priceVariants.map(item=><option key={item.printing}>{item.printing}</option>)}</select></label>}</header>{historyError?<p className="detail-unavailable">Price history is temporarily unavailable.</p>:!historyData?<div className="detail-chart-loading" aria-label="Loading price history"/>:<><PriceChart points={h.points} volumes={h.sales?.buckets} label="market" large/><div className="detail-history-grid"><Metric label="7 day" value={pct(h.change7)} tone={h.change7==null?undefined:h.change7<0?"down":"up"}/><Metric label="30 day" value={pct(h.change30)} tone={h.change30==null?undefined:h.change30<0?"down":"up"}/><Metric label="90 day" value={pct(h.change90)} tone={h.change90==null?undefined:h.change90<0?"down":"up"}/><Metric label="30D low" value={formatUsd(h.low30,"N/A")}/><Metric label="30D high" value={formatUsd(h.high30,"N/A")}/><Metric label="Historic low" value={formatUsd(h.historyLow,"N/A")}/><Metric label="Historic high" value={formatUsd(h.historyHigh,"N/A")}/><Metric label="Above historic low" value={pct(distanceAbove(current,h.historyLow))}/><Metric label="Below historic high" value={pct(distanceBelow(current,h.historyHigh))}/><Metric label="Historic range position" value={position==null?"N/A":`${position.toFixed(0)}%`}/><Metric label="30D range width" value={pct(rangeWidth(h.low30,h.high30))}/><Metric label="Observations" value={String(depth.count)} hint={depth.first&&depth.last?`${formatUtcDate(depth.first,true)} – ${formatUtcDate(depth.last,true)}`:undefined}/></div>
 <h3 className="detail-subhead">Volatility &amp; momentum</h3><MarkersGrid history={h} current={current}/>
 <h3 className="detail-subhead">Sales activity</h3><SalesGrid history={h}/>
 <PrintingsTable detail={detail} printing={printing} onSelect={setVariant}/>
 <p className="detail-note">{h.coverage==="exact"?"Exact":"Fallback"} {h.variant??variant?.printing} · {h.condition??"market"} history. Sales counts are TCGplayer completed sales for this printing and condition, reported in three-day buckets over the trailing 90 days.</p></>}</section>
 <SignalsPanel history={historyData} current={current} strictness={strictness} onStrictness={setStrictness}/>
 {detail.kind==="single"&&<GradedMarketSection graded={detail.graded} current={current}/>}
 {detail.kind==="sealed"&&<SealedScenarioPanel detail={detail}/>}
 {detail.kind==="sealed"&&<PullRatesSection detail={detail}/>}
 {detail.kind==="sealed"&&<ChaseCardsSection cards={detail.chaseCards} packPrice={detail.packPrice} setName={detail.set}/>}
 {detail.kind==="sealed"&&<RelatedSealedSection products={detail.relatedSealed} setName={detail.set} market={market}/>}
 <section className="detail-section"><header><span>Product overview</span><h2>{detail.kind==="single"?"Card details":"Product details"}</h2></header><div className="detail-info-layout"><SourceFacts detail={detail}/>{detail.metadata.length?<dl className="detail-metadata">{detail.metadata.map(field=><div key={`${field.name}:${field.value}`}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl>:<p className="detail-unavailable">No additional category-specific fields were supplied for this product.</p>}</div>{detail.source.presaleNote&&<p className="detail-note">Presale note: {detail.source.presaleNote}</p>}</section><SimilarItems detail={detail}/><section className="detail-provenance"><b>Data notes</b><p>{sourceLabel}. TCGplayer listing highs can be distorted by price parking. Market prices and history are informational and are not guarantees of future value.</p></section></article></main>;
}
