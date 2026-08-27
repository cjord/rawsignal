"use client";
import {useEffect,useMemo,useState} from "react";
import HistoryPanel,{movementTone,type HistoryMetric} from "./HistoryPanel";
import {NumberedPagination,SegmentedView} from "./MarketUI";
import HistoryPopover from "./leaderboard/HistoryPopover";
import MarketRow from "./leaderboard/MarketRow";
import ProductIdentity from "./leaderboard/ProductIdentity";
import {historyTargetKey,loadPriceHistoryBatch,type HistoryTarget} from "./data/usePriceHistoryBatch";
import {formatPercent,formatRarity,formatUsd} from "./domain/formatters";
import type {Card,PriceHistory,SealedProduct} from "./domain/types";

type TableView="medium"|"text";
const tableViews:[{key:TableView;label:string;icon:string},{key:TableView;label:string;icon:string}]=[{key:"medium",label:"Medium",icon:"▤"},{key:"text",label:"Text",icon:"☷"}];
const usd=(value:number|null)=>formatUsd(value);
const pct=(value:number|null)=>formatPercent(value);

function useDetailHistory(targets:HistoryTarget[]){
 const [history,setHistory]=useState<Record<string,PriceHistory>>({});
 const key=targets.map(historyTargetKey).join(",");
 useEffect(()=>{
  if(!targets.length)return;
  const controller=new AbortController();
  loadPriceHistoryBatch(targets,controller.signal)
   .then(entries=>setHistory(current=>{const next={...current};for(const entry of entries)next[historyTargetKey(entry.target)]=entry.history;return next}))
   .catch(()=>{});
  return()=>controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- targets identity is captured by the serialized key
 },[key]);
 return history;
}

function historyMetrics(marketPrice:number|null,history?:PriceHistory):HistoryMetric[]{
 const movement=(label:string,value:number|null|undefined):HistoryMetric=>({label,value:value===undefined?"…":pct(value??null),tone:movementTone(value)});
 return [
  {label:"Market",value:usd(marketPrice)},
  {label:"30D low",value:usd(history?.low30??null)},
  {label:"30D high",value:usd(history?.high30??null)},
  {label:"Hist low",value:usd(history?.historyLow??null)},
  movement("7 day",history?.change7),
  movement("30 day",history?.change30),
  movement("90 day",history?.change90),
 ];
}

function TableHead({view,itemLabel}:{view:TableView;itemLabel:string}){
 return <div className={`table-head ${view}`} role="row"><span role="columnheader">Rank</span><span role="columnheader">{itemLabel}</span><span role="columnheader">Set</span><span role="columnheader">Market</span><span role="columnheader">30D Low</span><span role="columnheader">30D High</span><span role="columnheader">7D</span><span role="columnheader">30D</span><span aria-hidden="true"/></div>;
}

function RowCells({set,setNote,market,mid,history}:{set:string;setNote:string|null;market:number|null;mid:number|null;history?:PriceHistory}){
 return <><span className="set-name">{set}{setNote&&<small>{setNote}</small>}</span><span className="market-price">{usd(market)}<small>Mid {usd(mid)}</small></span><span className="low">{history?usd(history.low30):"…"}</span><span className="high">{history?usd(history.high30):"…"}</span><span className={`change change7 ${history?.change7!=null&&history.change7<0?"down":"up"}`}>{history?pct(history.change7):"…"}</span><span className={`change change30 ${history?.change30!=null&&history.change30<0?"down":"up"}`}>{history?pct(history.change30):"…"}</span></>;
}

