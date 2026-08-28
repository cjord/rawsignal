"use client";
import PriceChart from "./PriceChart";
import {formatPercent,formatUsd} from "./domain/formatters";
import type {HistoryMetric,PriceHistory,PricePoint} from "./domain/types";

export type {HistoryMetric} from "./domain/types";

export default function HistoryPanel({title,subtitle,points,label="market",metrics,hint,large=false}:{title:string;subtitle:string;points:PricePoint[];label?:string;metrics:HistoryMetric[];hint?:string;large?:boolean}){
 return <span className="history-panel"><div className="history-title"><small>{title}</small><b>{subtitle}</b></div><PriceChart points={points} label={label} large={large}/><div className="history-stats">{metrics.map(metric=><span key={metric.label}><small>{metric.label}</small><b className={metric.tone}>{metric.value}</b></span>)}</div>{hint&&<small className="touch-hint">{hint}</small>}</span>;
}

export const movementTone=(value:number|null|undefined):HistoryMetric["tone"]=>value==null?"neutral":value<0?"down":"up";

// A movement row: "…" while the batch is in flight (undefined), the surface's
// unavailable label once history resolves without the window (null).
export const movementMetric=(label:string,value:number|null|undefined,unavailable="—"):HistoryMetric=>({label,value:value===undefined?"…":formatPercent(value??null,unavailable),tone:movementTone(value)});

// The tile list every card-shaped history popover renders (leaderboard rows, detail
// tables, metrics movers): market + 30D range + historic low + median, then movement.
// Sealed rows keep their own bespoke list (MSRP, basis label, profit) in SealedView.
export const standardHistoryMetrics=(marketPrice:number|null,midPrice:number|null,history:PriceHistory|undefined,unavailable="—"):HistoryMetric[]=>{
 const usd=(value:number|null)=>formatUsd(value,unavailable);
 return [
  {label:"Market",value:usd(marketPrice)},
  {label:"30D low",value:usd(history?.low30??null)},
  {label:"30D high",value:usd(history?.high30??null)},
  {label:"Hist low",value:usd(history?.historyLow??null)},
  {label:"Median",value:usd(midPrice)},
  movementMetric("7 day",history?.change7,unavailable),
  movementMetric("30 day",history?.change30,unavailable),
  movementMetric("90 day",history?.change90,unavailable),
 ];
};
