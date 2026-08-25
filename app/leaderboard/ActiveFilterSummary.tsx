"use client";
import type {ActiveFilterItem} from "./types";

export default function ActiveFilterSummary({items,matches,label,signalLabel,onRemove}:{items:ActiveFilterItem[];matches:number;label:string;signalLabel?:string;onRemove?:()=>void}){
 const populated=items.length>0||Boolean(signalLabel);
 return <div className={`leader-filter-summary ${populated?"has-content":""}`} aria-label={label} aria-hidden={!populated}><b>{matches.toLocaleString()} Matches</b>{signalLabel&&<span className="summary-signal">{signalLabel}</span>}{items.map(item=><button type="button" key={item.key} title={`Remove ${item.label} filter`} aria-label={`Remove ${item.label} filter`} onClick={()=>{item.clear();onRemove?.()}}>{item.label}<i aria-hidden="true">×</i></button>)}</div>;
}