export function ChaseCardsSection({cards,packPrice,setName}:{cards:Card[];packPrice:number|null;setName:string}){
 const [view,setView]=useState<TableView>("medium");
 const targets=useMemo(()=>cards.map(card=>({productId:card.productId,printing:card.printing})),[cards]);
 const history=useDetailHistory(targets);
 if(!cards.length)return null;
 return <section className="detail-section detail-market-table">
  <header><span>From this set</span><h2>Chase cards</h2><SegmentedView className="detail-table-views" value={view} onChange={setView} options={tableViews} label="Chase card view"/></header>
  <p className="detail-note detail-table-note">{packPrice!=null?`Cards from ${setName} with a market price above the ${formatUsd(packPrice)} single-pack price.`:`The most valuable tracked cards from ${setName}.`}</p>
  <TableHead view={view} itemLabel="Card"/>
  <div className={`rows view-${view}`} role="rowgroup">{cards.map((card,index)=>{
   const cardHistory=history[historyTargetKey({productId:card.productId,printing:card.printing})];
   const multiple=packPrice!=null&&packPrice>0?Math.round(card.marketPrice/packPrice):null;
   return <MarketRow className="leader-row" key={card.productId} href={`/cards/${card.productId}`} label={`View ${card.name} details`}
    popover={<HistoryPopover className="hover-card" identityClassName="hover-card-art" image={card.image} alt={`${card.name} card`} label={`${card.name} price history`}><HistoryPanel title="Near Mint market history" subtitle={cardHistory?.variant??card.printing} points={cardHistory?.points??[]} metrics={historyMetrics(card.marketPrice,cardHistory)}/></HistoryPopover>}>
    <span className="position">{String(index+1).padStart(2,"0")}</span>
    <ProductIdentity className="identity" image={card.image} alt="" title={card.name} meta={`${card.number} · ${formatRarity(card.rarity)} · ${card.printing}${multiple!=null&&multiple>1?` · ≈${multiple}× pack`:""}`}/>
    <RowCells set={card.set} setNote={String(card.year)} market={card.marketPrice} mid={card.midPrice} history={cardHistory}/>
   </MarketRow>;
  })}</div>
 </section>;
}

export function RelatedSealedSection({products,setName,market}:{products:SealedProduct[];setName:string;market?:string}){
 const [view,setView]=useState<TableView>("medium"),[page,setPage]=useState(1),perPage=10;
 const targets=useMemo(()=>products.map(product=>({productId:product.productId,printing:"Sealed",sealed:true})),[products]);
 const history=useDetailHistory(targets);
 if(!products.length)return null;
 const pages=Math.max(1,Math.ceil(products.length/perPage)),visible=products.slice((page-1)*perPage,page*perPage);
 return <section className="detail-section detail-market-table">
  <header><span>From this set</span><h2>More sealed from {setName}</h2><SegmentedView className="detail-table-views" value={view} onChange={setView} options={tableViews} label="Related sealed view"/></header>
  <TableHead view={view} itemLabel="Product"/>
  <div className={`rows view-${view}`} role="rowgroup">{visible.map((product,index)=>{
   const productHistory=history[historyTargetKey({productId:product.productId,printing:"Sealed",sealed:true})];
   return <MarketRow className="leader-row" key={product.productId} href={`/sealed/${product.productId}${market?`?market=${market}`:""}`} label={`View ${product.name} details`}
    popover={<HistoryPopover className="hover-card" identityClassName="hover-card-art" image={product.image} alt={`${product.name} product`} label={`${product.name} price history`}><HistoryPanel title="Sealed market history" subtitle="Unopened" points={productHistory?.points??[]} metrics={historyMetrics(product.marketPrice,productHistory)}/></HistoryPopover>}>
    <span className="position">{String((page-1)*perPage+index+1).padStart(2,"0")}</span>
    <ProductIdentity className="identity" image={product.image} alt="" title={product.name} meta={product.category}/>
    <RowCells set={product.set} setNote={product.msrp!=null?`MSRP ${usd(product.msrp)}`:null} market={product.marketPrice} mid={product.midPrice} history={productHistory}/>
   </MarketRow>;
  })}</div>
  {pages>1&&<NumberedPagination page={page} pages={pages} onChange={setPage} label={`${setName} sealed pages`}/>}
 </section>;
}
