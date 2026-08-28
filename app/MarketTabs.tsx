"use client";
import SlidingTabs from "./SlidingTabs";

export type MarketTabOption={key:string;label:string};

// The market scope wears the signal-tab slider everywhere (leaderboards, sealed, metrics).
export default function MarketTabs({options,value,onChange,label="Market scope",className=""}:{options:readonly MarketTabOption[];value:string;onChange:(key:string)=>void;label?:string;className?:string}){
 return <SlidingTabs options={options} selectedKey={value} onSelect={onChange} label={label} className={`market-tabs ${className}`.trim()}/>;
}
