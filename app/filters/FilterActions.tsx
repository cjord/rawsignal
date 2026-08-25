"use client";

export default function FilterActions({active,noun,onReset}:{active:number;noun:string;onReset:()=>void}){
 return <div className="filter-actions"><span>{active?`${active} filter${active===1?"":"s"} active`:`Showing all ${noun}`}</span><button type="button" disabled={!active} onClick={onReset}>Clear all</button></div>;
}
