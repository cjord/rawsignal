"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- detail navigation preserves exact leaderboard URLs */
import {useEffect,useRef,useState} from "react";
import DeferredImage from "./DeferredImage";
import {useArtTilt} from "./hooks/useArtTilt";
import FavoriteStar from "./FavoriteStar";
import InfoHint from "./InfoHint";
import {evRatio,packChaseEv} from "../core/domain/pack-ev";
import {favoriteKey} from "./state/favorites";
import {parseStrictness,STRICTNESS_KEY,usePreference} from "./state/usePreference";
import PriceChart from "./PriceChart";
import TopBar from "./TopBar";
import SiteFooter from "./SiteFooter";
import {NumberedPagination} from "./MarketUI";
import {ChaseCardsSection,RelatedSealedSection} from "./detail-tables";
import {evaluateMarketSignal} from "../core/signal-utils";
import {classifyRegime} from "../core/domain/regime";
import {MARQUEE_CHASE_RARITIES,MARQUEE_BAND,releaseGuidance} from "../core/domain/release";
import {RegimeChip,SignalBadge} from "./SignalControls";
import {detailPercentile} from "../core/domain/detail";
import {ebaySearchUrl,tcgplayerAffiliateUrl} from "../core/domain/marketplace-links";
import {summarizeEbayAskHistory} from "../core/ebay-history";
import {cardImageFallback} from "./data/card-images";
import {demandTrend,drawdownFromPeak,historyDepth,MIN_PEER_OBSERVATIONS,modeledFairValue,momentum,peerAnchorValue,rangePosition,salesWindow,trendSlope,volatilityRange} from "../core/domain/detail-metrics";
import {formatGameName,formatPercent,formatUsd,formatUtcDate} from "../core/domain/formatters";
import type {CatalogDetail,DetailPeerContext,DetailPeerQuartiles,DetailPriceVariant,EbayAskHistory,EbayListingSample,EbayListingSnapshot,GradedCardData,PeerAnchorStats,PriceHistory,SealedDetail,SignalStrictness} from "../core/domain/types";

const emptyHistory:PriceHistory={points:[],coverage:"none",change7:null,change30:null,change90:null,low30:null,high30:null,historyLow:null,historyHigh:null};
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

function SimilarItems({detail}:{detail:CatalogDetail}){return <section className="detail-section"><header><span>Explore the market</span><h2>Similar {detail.kind==="single"?"Cards":"Products"}</h2></header>{detail.similar.length?<div className="similar-grid">{detail.similar.map(item=><a href={item.href} className="similar-card" key={`${item.kind}:${item.productId}`}><DeferredImage src={item.image} alt=""/><span><b>{item.name}</b><small>{item.set}</small><strong>{formatUsd(item.marketPrice,"N/A")}</strong></span></a>)}</div>:<p className="detail-unavailable">No close comparisons are available.</p>}</section>}

// The sale-scenario panel is hidden for now (user decision 2026-08-28); its rework —
// scalper-only, placed above Product Details, with a manual purchase price — is queued
// in docs/todo.md §I.

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
 if(!history&&loading&&current!=null&&current>0)return <section className="detail-section detail-fair-value" aria-busy="true"><header><span>Valuation model</span><h2>Modeled Fair Value</h2></header><div className="detail-skeleton-lines" aria-hidden="true"><span className="detail-skeleton" style={{height:"44px",width:"38%"}}/><span className="detail-skeleton" style={{height:"16px",width:"56%"}}/><span className="detail-skeleton" style={{height:"7px"}}/></div></section>;
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
  <header><span>Valuation model</span><h2>Modeled Fair Value</h2></header>
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

// eBay is deliberately a client-loaded island: the surrounding detail page may remain in the
// edge cache for 36 hours, while listing content has a six-hour hard TTL. The request starts
// only when this section approaches the viewport, so a page view that never reaches it costs
// neither a D1 read nor an eBay call.
const EBAY_DESKTOP_PAGE_SIZE=5;
const EBAY_MOBILE_PAGE_SIZE=3;
const EBAY_MOBILE_QUERY="(max-width: 759px)";

function useEbayPageSize(){
 const [pageSize,setPageSize]=useState(EBAY_DESKTOP_PAGE_SIZE);
 useEffect(()=>{
  const query=window.matchMedia(EBAY_MOBILE_QUERY),sync=()=>setPageSize(query.matches?EBAY_MOBILE_PAGE_SIZE:EBAY_DESKTOP_PAGE_SIZE);
  sync();query.addEventListener("change",sync);return()=>query.removeEventListener("change",sync);
 },[]);
 return pageSize;
}

type EbayResultFilter="all"|"free-shipping"|"best-offer"|"top-rated"|"high-confidence"|"under-market";
type EbayResultSort="delivered"|"price"|"watchers"|"newest";
const ebayDelivered=(sample:EbayListingSample)=>sample.deliveredPrice??(sample.shipping==null?null:Math.round((sample.price+sample.shipping)*100)/100);
const ebayShare=(count:number,total:number)=>total?`${Math.round(count/total*100)}%`:"N/A";
const signedCount=(value:number|null)=>value==null?"N/A":`${value>0?"+":""}${value.toLocaleString()}`;
const listingAge=(sample:EbayListingSample,fetchedAt:string)=>{
 const listed=Date.parse(sample.listedAt??""),fetched=Date.parse(fetchedAt);
 if(!Number.isFinite(listed)||!Number.isFinite(fetched)||listed>fetched)return null;
 const days=Math.floor((fetched-listed)/86_400_000);
 return days===0?"Listed today":`${days.toLocaleString()}d active`;
};

