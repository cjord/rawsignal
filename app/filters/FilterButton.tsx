"use client";

export default function FilterButton({active,description}:{active:number;description:string}){
 return <summary><span aria-hidden="true">⌁</span><b>Filters</b>{active>0&&<em>{active}</em>}<small>{active?"Active filters":description}</small><i className="filter-chevron" aria-hidden="true">⌄</i></summary>;
}
