"use client";

export default function FilterActions({active,onReset,onCancel,onApply}:{active:number;onReset:()=>void;onCancel:()=>void;onApply:()=>void}){
 return <div className="filter-actions"><span>{active?`${active} filter${active===1?"":"s"} selected`:"No filters selected"}</span><div className="filter-action-buttons"><button type="button" disabled={!active} onClick={onReset}>Clear all</button><button type="button" onClick={onCancel}>Cancel</button><button type="button" className="filter-apply" onClick={onApply}>Apply filters</button></div></div>;
}