function filterEbaySamples(samples:EbayListingSample[],filter:EbayResultFilter,market:number|null){
 return samples.filter(sample=>{
  if(filter==="free-shipping")return sample.shipping===0;
  if(filter==="best-offer")return (sample.buyingOptions??[]).includes("BEST_OFFER");
  if(filter==="top-rated")return sample.topRated===true;
  if(filter==="high-confidence")return sample.matchConfidence==="high";
  if(filter==="under-market"){const delivered=ebayDelivered(sample);return market!=null&&delivered!=null&&delivered<market}
  return true;
 });
}

function sortEbaySamples(samples:EbayListingSample[],sort:EbayResultSort){
 return [...samples].sort((a,b)=>{
  if(sort==="price")return a.price-b.price;
  if(sort==="watchers")return (b.watchCount??-1)-(a.watchCount??-1);
  if(sort==="newest")return (Date.parse(b.listedAt??"")||0)-(Date.parse(a.listedAt??"")||0);
  return (ebayDelivered(a)??Number.MAX_SAFE_INTEGER)-(ebayDelivered(b)??Number.MAX_SAFE_INTEGER)||a.price-b.price;
 });
}

function EbaySnapshotMetrics({ebay,market,kind}:{ebay:EbayListingSnapshot;market:number|null;kind:CatalogDetail["kind"]}){
 const medianGap=ebay.medianDeliveredAsk!=null&&market!=null&&market>0?(ebay.medianDeliveredAsk-market)/market*100:null;
 return <div className="detail-history-grid detail-ev-grid">
  <Metric label="Lowest delivered ask" value={formatUsd(ebay.lowestDeliveredAsk,"N/A")} hint={ebay.lowestDeliveredAsk==null?"Shipping unavailable or too few matches":"Item plus shown shipping"}/>
  <Metric label="Median delivered ask" value={formatUsd(ebay.medianDeliveredAsk,"N/A")} hint={`${ebay.acceptedCount.toLocaleString()} of ${ebay.reviewedCount.toLocaleString()} returned items matched`}/>
  <Metric label="Ask vs TCGplayer" value={pct(medianGap)} tone={medianGap==null?undefined:medianGap<0?"down":"up"} hint="Median shown total versus current TCGplayer market"/>
  <Metric label="eBay result estimate" value={ebay.listingCount.toLocaleString()} hint={kind==="single"?"Ungraded, fixed-price query":"New, fixed-price query"}/>
  <Metric label="Delivered spread" value={ebay.deliveredQ1!=null&&ebay.deliveredQ3!=null?`${formatUsd(ebay.deliveredQ1)}–${formatUsd(ebay.deliveredQ3)}`:"N/A"} hint="Middle 50% of matched shown totals"/>
  <Metric label="Near TCGplayer" value={ebay.nearMarketCount.toLocaleString()} hint={`Within ±10% · ${ebay.belowMarketCount.toLocaleString()} below market`}/>
  <Metric label="Free shipping" value={ebayShare(ebay.freeShippingCount,ebay.acceptedCount)} hint={`${ebay.freeShippingCount.toLocaleString()} matched listings`}/>
  <Metric label="Best Offer" value={ebayShare(ebay.bestOfferCount,ebay.acceptedCount)} hint={`${ebay.highConfidenceCount.toLocaleString()} high-confidence matches`}/>
 </div>;
}

function EbayHistoryMetrics({history}:{history:EbayAskHistory}){
 const summary=summarizeEbayAskHistory(history.points);
 if(!history.points.length)return null;
 return <><h3 className="detail-subhead">Active ask history</h3><div className="detail-history-grid ebay-history-grid">
  <Metric label="Delivered ask (7D)" value={pct(summary.change7)} tone={summary.change7==null?undefined:summary.change7<0?"down":"up"}/>
  <Metric label="Delivered ask (30D)" value={pct(summary.change30)} tone={summary.change30==null?undefined:summary.change30<0?"down":"up"}/>
  <Metric label="Matched supply (7D)" value={signedCount(summary.supplyChange7)} tone={summary.supplyChange7==null?undefined:summary.supplyChange7<0?"down":"up"}/>
  <Metric label="Since prior refresh" value={summary.newListings==null?"N/A":`+${summary.newListings} / −${summary.missingListings??0}`} hint={summary.priceReductions==null?undefined:`${summary.priceReductions} observed price cuts`}/>
 </div></>;
}

