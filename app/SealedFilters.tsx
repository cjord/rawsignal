"use client";
import useFilterDraft from "./filters/useFilterDraft";
import FilterButton from "./filters/FilterButton";
import FilterPanelHeader from "./filters/FilterPanelHeader";
import RangeFilter from "./filters/RangeFilter";
import {CheckboxGrid,SearchableCheckboxGrid} from "./filters/CheckboxGrid";
import FilterActions from "./filters/FilterActions";
import {regimeOptions} from "./CardFilters";

type Props={sets:string[];setGroups?:Record<string,string>;selectedSets:string[];onSets:(sets:string[])=>void;marketMin:string;marketMax:string;onMarketMin:(value:string)=>void;onMarketMax:(value:string)=>void;msrpMin:string;msrpMax:string;onMsrpMin:(value:string)=>void;onMsrpMax:(value:string)=>void;profitMin:string;profitMax:string;onProfitMin:(value:string)=>void;onProfitMax:(value:string)=>void;profitPctMin:string;profitPctMax:string;onProfitPctMin:(value:string)=>void;onProfitPctMax:(value:string)=>void;regimes:string[];onRegimes:(value:string[])=>void;showProfit?:boolean};

export default function SealedFilters(props:Props){
 const {sets,setGroups,selectedSets,onSets,marketMin,marketMax,onMarketMin,onMarketMax,msrpMin,msrpMax,onMsrpMin,onMsrpMax,profitMin,profitMax,onProfitMin,onProfitMax,profitPctMin,profitPctMax,onProfitPctMin,onProfitPctMax,regimes,onRegimes,showProfit=true}=props;
 const {root,draft,setDraft,onToggle,close}=useFilterDraft({selectedSets,marketMin,marketMax,msrpMin,msrpMax,profitMin,profitMax,profitPctMin,profitPctMax,regimes});
 // Hidden profit values never count as active — regular mode ignores them entirely.
 const active=selectedSets.length+regimes.length+[marketMin,marketMax,msrpMin,msrpMax,...(showProfit?[profitMin,profitMax,profitPctMin,profitPctMax]:[])].filter(Boolean).length;
 const draftActive=draft.selectedSets.length+draft.regimes.length+[draft.marketMin,draft.marketMax,draft.msrpMin,draft.msrpMax,...(showProfit?[draft.profitMin,draft.profitMax,draft.profitPctMin,draft.profitPctMax]:[])].filter(Boolean).length;
 const reset=()=>setDraft({selectedSets:[],marketMin:"",marketMax:"",msrpMin:"",msrpMax:"",profitMin:"",profitMax:"",profitPctMin:"",profitPctMax:"",regimes:[]});
 const apply=()=>{onSets(draft.selectedSets);onMarketMin(draft.marketMin);onMarketMax(draft.marketMax);onMsrpMin(draft.msrpMin);onMsrpMax(draft.msrpMax);onProfitMin(draft.profitMin);onProfitMax(draft.profitMax);onProfitPctMin(draft.profitPctMin);onProfitPctMax(draft.profitPctMax);onRegimes(draft.regimes);close()};
 return <details ref={root} onToggle={onToggle} className={`card-filters ${active?"has-filters":""}`}><FilterButton active={active} description={showProfit?"Value, profit & sets":"Value & sets"}/><div className="filter-panel sealed-filter-panel">
  <FilterPanelHeader onClose={close}/>
  <RangeFilter className="sealed-range" title="Market value" min={draft.marketMin} max={draft.marketMax} onMin={value=>setDraft(current=>({...current,marketMin:value}))} onMax={value=>setDraft(current=>({...current,marketMax:value}))}/>
  <RangeFilter className="sealed-range" title="MSRP" min={draft.msrpMin} max={draft.msrpMax} onMin={value=>setDraft(current=>({...current,msrpMin:value}))} onMax={value=>setDraft(current=>({...current,msrpMax:value}))}/>
  {showProfit&&<RangeFilter className="sealed-range" title="Profit" min={draft.profitMin} max={draft.profitMax} onMin={value=>setDraft(current=>({...current,profitMin:value}))} onMax={value=>setDraft(current=>({...current,profitMax:value}))} allowNegative/>}
  {showProfit&&<RangeFilter className="sealed-range" title="Profit percentage" min={draft.profitPctMin} max={draft.profitPctMax} onMin={value=>setDraft(current=>({...current,profitPctMin:value}))} onMax={value=>setDraft(current=>({...current,profitPctMax:value}))} unit="%" allowNegative/>}
  <fieldset><legend>Market regime</legend><CheckboxGrid className="movement-filters regime-filters" options={regimeOptions} selected={draft.regimes} onToggle={key=>setDraft(current=>({...current,regimes:current.regimes.includes(key)?current.regimes.filter(value=>value!==key):[...current.regimes,key]}))}/></fieldset>
  <SearchableCheckboxGrid legend="Available sets" options={sets.map(set=>({key:set,label:set,group:setGroups?.[set]}))} selected={draft.selectedSets} onChange={value=>setDraft(current=>({...current,selectedSets:value}))} searchLabel="Search sealed sets" className="set-filters sealed-set-filters"/>
  <FilterActions active={draftActive} onReset={reset} onCancel={close} onApply={apply}/>
 </div></details>;
}
