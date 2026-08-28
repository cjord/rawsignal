"use client";
import {useMemo,useState} from "react";
import {filterSelectionOptions,toggleSelection} from "./selection";
export {toggleSelection} from "./selection";

export type CheckboxOption={key:string;label:string;className?:string;group?:string};

// Options carrying more than one distinct group render clustered under small market
// headings (the cross-game "all" scope); a single group stays a plain grid.
export function CheckboxGrid({options,selected,onToggle,className="set-option-grid"}:{options:CheckboxOption[];selected:string[];onToggle:(key:string)=>void;className?:string}){
 const grid=(items:CheckboxOption[])=><div className={className}>{items.map(option=><label className={option.className} key={option.key}><input type="checkbox" checked={selected.includes(option.key)} onChange={()=>onToggle(option.key)}/><span>{option.label}</span></label>)}</div>;
 const groups=[...new Set(options.map(option=>option.group).filter((value):value is string=>Boolean(value)))];
 if(groups.length<2)return grid(options);
 return <>{groups.map(group=><div key={group}><small className="option-group-label">{group}</small>{grid(options.filter(option=>option.group===group))}</div>)}{options.some(option=>!option.group)&&grid(options.filter(option=>!option.group))}</>;
}

export function SearchableCheckboxGrid({legend,options,selected,onChange,searchLabel,allLabel="All sets",emptyNoun="sets",className="set-filters"}:{legend:string;options:CheckboxOption[];selected:string[];onChange:(values:string[])=>void;searchLabel:string;allLabel?:string;emptyNoun?:string;className?:string}){
 const [query,setQuery]=useState(""),allKeys=options.map(option=>option.key),visible=useMemo(()=>filterSelectionOptions(options,query),[options,query]);
 return <fieldset className={className}><legend>{legend}</legend><div className="set-filter-tools"><label className="set-search"><span aria-hidden="true">⌕</span><input aria-label={searchLabel} value={query} onChange={event=>setQuery(event.target.value)} placeholder={`Search ${emptyNoun}…`}/></label><button type="button" className={!selected.length?"active":""} onClick={()=>onChange([])}><b>{allLabel}</b><small>{!selected.length?"Selected":"Show every set"}</small></button></div><CheckboxGrid options={visible} selected={selected} onToggle={key=>onChange(toggleSelection(selected,key,allKeys))}/>{!visible.length&&<p className="empty-filter-results">No {emptyNoun} match “{query}”.</p>}</fieldset>;
}
