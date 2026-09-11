"use client";
import type {CSSProperties} from "react";

export type Direction="asc"|"desc";
export type ViewOption<T extends string>={key:T;label:string;icon:string};

export function SegmentedView<T extends string>({value,onChange,options,label="View",className=""}:{value:T;onChange:(value:T)=>void;options:ViewOption<T>[];label?:string;className?:string}){const selected=Math.max(0,options.findIndex(option=>option.key===value));return <div className={`view-toggle ${className}`.trim()} role="group" aria-label={label} style={{"--selected-index":selected,"--view-count":options.length} as CSSProperties}><i className="view-slider" aria-hidden="true"/>{options.map(option=><button key={option.key} className={value===option.key?"active":""} aria-label={option.label} aria-pressed={value===option.key} onClick={()=>onChange(option.key)}><span aria-hidden="true">{option.icon}</span><b>{option.label}</b></button>)}</div>}

export function SortableHeader<T extends string>({label,column,sort,direction,onSort}:{label:string;column:T;sort:T;direction:Direction;onSort:(column:T)=>void}){const active=sort===column;return <span role="columnheader" aria-sort={active?(direction==="asc"?"ascending":"descending"):"none"}><button onClick={()=>onSort(column)}>{label}<span className={`sort-mark ${active?"active":""}`} aria-hidden="true">{active?(direction==="asc"?"▲":"▼"):"◇"}</span></button></span>}

export function SortToolbar<T extends string>({items,sort,direction,onSort,label}:{items:readonly {label:string;key:T}[];sort:T;direction:Direction;onSort:(column:T)=>void;label:string}){return <div className="sort-toolbar" role="toolbar" aria-label={label}>{items.map(item=><SortableHeader key={item.key} label={item.label} column={item.key} sort={sort} direction={direction} onSort={onSort}/>)}</div>}

const withEllipses=(values:number[]):(number|"ellipsis")[]=>{const sorted=[...new Set(values)].sort((a,b)=>a-b),result:(number|"ellipsis")[]=[];sorted.forEach((n,i)=>{if(i&&n-sorted[i-1]>1)result.push("ellipsis");result.push(n)});return result};
const pageItems=(current:number,total:number,compact=false):(number|"ellipsis")[]=>{
 if(compact){if(total<=4)return Array.from({length:total},(_,i)=>i+1);if(current<=2)return withEllipses([1,2,3,total]);if(current>=total-1)return withEllipses([1,total-2,total-1,total]);return withEllipses([1,current,current+1,total])}
 if(total<=7)return Array.from({length:total},(_,i)=>i+1);
 const values=[1,total,current-1,current,current+1].filter(n=>n>=1&&n<=total);if(current<=3)values.push(2,3,4);if(current>=total-2)values.push(total-3,total-2,total-1);return withEllipses(values);
};

export function NumberedPagination({page,pages,onChange,label,compact=false}:{page:number;pages:number;onChange:(page:number)=>void;label:string;compact?:boolean}){return <nav className={`pagination${compact?" pagination-compact":""}`} aria-label={label}><button disabled={page===1} onClick={()=>onChange(page-1)}>← Previous</button><div className="page-numbers">{pageItems(page,pages,compact).map((item,i)=>item==="ellipsis"?<span key={`e${i}`} aria-hidden="true">…</span>:<button key={item} className={page===item?"current":""} aria-current={page===item?"page":undefined} aria-label={`Page ${item}`} onClick={()=>onChange(item)}>{item}</button>)}</div><button disabled={page===pages} onClick={()=>onChange(page+1)}>Next →</button></nav>}
