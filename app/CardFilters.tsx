"use client";
import {useEffect,useMemo,useRef,useState} from "react";

export type MovementFilters={up7:boolean;down7:boolean;up30:boolean;down30:boolean};
type Props={sets:string[];selectedSets:string[];onSets:(sets:string[])=>void;minPrice:string;maxPrice:string;onMinPrice:(value:string)=>void;onMaxPrice:(value:string)=>void;movement:MovementFilters;onMovement:(value:MovementFilters)=>void;onReset:()=>void};

export default function CardFilters({sets,selectedSets,onSets,minPrice,maxPrice,onMinPrice,onMaxPrice,movement,onMovement,onReset}:Props){
 const root=useRef<HTMLDetailsElement>(null),[setQuery,setSetQuery]=useState("");
 const visibleSets=useMemo(()=>sets.filter(set=>set.toLowerCase().includes(setQuery.trim().toLowerCase())),[sets,setQuery]);
 const toggleSet=(set:string)=>onSets(selectedSets.includes(set)?selectedSets.filter(value=>value!==set):[...selectedSets,set]);
 const toggleMovement=(key:keyof MovementFilters)=>onMovement({...movement,[key]:!movement[key]});
 const active=selectedSets.length+Number(Boolean(minPrice))+Number(Boolean(maxPrice))+Object.values(movement).filter(Boolean).length;
 useEffect(()=>{const close=(event:PointerEvent|KeyboardEvent)=>{const shouldClose=event instanceof KeyboardEvent?event.key==="Escape":!root.current?.contains(event.target as Node);if(shouldClose&&root.current)root.current.open=false};document.addEventListener("pointerdown",close);document.addEventListener("keydown",close);return()=>{document.removeEventListener("pointerdown",close);document.removeEventListener("keydown",close)}},[]);
 return <details ref={root} className={`card-filters ${active?"has-filters":""}`}><summary><span aria-hidden="true">⌁</span><b>Filters</b>{active>0&&<em>{active}</em>}<small>{active?"Active filters":"Price, sets & movement"}</small></summary><div className="filter-panel">
  <fieldset><legend>Market price</legend><div className="price-range"><label><span>Minimum</span><span><b>$</b><input aria-label="Minimum market price" inputMode="decimal" type="number" min="0" value={minPrice} onChange={event=>onMinPrice(event.target.value)}/></span></label><i>to</i><label><span>Maximum</span><span><b>$</b><input aria-label="Maximum market price" inputMode="decimal" type="number" min="0" value={maxPrice} onChange={event=>onMaxPrice(event.target.value)}/></span></label></div></fieldset>
  <fieldset><legend>Price movement</legend><div className="movement-filters">{([['up7','7D increases','up'],['down7','7D decreases','down'],['up30','30D increases','up'],['down30','30D decreases','down']] as const).map(([key,label,tone])=><label className={tone} key={key}><input type="checkbox" checked={movement[key]} onChange={()=>toggleMovement(key)}/><span>{label}</span></label>)}</div></fieldset>
  <fieldset className="set-filters"><legend>Available sets</legend><div className="set-filter-tools"><label className="set-search"><span aria-hidden="true">⌕</span><input aria-label="Search card sets" value={setQuery} onChange={event=>setSetQuery(event.target.value)} placeholder="Search sets…"/></label><button type="button" className={!selectedSets.length?"active":""} onClick={()=>onSets([])}><b>All sets</b><small>{!selectedSets.length?"Selected":"Show every set"}</small></button></div><div className="set-option-grid">{visibleSets.map(set=><label key={set}><input type="checkbox" checked={selectedSets.includes(set)} onChange={()=>toggleSet(set)}/><span>{set}</span></label>)}</div>{!visibleSets.length&&<p className="empty-filter-results">No sets match “{setQuery}”.</p>}</fieldset>
  <div className="filter-actions"><span>{active?`${active} filter${active===1?"":"s"} active`:"Showing all cards"}</span><button type="button" disabled={!active} onClick={onReset}>Clear all</button></div>
 </div></details>
}