function EbayListingCard({sample,fetchedAt}:{sample:EbayListingSample;fetchedAt:string}){
 const delivered=ebayDelivered(sample),age=listingAge(sample,fetchedAt);
 const details=[sample.condition??"Condition unavailable",sample.sellerFeedbackPercentage!=null?`${sample.sellerFeedbackPercentage.toFixed(1)}% seller`:null,sample.watchCount!=null?`${sample.watchCount} watching`:null,age].filter(Boolean).join(" · ");
 return <a className="ebay-listing-card" href={sample.url} target="_blank" rel="noopener noreferrer sponsored">
  <DeferredImage src={sample.imageUrl} alt="" className="ebay-listing-image"/><span className="ebay-listing-copy"><b>{sample.title}</b><span><strong>{formatUsd(delivered??sample.price)}</strong><small>{delivered==null?`${formatUsd(sample.price)} item · shipping on eBay`:`${formatUsd(sample.price)} item · ${sample.shipping===0?"free shipping":`${formatUsd(sample.shipping)} shipping`}`}</small></span><span className="ebay-listing-badges">{(sample.buyingOptions??[]).includes("BEST_OFFER")&&<i>Best Offer</i>}{sample.topRated&&<i>Top Rated Plus</i>}<i>{sample.matchConfidence==="high"?"High":"Medium"} match</i></span><small>{details}</small></span>
 </a>;
}

