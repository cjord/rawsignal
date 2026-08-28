"use client";
import {useMemo,useState} from "react";
import useDismissibleDetails from "./filters/useDismissibleDetails";
import {CheckboxGrid,toggleSelection} from "./filters/CheckboxGrid";
import {filterSelectionOptions} from "./filters/selection";

export type MultiOption={key:string;label:string;group?:string};

export default function MultiSelectField({label,options,selected,onChange,allLabel="All",searchable=true}:{label:string;options:MultiOption[];selected:string[];onChange:(values:string[])=>void;allLabel?:string;searchable?:boolean}){
 const root=useDismissibleDetails(),[query,setQuery]=useState(""),allSelected=!selected.length||selected.length===options.length,visible=useMemo(()=>filterSelectionOptions(options,query),[options,query]),summary=allSelected?allLabel:selected.length===1?(options.find(option=>option.key===selected[0])?.label??selected[0]):`${selected.length} selected`,allKeys=options.map(option=>option.key);
 return <details className={`multi-select ${searchable?"is-searchable":"is-compact"}`} ref={root}><summary aria-label={`${label} selector`}><span className="multi-select-label">{label}</span><span className="multi-select-control"><b>{summary}</b><i aria-hidden="true">⌄</i></span></summary><div className="multi-select-panel">{searchable&&<label className="multi-search"><span>⌕</span><input aria-label={`Search ${label.toLowerCase()}`} value={query} onChange={event=>setQuery(event.target.value)} placeholder={`Search ${label.toLowerCase()}…`}/></label>}<button type="button" className={allSelected?"all active":"all"} onClick={()=>onChange([])}><span>{allLabel}</span><small>{allSelected?"Selected":"Show everything"}</small></button><CheckboxGrid className="multi-options" options={visible} selected={selected} onToggle={key=>onChange(toggleSelection(selected,key,allKeys))}/>{!visible.length&&<p>No matches</p>}</div></details>;
}
