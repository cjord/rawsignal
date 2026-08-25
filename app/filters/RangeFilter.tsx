"use client";

export default function RangeFilter({title,min,max,onMin,onMax,unit="$",allowNegative=false,className=""}:{title:string;min:string;max:string;onMin:(value:string)=>void;onMax:(value:string)=>void;unit?:string;allowNegative?:boolean;className?:string}){
 return <fieldset className={`${className} ${min||max?"has-value":""}`.trim()}><legend>{title}</legend><div className="price-range"><label><span>Minimum</span><span><b>{unit}</b><input aria-label={`Minimum ${title.toLowerCase()}`} inputMode="decimal" type="number" min={allowNegative?undefined:"0"} value={min} onChange={event=>onMin(event.target.value)}/></span></label><i>to</i><label><span>Maximum</span><span><b>{unit}</b><input aria-label={`Maximum ${title.toLowerCase()}`} inputMode="decimal" type="number" min={allowNegative?undefined:"0"} value={max} onChange={event=>onMax(event.target.value)}/></span></label></div></fieldset>;
}
