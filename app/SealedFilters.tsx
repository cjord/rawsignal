"use client";
import useDismissibleDetails from "./filters/useDismissibleDetails";
import FilterButton from "./filters/FilterButton";
import RangeFilter from "./filters/RangeFilter";
import {SearchableCheckboxGrid} from "./filters/CheckboxGrid";
import FilterActions from "./filters/FilterActions";

type Props={sets:string[];setGroups?:Record<string,string>;selectedSets:string[];onSets:(sets:string[])=>void;marketMin:string;marketMax:string;onMarketMin:(value:string)=>void;onMarketMax:(value:string)=>void;msrpMin:string;msrpMax:string;onMsrpMin:(value:string)=>void;onMsrpMax:(value:string)=>void;profitMin:string;profitMax:string;onProfitMin:(value:string)=>void;onProfitMax:(value:string)=>void;profitPctMin:string;profitPctMax:string;onProfitPctMin:(value:string)=>void;onProfitPctMax:(value:string)=>void;onReset:()=>void;showProfit?:boolean};

export default function SealedFilters(props:Props){
 const {sets,setGroups,selectedSets,onSets,marketMin,marketMax,onMarketMin,onMarketMax,msrpMin,msrpMax,onMsrpMin,onMsrpMax,profitMin,profitMax,onProfitMin,onProfitMax,profitPctMin,profitPctMax,onProfitPctMin,onProfitPctMax,onReset,showProfit=true}=props,root=useDismissibleDetails();
 // Hidden profit values never count as active — regular mode ignores them entirely.
 const active=selectedSets.length+[marketMin,marketMax,msrpMin,msrpMax,...(showProfit?[profitMin,profitMax,profitPctMin,profitPctMax]:[])].filter(Boolean).length;
 return <details ref={root} className={`card-filters ${active?"has-filters":""}`}><FilterButton active={active} description={showProfit?"Value, profit & sets":"Value & sets"}/><div className="filter-panel sealed-filter-panel">
  <RangeFilter className="sealed-range" title="Market value" min={marketMin} max={marketMax} onMin={onMarketMin} onMax={onMarketMax}/>
  <RangeFilter className="sealed-range" title="MSRP" min={msrpMin} max={msrpMax} onMin={onMsrpMin} onMax={onMsrpMax}/>
  {showProfit&&<RangeFilter className="sealed-range" title="Profit" min={profitMin} max={profitMax} onMin={onProfitMin} onMax={onProfitMax} allowNegative/>}
  {showProfit&&<RangeFilter className="sealed-range" title="Profit percentage" min={profitPctMin} max={profitPctMax} onMin={onProfitPctMin} onMax={onProfitPctMax} unit="%" allowNegative/>}
  <SearchableCheckboxGrid legend="Available sets" options={sets.map(set=>({key:set,label:set,group:setGroups?.[set]}))} selected={selectedSets} onChange={onSets} searchLabel="Search sealed sets" className="set-filters sealed-set-filters"/>
  <FilterActions active={active} noun="products" onReset={onReset}/>
 </div></details>;
}
