"use client";
import {useEffect,useMemo,useState} from "react";
import HistoryPanel,{standardHistoryMetrics} from "./HistoryPanel";
import {NumberedPagination,SegmentedView} from "./MarketUI";
import HistoryPopover from "./leaderboard/HistoryPopover";
import MarketRow from "./leaderboard/MarketRow";
import ProductIdentity from "./leaderboard/ProductIdentity";
import FavoriteStar from "./FavoriteStar";
import {usePriceHistoryBatch,type HistoryTarget} from "./data/usePriceHistoryBatch";
import {historyFromMetrics} from "./leaderboard/mode-adapter";
import {formatPercent,formatRarity,formatUsd} from "../core/domain/formatters";
import {cardFavorite,sealedFavorite} from "./state/favorites";
import type {Card,PriceHistory,SealedProduct} from "../core/domain/types";

type TableView="medium"|"text";
const tableViews:[{key:TableView;label:string;icon:string},{key:TableView;label:string;icon:string}]=[{key:"medium",label:"Medium",icon:"▤"},{key:"text",label:"Text",icon:"☷"}];
const usd=(value:number|null)=>formatUsd(value);
const pct=(value:number|null)=>formatPercent(value);
const historyMetrics=standardHistoryMetrics;
// A row with no current price has no metrics row and nothing worth a request: its columns read
// as unavailable at once (the sealed leaderboard applies the same priced-only rule).
const noHistory:PriceHistory={points:[],coverage:"none",change7:null,change30:null,change90:null,low30:null,high30:null,historyLow:null,historyHigh:null};
const priced=(product:SealedProduct)=>product.marketPrice!=null||product.midPrice!=null;

// Rows render their change/range columns from the `metrics` the D1 detail payload carries;
// a series is requested only for rows without metrics (on mount) and for a row's chart on
// its first popover reveal (wave 14) — a visitor with hover previews off never loads one.
function useTableHistory(missing:HistoryTarget[]){
 const {history,ensure}=usePriceHistoryBatch();
 useEffect(()=>{if(missing.length)void ensure(missing)},[missing,ensure]);
 return {history,ensure};
}

function TableHead({view,itemLabel}:{view:TableView;itemLabel:string}){
 return <div className={`table-head ${view}`} role="row"><span role="columnheader">Rank</span><span role="columnheader">{itemLabel}</span><span role="columnheader">Set</span><span role="columnheader">Market</span><span role="columnheader">30D Low</span><span role="columnheader">30D High</span><span role="columnheader">7D</span><span role="columnheader">30D</span></div>;
}

function RowCells({set,setNote,market,history}:{set:string;setNote:string|null;market:number|null;history?:PriceHistory}){
 return <><span className="set-name">{set}{setNote&&<small>{setNote}</small>}</span><span className="market-price">{usd(market)}</span><span className="low">{history?usd(history.low30):"…"}</span><span className="high">{history?usd(history.high30):"…"}</span><span className={`change change7 ${history?.change7!=null&&history.change7<0?"down":"up"}`}>{history?pct(history.change7):"…"}</span><span className={`change change30 ${history?.change30!=null&&history.change30<0?"down":"up"}`}>{history?pct(history.change30):"…"}</span></>;
}

