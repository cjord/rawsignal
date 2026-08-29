"use client";
import type {CSSProperties} from "react";

export type SlidingTabOption={key:string;label:string};

// The one sliding-tab primitive behind MarketTabs and SignalTabs: a role=tablist whose
// highlight is the CSS slider driven by --selected-index/--view-count, so 3-, 4-, and
// 5-tab layouts all fit without per-count rules.
export default function SlidingTabs({options,selectedKey,onSelect,label,className=""}:{options:readonly SlidingTabOption[];selectedKey:string;onSelect:(key:string)=>void;label:string;className?:string}){
 const selected=options.findIndex(option=>option.key===selectedKey);
 return <div className={`signal-tabs ${className}`.trim()} role="tablist" aria-label={label} style={{"--selected-index":Math.max(0,selected),"--view-count":options.length} as CSSProperties}>
  {/* A value outside the options (e.g. one transitional frame) shows no highlight
      rather than falsely lighting the first tab. */}
  {selected>=0&&<i className="signal-slider" aria-hidden="true"/>}
  {options.map(option=><button key={option.key} type="button" role="tab" aria-selected={selectedKey===option.key} className={selectedKey===option.key?"active":""} onClick={()=>onSelect(option.key)}>{option.label}</button>)}
 </div>;
}
