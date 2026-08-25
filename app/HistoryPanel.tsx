"use client";
import PriceChart from "./PriceChart";
import type {HistoryMetric,PricePoint} from "./domain/types";

export type {HistoryMetric} from "./domain/types";

export default function HistoryPanel({title,subtitle,points,label="market",metrics,hint,large=false}:{title:string;subtitle:string;points:PricePoint[];label?:string;metrics:HistoryMetric[];hint?:string;large?:boolean}){
 return <span className="history-panel"><div className="history-title"><small>{title}</small><b>{subtitle}</b></div><PriceChart points={points} label={label} large={large}/><div className="history-stats">{metrics.map(metric=><span key={metric.label}><small>{metric.label}</small><b className={metric.tone}>{metric.value}</b></span>)}</div>{hint&&<small className="touch-hint">{hint}</small>}</span>;
}

export const movementTone=(value:number|null|undefined):HistoryMetric["tone"]=>value==null?"neutral":value<0?"down":"up";