export function ChaseCardsSection({cards,packPrice,setName}:{cards:Card[];packPrice:number|null;setName:string}){
 const [view,setView]=useState<TableView>("medium");
 const missing=useMemo(()=>cards.filter(card=>!card.metrics).map(card=>({productId:card.productId,printing:card.printing})),[cards]);
 const {history,ensure}=useTableHistory(missing);
 if(!cards.length)return null;
 return <section className="detail-section detail-market-table">
  <header><span>From this set</span><h2>Chase Cards</h2><SegmentedView className="detail-table-views" value={view} onChange={setView} options={tableViews} label="Chase card view"/></header>
  <p className="detail-note detail-table-note">{packPrice!=null?`Cards from ${setName} with a market price above the ${formatUsd(packPrice)} single-pack price.`:`The most valuable tracked cards from ${setName}.`}</p>
  <TableHead view={view} itemLabel="Card"/>
  <div className={`rows view-${view}`} role="rowgroup">{cards.map((card,index)=>{
   const loaded=history[card.productId],cardHistory=loaded??historyFromMetrics(card);
   const multiple=packPrice!=null&&packPrice>0?Math.round(card.marketPrice/packPrice):null;
   return <MarketRow className="leader-row" key={card.productId} href={`/cards/${card.productId}`} label={`View ${card.name} details`} onReveal={()=>void ensure([{productId:card.productId,printing:card.printing}])}
    popover={<HistoryPopover className="hover-card" identityClassName="hover-card-art" image={card.image} alt={`${card.name} card`} label={`${card.name} price history`}><HistoryPanel title="Near Mint Market History" subtitle={loaded?.variant??card.printing} points={loaded?.points??[]} metrics={historyMetrics(card.marketPrice,card.midPrice,cardHistory)} loading={!loaded}/></HistoryPopover>}>
    <span className="position">{String(index+1).padStart(2,"0")}</span>
    <ProductIdentity className="identity" image={card.image} alt="" title={card.name} meta={`${card.number} · ${formatRarity(card.rarity)} · ${card.printing}${multiple!=null&&multiple>1?` · ≈${multiple}× pack`:""}`}/>
    <RowCells set={card.set} setNote={String(card.year)} market={card.marketPrice} history={cardHistory}/>
    <span className="row-star"><FavoriteStar entry={cardFavorite(card)}/></span>
   </MarketRow>;
  })}</div>
 </section>;
}

export function RelatedSealedSection({products,setName,market}:{products:SealedProduct[];setName:string;market?:string}){
 const [view,setView]=useState<TableView>("medium"),[page,setPage]=useState(1),perPage=10;
 const missing=useMemo(()=>products.filter(product=>!product.metrics&&priced(product)).map(product=>({productId:product.productId,printing:"Sealed",sealed:true})),[products]);
 const {history,ensure}=useTableHistory(missing);
 if(!products.length)return null;
 const pages=Math.max(1,Math.ceil(products.length/perPage)),visible=products.slice((page-1)*perPage,page*perPage);
 return <section className="detail-section detail-market-table">
  <header><span>From this set</span><h2>More Sealed from {setName}</h2><SegmentedView className="detail-table-views" value={view} onChange={setView} options={tableViews} label="Related sealed view"/></header>
  <TableHead view={view} itemLabel="Product"/>
  <div className={`rows view-${view}`} role="rowgroup">{visible.map((product,index)=>{
   const loaded=history[product.productId],productHistory=loaded??historyFromMetrics(product)??(priced(product)?undefined:noHistory);
   return <MarketRow className="leader-row" key={product.productId} href={`/sealed/${product.productId}${market?`?market=${market}`:""}`} label={`View ${product.name} details`} onReveal={()=>void ensure([{productId:product.productId,printing:"Sealed",sealed:true}])}
    popover={<HistoryPopover className="hover-card" identityClassName="hover-card-art" image={product.image} alt={`${product.name} product`} label={`${product.name} price history`}><HistoryPanel title="Sealed Market History" subtitle="Unopened" points={loaded?.points??[]} metrics={historyMetrics(product.marketPrice,product.midPrice,productHistory)} loading={!loaded}/></HistoryPopover>}>
    <span className="position">{String((page-1)*perPage+index+1).padStart(2,"0")}</span>
    <ProductIdentity className="identity" image={product.image} alt="" title={product.name} meta={product.category}/>
    <RowCells set={product.set} setNote={product.msrp!=null?`MSRP ${usd(product.msrp)}`:null} market={product.marketPrice} history={productHistory}/>
    <span className="row-star"><FavoriteStar entry={sealedFavorite(product)}/></span>
   </MarketRow>;
  })}</div>
  {pages>1&&<NumberedPagination page={page} pages={pages} onChange={setPage} label={`${setName} sealed pages`}/>}
 </section>;
}
