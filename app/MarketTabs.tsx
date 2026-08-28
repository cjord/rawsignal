"use client";
import type {CSSProperties} from "react";

export type MarketTabOption={key:string;label:string};

// The market scope wears the signal-tab slider everywhere (leaderboards, sealed, metrics).
// The slider CSS reads --view-count, so 3-, 4-, and 5-tab layouts all fit.
export default function MarketTabs({options,value,onChange,label="Market scope",className=""}:{options:readonly MarketTabOption[];value:string;onChange:(key:string)=>void;label?:string;className?:string}){
 const selected=Math.max(0,options.findIndex(option=>option.key===value));
 return <div className={`signal-tabs market-tabs ${className}`.trim()} role="tablist" aria-label={label} style={{"--selected-index":selected,"--view-count":options.length} as CSSProperties}>
  <i className="signal-slider" aria-hidden="true"/>
  {options.map(option=><button key={option.key} type="button" role="tab" aria-selected={value===option.key} className={value===option.key?"active":""} onClick={()=>onChange(option.key)}>{option.label}</button>)}
 </div>;
}
