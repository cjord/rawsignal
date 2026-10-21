"use client";
import SlidingTabs from "./SlidingTabs";

export type MarketTabOption={key:string;label:string};

// The market scope wears the signal-tab slider everywhere (leaderboards, sealed, metrics).
export default function MarketTabs({options,value,onChange,label="Market scope",className="",ready=true,disabled=false}:{options:readonly MarketTabOption[];value:string;onChange:(key:string)=>void;label?:string;className?:string;ready?:boolean;disabled?:boolean}){
 return <SlidingTabs options={options} selectedKey={ready?value:''} disabled={!ready||disabled} onSelect={onChange} label={label} className={`market-tabs ${className}`.trim()}/>;
}
