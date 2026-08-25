"use client";
import useDismissibleDetails from "./filters/useDismissibleDetails";
import FilterButton from "./filters/FilterButton";
import RangeFilter from "./filters/RangeFilter";
import {SearchableCheckboxGrid} from "./filters/CheckboxGrid";
import FilterActions from "./filters/FilterActions";

type Props={sets:string[];selectedSets:string[];onSets:(sets:string[])=>void;marketMin:string;marketMax:string;onMarketMin:(value:string)=>void;onMarketMax:(value:string)=>void;msrpMin:string;msrpMax:string;onMsrpMin:(value:string)=>void;onMsrpMax:(value:string)=>void;profitMin:string;profitMax:string;onProfitMin:(value:string)=>void;onProfitMax:(value:string)=>void;profitPctMin:string;profitPctMax:string;onProfitPctMin:(value:string)=>void;onProfitPctMax:(value:string)=>void;profitableOnly:boolean;onProfitableOnly:(value:boolean)=>void;onReset:()=>void};

export default function SealedFilters(props:Props){
 const {sets,selectedSets,onSets,marketMin,marketMax,onMarketMin,onMarketMax,msrpMin,msrpMax,onMsrpMin,onMsrpMax,profitMin,profitMax,onProfitMin,onProfitMax,profitPctMin,profitPctMax,onProfitPctMin,onProfitPctMax,profitableOnly,onProfitableOnly,onReset}=props,root=useDismissibleDetails(),active=selectedSets.length+[marketMin,marketMax,msrpMin,msrpMax,profitMin,profitMax,profitPctMin,profitPctMax].filter(Boolean).length+Number(profitableOnly);
 return <details ref={root} className={`card-filters ${active?"has-filters":""}`}><FilterButton active={active} description="Value, profit & sets"/><div className="filter-panel sealed-filter-panel">
  <RangeFilter className="sealed-range" title="Market value" min={marketMin} max={marketMax} onMin={onMarketMin} onMax={onMarketMax}/>
  <RangeFilter className="sealed-range" title="MSRP" min={msrpMin} max={msrpMax} onMin={onMsrpMin} onMax={onMsrpMax}/>
  <RangeFilter className="sealed-range" title="Profit" min={profitMin} max={profitMax} onMin={onProfitMin} onMax={onProfitMax} allowNegative/>
  <RangeFilter className="sealed-range" title="Profit percentage" min={profitPctMin} max={profitPctMax} onMin={onProfitPctMin} onMax={onProfitPctMax} unit="%" allowNegative/>
  <SearchableCheckboxGrid legend="Available sets" options={sets.map(set=>({key:set,label:set}))} selected={selectedSets} onChange={onSets} searchLabel="Search sealed sets" className="set-filters sealed-set-filters"/>
  <fieldset className="sealed-checks"><legend>Profitability</legend><label><input type="checkbox" checked={profitableOnly} onChange={event=>onProfitableOnly(event.target.checked)}/><span>Profitable products only</span></label></fieldset>
  <FilterActions active={active} noun="products" onReset={onReset}/>
 </div></details>;
}
