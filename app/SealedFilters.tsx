"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import {StrictnessControl} from "./SignalControls";
import type {SignalStrictness} from "./signal-utils";

type Props={sets:string[];selectedSets:string[];onSets:(sets:string[])=>void;marketMin:string;marketMax:string;onMarketMin:(value:string)=>void;onMarketMax:(value:string)=>void;msrpMin:string;msrpMax:string;onMsrpMin:(value:string)=>void;onMsrpMax:(value:string)=>void;profitMin:string;profitMax:string;onProfitMin:(value:string)=>void;onProfitMax:(value:string)=>void;profitPctMin:string;profitPctMax:string;onProfitPctMin:(value:string)=>void;onProfitPctMax:(value:string)=>void;profitableOnly:boolean;onProfitableOnly:(value:boolean)=>void;strictness?:SignalStrictness;onStrictness?:(value:SignalStrictness)=>void;onReset:()=>void};

export default function SealedFilters(props:Props){
 const {sets,selectedSets,onSets,marketMin,marketMax,onMarketMin,onMarketMax,msrpMin,msrpMax,onMsrpMin,onMsrpMax,profitMin,profitMax,onProfitMin,onProfitMax,profitPctMin,profitPctMax,onProfitPctMin,onProfitPctMax,profitableOnly,onProfitableOnly,strictness,onStrictness,onReset}=props;
 const root=useRef<HTMLDetailsElement>(null),[setQuery,setSetQuery]=useState("");
 const active=selectedSets.length+[marketMin,marketMax,msrpMin,msrpMax,profitMin,profitMax,profitPctMin,profitPctMax].filter(Boolean).length+Number(profitableOnly);
 const visibleSets=useMemo(()=>sets.filter(set=>set.toLowerCase().includes(setQuery.trim().toLowerCase())),[sets,setQuery]);
 const toggleSet=(set:string)=>{const next=selectedSets.includes(set)?selectedSets.filter(value=>value!==set):[...selectedSets,set];onSets(next.length===sets.length?[]:next)};
 useEffect(()=>{const close=(event:PointerEvent|KeyboardEvent)=>{if((event instanceof KeyboardEvent&&event.key==="Escape")||(!(event instanceof KeyboardEvent)&&!root.current?.contains(event.target as Node)))if(root.current)root.current.open=false};document.addEventListener("pointerdown",close);document.addEventListener("keydown",close);return()=>{document.removeEventListener("pointerdown",close);document.removeEventListener("keydown",close)}},[]);
 const range=(title:string,min:string,max:string,onMin:(value:string)=>void,onMax:(value:string)=>void,unit="$",allowNegative=false)=><fieldset className="sealed-range"><legend>{title}</legend><div className="price-range"><label><span>Minimum</span><span><b>{unit}</b><input aria-label={`Minimum ${title.toLowerCase()}`} type="number" min={allowNegative?undefined:"0"} value={min} onChange={event=>onMin(event.target.value)}/></span></label><i>to</i><label><span>Maximum</span><span><b>{unit}</b><input aria-label={`Maximum ${title.toLowerCase()}`} type="number" min={allowNegative?undefined:"0"} value={max} onChange={event=>onMax(event.target.value)}/></span></label></div>{title==="Market value"&&strictness&&onStrictness&&<div className="filter-strictness"><StrictnessControl value={strictness} onChange={onStrictness}/></div>}</fieldset>;
 return <details ref={root} className={`card-filters ${active?"has-filters":""}`}><summary><span aria-hidden="true">⌁</span><b>Filters</b>{active>0&&<em>{active}</em>}<small>{active?"Active filters":"Value, profit & sets"}</small></summary><div className="filter-panel sealed-filter-panel">
  {range("Market value",marketMin,marketMax,onMarketMin,onMarketMax)}
  {range("MSRP",msrpMin,msrpMax,onMsrpMin,onMsrpMax)}
  {range("Profit",profitMin,profitMax,onProfitMin,onProfitMax,"$",true)}
  {range("Profit percentage",profitPctMin,profitPctMax,onProfitPctMin,onProfitPctMax,"%",true)}
  <fieldset className="set-filters sealed-set-filters"><legend>Available sets</legend><div className="set-filter-tools"><label className="set-search"><span aria-hidden="true">⌕</span><input aria-label="Search sealed sets" value={setQuery} onChange={event=>setSetQuery(event.target.value)} placeholder="Search sets…"/></label><button type="button" className={!selectedSets.length?"active":""} onClick={()=>onSets([])}><b>All sets</b><small>{!selectedSets.length?"Selected":"Show every set"}</small></button></div><div className="set-option-grid">{visibleSets.map(set=><label key={set}><input type="checkbox" checked={selectedSets.includes(set)} onChange={()=>toggleSet(set)}/><span>{set}</span></label>)}</div>{!visibleSets.length&&<p className="empty-filter-results">No sets match “{setQuery}”.</p>}</fieldset>
  <fieldset className="sealed-checks"><legend>Profitability</legend><label><input type="checkbox" checked={profitableOnly} onChange={event=>onProfitableOnly(event.target.checked)}/><span>Profitable products only</span></label></fieldset>
  <div className="filter-actions"><span>{active?`${active} filter${active===1?"":"s"} active`:"Showing all products"}</span><button type="button" disabled={!active} onClick={onReset}>Clear all</button></div>
 </div></details>
}