function EbayListingResults({ebay,market}:{ebay:EbayListingSnapshot;market:number|null}){
 const grid=useRef<HTMLDivElement>(null),[pagination,setPagination]=useState({key:"",page:1});
 const [controls,setControls]=useState<{key:string;filter:EbayResultFilter;sort:EbayResultSort}>({key:"",filter:"all",sort:"delivered"});
 const pageSize=useEbayPageSize(),snapshotKey=ebay.fetchedAt;
 const active=controls.key===snapshotKey?controls:{key:snapshotKey,filter:"all" as const,sort:"delivered" as const};
 const samples=sortEbaySamples(filterEbaySamples(ebay.samples,active.filter,market),active.sort);
 const pageKey=`${snapshotKey}:${pageSize}:${active.filter}:${active.sort}`,requestedPage=pagination.key===pageKey?pagination.page:1;
 const pages=Math.max(1,Math.ceil(samples.length/pageSize)),page=Math.min(requestedPage,pages),start=(page-1)*pageSize;
 const pageSamples=samples.slice(start,start+pageSize);
 const changePage=(next:number)=>{setPagination({key:pageKey,page:next});requestAnimationFrame(()=>grid.current?.scrollIntoView({block:"start",behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"}))};
 if(!ebay.samples.length)return null;
 return <div className="ebay-results"><div className="ebay-controls">
  <label><span>Filter listings</span><select value={active.filter} onChange={event=>setControls({key:snapshotKey,filter:event.target.value as EbayResultFilter,sort:active.sort})}><option value="all">All matches</option><option value="free-shipping">Free shipping</option><option value="best-offer">Best Offer</option><option value="top-rated">Top Rated Plus</option><option value="high-confidence">High confidence</option>{market!=null&&<option value="under-market">Below TCGplayer</option>}</select></label>
  <label><span>Sort listings</span><select value={active.sort} onChange={event=>setControls({key:snapshotKey,filter:active.filter,sort:event.target.value as EbayResultSort})}><option value="delivered">Lowest shown total</option><option value="price">Lowest item price</option><option value="watchers">Most watched</option><option value="newest">Newest listing</option></select></label>
 </div>{samples.length?<><div ref={grid} className="ebay-grid">{pageSamples.map(sample=><EbayListingCard key={sample.itemId} sample={sample} fetchedAt={ebay.fetchedAt}/>)}</div>{pages>1&&<div className="ebay-results-pagination"><p aria-live="polite">Showing {start+1}–{Math.min(start+pageSize,samples.length)} of {samples.length} filtered listings</p><NumberedPagination page={page} pages={pages} onChange={changePage} label="eBay listing pages"/></div>}</>:<p className="detail-unavailable ebay-filter-empty">No cached listings match this filter.</p>}</div>;
}

function EbayMarketPanel({detail}:{detail:CatalogDetail}){
 const host=useRef<HTMLElement>(null),[reload,setReload]=useState(0);
 const [state,setState]=useState<{phase:"idle"|"loading"|"ready"|"error";snapshot:EbayListingSnapshot|null;history:EbayAskHistory;message:string}>({phase:"idle",snapshot:null,history:{points:[]},message:""});
 const item={kind:detail.kind,name:detail.name,set:detail.set,number:detail.kind==="single"?detail.number:null,game:detail.game,section:detail.kind==="single"?detail.section:null};
 const searchHref=ebaySearchUrl(item),soldHref=ebaySearchUrl(item,{sold:true});
 useEffect(()=>{
  const node=host.current;if(!node)return;
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined,active=true;
  const load=async(attempt=0)=>{if(!active)return;setState(previous=>({...previous,phase:"loading",message:""}));try{
   const response=await fetch(`/api/ebay/listings?productId=${detail.productId}`,{signal:controller.signal,headers:{Accept:"application/json"}});
   if(response.status===202&&attempt<3){timer=setTimeout(()=>void load(attempt+1),1000);return}
   if(!response.ok){setState({phase:"error",snapshot:null,history:{points:[]},message:response.status===429?"The daily eBay refresh budget has been reached.":"Live listings are temporarily unavailable."});return}
   const value=await response.json() as {snapshot?:EbayListingSnapshot;history?:EbayAskHistory};
   setState(value.snapshot?{phase:"ready",snapshot:value.snapshot,history:value.history??{points:[]},message:""}:{phase:"error",snapshot:null,history:{points:[]},message:"No current listings were returned."});
  }catch(error){if(!(error instanceof DOMException&&error.name==="AbortError"))setState({phase:"error",snapshot:null,history:{points:[]},message:"Live listings are temporarily unavailable."})}};
  const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){observer.disconnect();void load()}},{rootMargin:"320px"});
  observer.observe(node);return()=>{active=false;controller.abort();observer.disconnect();if(timer)clearTimeout(timer)};
 },[detail.productId,reload]);
 const ebay=state.snapshot;
 const links=<div className="detail-actions ebay-actions"><a className="tcgplayer-button ebay-button" href={searchHref} target="_blank" rel="noopener noreferrer sponsored">Browse eBay listings ↗</a><a className="tcgplayer-button ebay-button" href={soldHref} target="_blank" rel="noopener noreferrer sponsored">eBay sold listings ↗</a></div>;
 const fetched=ebay?new Date(ebay.fetchedAt).toLocaleString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit",timeZone:"UTC",timeZoneName:"short"}):"";
 return <section ref={host} className="detail-section detail-ebay" aria-busy={state.phase==="loading"||undefined}><header><span>Marketplace</span><h2>eBay Listings</h2></header>
  {state.phase==="loading"&&<div className="ebay-loading" aria-live="polite"><span className="detail-skeleton"/><span>Loading current eBay listings…</span></div>}
  {ebay&&<EbaySnapshotMetrics ebay={ebay} market={detail.marketPrice} kind={detail.kind}/>}
  {ebay&&<EbayHistoryMetrics history={state.history}/>}
  {ebay&&<EbayListingResults ebay={ebay} market={detail.marketPrice}/>}
  {state.phase==="error"&&<p className="detail-unavailable ebay-status" aria-live="polite">{state.message} <button type="button" onClick={()=>setReload(value=>value+1)}>Try again</button></p>}
  {links}
  <p className="detail-note">{ebay?<>eBay active listings via the Browse API · fetched {fetched} · up to 100 results reviewed · daily history is retained when refreshed.</>:<>Listings load only when this section is viewed.</>} Prices are asks, not sales; result totals are estimates, shipping may vary by destination, and a listing no longer observed is not treated as sold. Sold listings may require eBay sign-in. Marketplace data — not a valuation guarantee.</p>
 </section>;
}

const gradeLabel=(key:string)=>{if(key==="ungraded")return "Raw (eBay)";const match=key.match(/^([a-z]+)([\d_]+)$/);return match?`${match[1].toUpperCase()} ${match[2].replace("_",".")}`:key.toUpperCase()};

// PSA bulk-tier submissions run ~$25/card in 2026 — a stated estimate, not a quote.
const GRADING_FEE_ESTIMATE=25;

function GradedMarketSection({graded,current}:{graded:GradedCardData|null;current:number|null}){
 if(!graded)return null;
 const rows=Object.entries(graded.grades).filter(([,stat])=>stat.count>=2).sort((a,b)=>(b[1].smartPrice??b[1].median??0)-(a[1].smartPrice??a[1].median??0)).slice(0,10);
 if(!rows.length)return null;
 // Grading edge (audit Phase F): the raw→PSA 10 spread net of the fee — the number a
 // grading decision actually turns on, shown only when both sides are real.
 const psa10=graded.grades["psa10"]??graded.grades["PSA 10"];
 const psa10Anchor=psa10?(psa10.smartPrice??psa10.median):null;
 const edge=psa10Anchor!=null&&current!=null&&psa10.count>=2?psa10Anchor-current-GRADING_FEE_ESTIMATE:null;
 return <section className="detail-section"><header><span>Graded market</span><h2>Graded Sales</h2></header>
  {edge!=null&&<div className="detail-history-grid detail-ev-grid">
   <div className="detail-metric"><small>Grading edge (PSA 10)</small><b className={edge>0?"up":"down"}>{edge>0?"+":""}{formatUsd(edge)}</b><span>{formatUsd(psa10Anchor)} PSA 10 − {formatUsd(current)} raw − ~{formatUsd(GRADING_FEE_ESTIMATE)} fee</span></div>
   <div className="detail-metric"><small>Verdict</small><b>{edge>50?"Worth grading":edge>0?"Marginal":"Not worth the fee"}</b><span>Gem-rate risk not priced in — a 9 usually is not</span></div>
  </div>}
  <div className="detail-table-scroll"><table className="detail-variants-table"><thead><tr><th scope="col">Grade</th><th scope="col">Sales</th><th scope="col">Median</th><th scope="col">Smart market</th><th scope="col">Trend</th><th scope="col">Vs raw</th></tr></thead><tbody>
  {rows.map(([key,stat])=>{const anchor=stat.smartPrice??stat.median,multiple=anchor!=null&&current?anchor/current:null;return <tr key={key}><th scope="row">{gradeLabel(key)}</th><td>{stat.count.toLocaleString()}</td><td>{formatUsd(stat.median,"N/A")}</td><td>{formatUsd(stat.smartPrice,"N/A")}{stat.confidence&&<small className="grade-confidence">{stat.confidence}</small>}</td><td className={stat.trend??""}>{stat.trend==="up"?"▲ up":stat.trend==="down"?"▼ down":"—"}</td><td>{multiple!=null?`${multiple.toFixed(1)}×`:"N/A"}</td></tr>})}
  </tbody></table></div>
  <p className="detail-note">eBay completed sales via PokemonPriceTracker · updated {graded.updatedAt}. Marketplace data — not a valuation guarantee.<InfoHint label="About smart market prices">Smart market is the provider&apos;s filtered, weighted sale price with its stated confidence. Grading population counts are unavailable on the current plan.</InfoHint></p>
 </section>;
}

function PullRatesSection({detail}:{detail:SealedDetail}){
 if(!detail.pullRates.length)return null;
 // Chase EV per pack (audit Phase C): what one pack's tracked chase slots are worth at
 // current singles prices, against the live single-pack price.
 const ev=packChaseEv(detail.pullRates),ratio=evRatio(ev,detail.packPrice);
 return <section className="detail-section"><header><span>Pack odds</span><h2>Pull Rates</h2></header>
  {ev!=null&&<div className="detail-history-grid detail-ev-grid">
   <div className="detail-metric"><small>Chase EV per pack</small><b>{formatUsd(ev)}</b><span>Tracked chase slots only — bulk excluded</span></div>
   {detail.packPrice!=null&&<div className="detail-metric"><small>Pack price</small><b>{formatUsd(detail.packPrice)}</b><span>Cheapest live single pack</span></div>}
   {ratio!=null&&<div className="detail-metric"><small>EV ratio</small><b className={ratio>=1?"up":"down"}>{ratio.toFixed(2)}×</b><span>{ratio>=1?"Ripping beats buying the singles at these prices":"Buying singles beats ripping at these prices"}</span></div>}
  </div>}
  <div className="detail-table-scroll"><table className="detail-variants-table"><thead><tr><th scope="col">Rarity</th><th scope="col">Cards in set</th><th scope="col">Any hit</th><th scope="col">Specific card</th><th scope="col">Cost per hit</th><th scope="col">Avg market</th></tr></thead><tbody>
  {detail.pullRates.map(row=><tr key={row.rarity}><th scope="row">{row.rarity}</th><td>{row.cardCount}</td><td>1 in {row.packsPerHit}</td><td>1 in ~{Math.round(row.packsPerHit*row.cardCount).toLocaleString()}</td><td>{formatUsd(row.costPerHit,"N/A")}</td><td>{formatUsd(row.averageMarket,"N/A")}</td></tr>)}
  </tbody></table></div>
  <p className="detail-note">Community-measured pull-rate estimates{detail.packPrice!=null?` · costs use the ${formatUsd(detail.packPrice)} single-pack market price`:""}.<InfoHint label="About pull-rate accuracy">Odds vary by product and print run; treat community-measured rates as approximations, not guarantees. Chase EV multiplies each tier&apos;s average tracked price by its hit odds — it excludes bulk commons, so it is a floor on pack value, not the whole story.</InfoHint></p>
 </section>;
}

// Early Value Estimate (todo P7): shown only when the server computed one — i.e. the
// product (single or sealed) is in its launch window or presale. The range starts as
// the settled-price expectation from mature same-era sibling sets and blends toward
// this product's own decay-curve projection as launch prices are discovered
// (eve.ownWeight); chase-class rarities carry the marquee caveat because the cohort
// anchor deliberately excludes set-defining-card premiums.
function EarlyValuePanel({detail,current}:{detail:CatalogDetail;current:number|null}){
 if(!detail.earlyValue)return null;
 const eve=detail.earlyValue,single=detail.kind==="single";
 const rung=single?detail.rarity:detail.category;
 const guidance=releaseGuidance(detail.game,detail.kind,rung);
 const versus=current!=null&&current>0?current>eve.q75?"above":current<eve.q25?"below":"inside":null;
 const cohortShare=Math.round((1-eve.ownWeight)*100);
 const basis=eve.ownWeight<=0?`Anchored entirely on ${eve.members} ${rung} ${single?"cards":"products"} across ${eve.sets} mature ${formatGameName(detail.game)} sets from the same era — no launch trading observed yet.`
  :eve.ownWeight>=1?`Now tracking this ${single?"card":"product"}'s own trading (${eve.observedDays} days observed), projected down the typical ${rung} settling curve; the era cohort seeded the starting range.`
  :`Blends the era-cohort anchor (${cohortShare}%) with this ${single?"card":"product"}'s own trading so far (${eve.observedDays} days observed), projected down the typical ${rung} settling curve. The estimate shifts toward live prices as they are discovered.`;
 return <section className="detail-section"><header><span>New release</span><h2>Early Value Estimate</h2></header>
  <div className="detail-history-grid">
   <Metric label="Expected Settled Range" value={`${formatUsd(eve.q25)}–${formatUsd(eve.q75)}`} hint={`Median ${formatUsd(eve.median)}`} info={basis}/>
   <Metric label="Current vs Range" value={versus?versus==="inside"?"In range":versus==="above"?"Above range":"Below range":"N/A"} tone={versus==="above"?"down":versus==="below"?"up":undefined}/>
  </div>
  <p className="detail-note">{basis}</p>
  {guidance&&<p className="detail-note">{guidance}</p>}
  {single&&MARQUEE_CHASE_RARITIES.has(detail.rarity)&&<p className="detail-note">Set-defining chase cards historically settle {MARQUEE_BAND} their rarity cohort — this range excludes that premium, and top-character chases sit at its high end.</p>}
  <p className="detail-note">Estimates update daily and are not price targets or guarantees; launch-window prices are volatile.</p>
 </section>;
}

function SignalsPanel({history,loading,current,strictness}:{history:PriceHistory|null;loading:boolean;current:number|null;strictness:SignalStrictness}){
 // The boards gate on liquidity; this panel must agree with them (todo P2) — a card with
 // known thin sales should not look qualifying on its own page. Absent sales stay neutral.
 const liquidity=history?.sales?.buckets?{sales7:salesWindow(history.sales.buckets,7).quantity,sales30:salesWindow(history.sales.buckets,30).quantity}:null;
 return <section className="detail-section" aria-busy={loading||undefined}><header><span>Signal check</span><h2>Hot Buy / Hot Sell</h2></header>{history?<div className="detail-signals">{(["buy","sell"] as const).map(side=>{const evaluation=evaluateMarketSignal(history.points,side,strictness,current,{liquidity});return <div key={side} className={`detail-signal-card${evaluation.eligible?` is-${side}`:""}`}><small>{side==="buy"?"Hot Buy":"Hot Sell"}</small>{evaluation.eligible?<><SignalBadge signal={evaluation.signal}/><p>{evaluation.signal.detail}</p></>:<p className="detail-signal-miss"><b>Not qualifying.</b> {evaluation.detail}</p>}</div>})}</div>:loading?<div className="detail-signals" aria-hidden="true"><span className="detail-signal-card detail-skeleton"/><span className="detail-signal-card detail-skeleton"/></div>:<p className="detail-unavailable">Signal evaluation needs price history.</p>}<p className="detail-note">Checked at {strictness} strictness — adjustable in display settings. Signals are informational qualification checks against this printing&apos;s history. They are not guarantees or financial advice.</p></section>;
}

// Price History: regime chip, printing selector, chart, the metric grids, and the printings
// table — one section so the page body stays readable.
function PriceHistorySection({detail,variant,onVariant,historyData,historyError,h,current,printing,depth,position}:{detail:CatalogDetail;variant:DetailPriceVariant|undefined;onVariant:(variant:DetailPriceVariant)=>void;historyData:PriceHistory|null;historyError:boolean;h:PriceHistory;current:number|null;printing:string;depth:ReturnType<typeof historyDepth>;position:number|null}){
 return <section className="detail-section detail-history"><header><span>Market movement</span><h2>Price History</h2>{(()=>{const reading=historyData?classifyRegime(h.points,current,h.sales?demandTrend(h.sales.buckets):null):null;return reading&&<RegimeChip regime={reading.regime} detail={reading.detail}/>})()}{detail.priceVariants.length>1&&<label className="detail-variant"><span>Printing</span><select value={variant?.printing} onChange={event=>onVariant(detail.priceVariants.find(item=>item.printing===event.target.value) as DetailPriceVariant)}>{detail.priceVariants.map(item=><option key={item.printing}>{item.printing}</option>)}</select></label>}</header>{historyError?<p className="detail-unavailable">Price history is temporarily unavailable.</p>:!historyData?<div aria-busy="true"><div className="detail-chart-loading" aria-label="Loading price history"/><div className="detail-history-grid" aria-hidden="true">{Array.from({length:7},(_,index)=><span key={index} className="detail-metric detail-skeleton"/>)}</div></div>:<><PriceChart points={h.points} volumes={h.sales?.buckets} label="market" large/><div className="detail-history-grid"><Metric label="7 day" value={pct(h.change7)} tone={h.change7==null?undefined:h.change7<0?"down":"up"}/><Metric label="30 day" value={pct(h.change30)} tone={h.change30==null?undefined:h.change30<0?"down":"up"}/><Metric label="90 day" value={pct(h.change90)} tone={h.change90==null?undefined:h.change90<0?"down":"up"}/><Metric label="30D range" value={h.low30!=null&&h.high30!=null?`${formatUsd(h.low30)}–${formatUsd(h.high30)}`:"N/A"}/><Metric label="All-time range" value={h.historyLow!=null&&h.historyHigh!=null?`${formatUsd(h.historyLow)}–${formatUsd(h.historyHigh)}`:"N/A"}/><Metric label="Range position" value={position==null?"N/A":`${position.toFixed(0)}%`} info="Where the current price sits within the all-time observed range: 0% is the low, 100% the high." tone={position==null?undefined:position<=35?"up":position>=75?"down":undefined}/><Metric label="Observations" value={String(depth.count)} hint={depth.first&&depth.last?`${formatUtcDate(depth.first,true)} – ${formatUtcDate(depth.last,true)}`:undefined}/></div>
 <h3 className="detail-subhead">Volatility &amp; momentum</h3><MarkersGrid history={h} current={current}/>
 <h3 className="detail-subhead">Sales activity</h3><SalesGrid history={h}/>
 <PrintingsTable detail={detail} printing={printing} onSelect={onVariant}/>
 <p className="detail-note">{h.coverage==="exact"?"Exact":"Fallback"} {h.variant??variant?.printing} · {h.condition??"market"} history. Sales counts are TCGplayer completed sales for this printing and condition, reported in three-day buckets over the trailing 90 days.</p></>}</section>;
}

export default function ProductDetailPage({detail,market,serverTiming}:{detail:CatalogDetail;market?:string;serverTiming?:string|null}){
 const [variant,setVariant]=useState(detail.priceVariants.find(item=>item.printing===(detail.kind==="single"?detail.printing:"Sealed"))??detail.priceVariants[0]),[historyResult,setHistoryResult]=useState<{key:string;value:PriceHistory|null;error:boolean}>({key:"",value:null,error:false});
 const [strictness,changeStrictness]=usePreference<SignalStrictness>(STRICTNESS_KEY,parseStrictness,"balanced");
 const fallback=detail.kind==="single"?`/?mode=singles&market=${detail.game}`:`/?mode=sealed&market=${market??detail.game}`,current=variant?.marketPrice??detail.marketPrice,printing=variant?.printing??(detail.kind==="single"?detail.printing:"Sealed"),historyKey=`${detail.kind}:${detail.productId}:${printing}`;
 useEffect(()=>{const controller=new AbortController(),params=new URLSearchParams({productId:String(detail.productId),printing});if(detail.kind==="sealed")params.set("sealed","1");fetch(`/api/history?${params}`,{signal:controller.signal}).then(response=>{if(!response.ok)throw new Error();return response.json()}).then(value=>setHistoryResult({key:historyKey,value:value as PriceHistory,error:false})).catch(error=>{if(error.name!=="AbortError")setHistoryResult({key:historyKey,value:null,error:true})});return()=>controller.abort()},[detail.kind,detail.productId,printing,historyKey]);
 const historyData=historyResult.key===historyKey?historyResult.value:null,historyError=historyResult.key===historyKey&&historyResult.error,h=historyData??emptyHistory,depth=historyDepth(historyData),rankPct=detailPercentile(detail),position=rangePosition(current,h.historyLow,h.historyHigh);
 const sourceLabel=detail.source.sourceUpdatedAt?`Source updated ${detail.source.sourceUpdatedAt.slice(0,10)}`:"Current TCGCSV / TCGplayer snapshot";
 const marketKey=detail.kind==="single"?detail.game:(market??detail.game);
 const gameHref=detail.kind==="single"?`/?mode=singles&market=${detail.game}&rarity=all`:`/?mode=sealed&market=${marketKey}`;
 const setHref=`${gameHref}&sets=${encodeURIComponent(detail.set)}`;
 // Always return to the exact filtered leaderboard the visitor left, not whatever history entry precedes this card.
 const backToResults=()=>{let saved:string|null=null;try{saved=sessionStorage.getItem("raw-signal-last-list-url")}catch{/* Storage unavailable (private mode); fall back to the default list. */}location.assign(saved??fallback)};
 // Hero-art tilt (the one interactive exception to the flat-hover rule): app/hooks/useArtTilt.ts.
 const [artRef,artHandlers]=useArtTilt();
 return <><main className="detail-page" data-server-timing={serverTiming??undefined}><TopBar className="detail-topbar" active="cards" strictness={strictness} onStrictness={changeStrictness} actions={<button type="button" className="detail-back" onClick={backToResults}>← Back to results</button>}/><article className="detail-content"><nav className="detail-breadcrumb" aria-label="Breadcrumb"><a href="/">Market Rankings</a><span aria-hidden="true">/</span><a href={gameHref}>{formatGameName(marketKey)}</a><span aria-hidden="true">/</span><a href={setHref}>{detail.set}</a></nav><section className="detail-hero"><div ref={artRef} className="detail-art" {...artHandlers}><DeferredImage src={detail.image} fallback={detail.kind==="single"?cardImageFallback({game:detail.game,set:detail.set,number:detail.number}):null} alt={`${detail.name} ${detail.kind==="single"?"card":"product"}`}/></div><div className="detail-overview"><div className="detail-eyebrow"><span className="kicker">{detail.kind==="single"?`${detail.rarity} · ${detail.printing}`:`${detail.category} · Sealed product`}</span><FavoriteStar entry={{key:favoriteKey(detail.kind,detail.productId),kind:detail.kind,game:detail.game,productId:detail.productId,name:detail.name,set:detail.set,number:detail.kind==="single"?detail.number:null,section:detail.kind==="single"?detail.section:null,image:detail.image,price:current??null,addedAt:new Date().toISOString()}}/></div><h1>{detail.name}</h1><p>{detail.set}{detail.kind==="single"?` · ${detail.number}`:""}</p><div className="detail-actions"><a className="tcgplayer-button" href={tcgplayerAffiliateUrl(detail.url)} target="_blank" rel="noopener noreferrer sponsored">{detail.exactTcgplayerUrl?"View":"Search"} on TCGplayer ↗</a><a className="tcgplayer-button pricecharting-button" href={`https://www.pricecharting.com/search-products?type=prices&q=${encodeURIComponent(`${detail.name} ${detail.set}`)}`} target="_blank" rel="noopener noreferrer">PriceCharting ↗</a><a className="tcgplayer-button ebay-button" href={ebaySearchUrl({kind:detail.kind,name:detail.name,set:detail.set,number:detail.kind==="single"?detail.number:null,game:detail.game,section:detail.kind==="single"?detail.section:null})} target="_blank" rel="noopener noreferrer sponsored">eBay ↗</a></div><div className="detail-primary-price"><small>TCGplayer market</small><strong>{formatUsd(current,"N/A")}</strong>{(()=>{const sold30=h.sales?.buckets?.length?salesWindow(h.sales.buckets,30).quantity:null;return sold30==null?null:<span className={sold30<5?"detail-liquidity thin":"detail-liquidity"} title="Completed TCGplayer sales in the trailing 30 days for this printing and condition">{sold30<5?`Thin market · ${sold30} sold/30D`:`${sold30.toLocaleString()} sold/30D`}</span>})()}</div><div className="detail-overview-grid"><Metric label="Listing low" value={formatUsd(variant?.lowPrice,"N/A")}/><Metric label="Median" value={formatUsd(variant?.midPrice,"N/A")}/>{detail.kind==="sealed"&&<Metric label="MSRP" value={formatUsd(detail.msrp,"N/A")} hint={detail.msrpSource??"Unavailable"}/>}{detail.kind==="sealed"&&detail.caseUnit&&<Metric label="Case vs unit" value={`${detail.caseUnit.multiple.toFixed(1)}×`} hint={`${detail.caseUnit.name} at ${formatUsd(detail.caseUnit.marketPrice)}`} info="The case's market price as a multiple of its unit product. Case sizes vary by product, so compare this multiple against the count on the case listing."/>}<Metric label="Market rank" value={detail.marketRank?`#${detail.marketRank} of ${detail.marketRankTotal}`:"N/A"} hint={rankPct?`Top ${100-rankPct+1}% of peers`:undefined}/>{detail.kind==="single"&&detail.pullRate&&<Metric label="Pull rate" value={`1 in ~${Math.round(detail.pullRate.packsPerCard).toLocaleString()} packs`} hint={detail.pullRate.costPerCard!=null?`≈${formatUsd(detail.pullRate.costPerCard)} in packs · community estimate`:"Community estimate"}/>}</div><PeerContextNote detail={detail} cardChange30={h.change30}/></div></section>
 <FairValuePanel history={historyData} loading={!historyData&&!historyError} current={current} midPrice={variant?.midPrice??null} kind={detail.kind} peerAnchor={detail.kind==="single"?detail.peerAnchor:null}/>
 <EbayMarketPanel detail={detail}/>
 <PriceHistorySection detail={detail} variant={variant} onVariant={setVariant} historyData={historyData} historyError={historyError} h={h} current={current} printing={printing} depth={depth} position={position}/>
 <EarlyValuePanel detail={detail} current={current}/>
 <SignalsPanel history={historyData} loading={!historyData&&!historyError} current={current} strictness={strictness}/>
 {detail.kind==="single"&&<GradedMarketSection graded={detail.graded} current={current}/>}
 {detail.kind==="single"&&<RelatedSealedSection products={detail.relatedSealed} setName={detail.set} market={detail.game}/>}
 {detail.kind==="sealed"&&<PullRatesSection detail={detail}/>}
 {detail.kind==="sealed"&&<ChaseCardsSection cards={detail.chaseCards} packPrice={detail.packPrice} setName={detail.set}/>}
 {detail.kind==="sealed"&&<RelatedSealedSection products={detail.relatedSealed} setName={detail.set} market={market}/>}
 <details className="detail-section detail-collapsible"><summary><span>Product overview</span><h2>{detail.kind==="single"?"Card Details":"Product Details"}</h2><i className="detail-collapse-mark" aria-hidden="true">▸</i></summary><div className="detail-info-layout"><SourceFacts detail={detail}/>{detail.metadata.length?<dl className="detail-metadata">{detail.metadata.map(field=><div key={`${field.name}:${field.value}`}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl>:<p className="detail-unavailable">No additional category-specific fields were supplied for this product.</p>}</div>{detail.source.presaleNote&&<p className="detail-note">Presale note: {detail.source.presaleNote}</p>}<p className="detail-note">{sourceLabel}. Market prices and history are informational and are not guarantees of future value.</p></details><SimilarItems detail={detail}/></article></main><SiteFooter/></>;
}
