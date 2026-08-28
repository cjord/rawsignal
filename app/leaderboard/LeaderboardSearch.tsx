"use client";

// The ⌕ search field both leaderboards render first in their controls row. The caller
// resets its own page number in onChange.
export default function LeaderboardSearch({value,onChange,placeholder,className}:{value:string;onChange:(value:string)=>void;placeholder:string;className?:string}){
 return <label className={className}>
  <span>⌕</span>
  <input value={value} onChange={(event)=>onChange(event.target.value)} placeholder={placeholder}/>
 </label>;
}
