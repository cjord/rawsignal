"use client";

const PER_PAGE_OPTIONS=[20,30,40,50];

// The per-page control both leaderboards render beside their pagination. The caller
// resets its own page number in onChange.
export default function PerPageSelect({label,value,onChange}:{label:string;value:number;onChange:(next:number)=>void}){
 return <label className="per-page-control">
  <span>Per page</span>
  <select aria-label={label} value={value} onChange={(event)=>onChange(Number(event.target.value))}>
   {PER_PAGE_OPTIONS.map(option=><option key={option}>{option}</option>)}
  </select>
 </label>;
}
