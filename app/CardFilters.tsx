"use client";
import useFilterDraft from "./filters/useFilterDraft";
import FilterButton from "./filters/FilterButton";
import FilterPanelHeader from "./filters/FilterPanelHeader";
import RangeFilter from "./filters/RangeFilter";
import {CheckboxGrid,SearchableCheckboxGrid} from "./filters/CheckboxGrid";
import FilterActions from "./filters/FilterActions";
import {REGIME_LABELS,type MarketRegime} from "../core/domain/regime";

export type MovementFilters={up7:boolean;down7:boolean;up30:boolean;down30:boolean};
type Props={sets:string[];setGroups?:Record<string,string>;selectedSets:string[];onSets:(sets:string[])=>void;minPrice:string;maxPrice:string;onMinPrice:(value:string)=>void;onMaxPrice:(value:string)=>void;movement:MovementFilters;onMovement:(value:MovementFilters)=>void;regimes:string[];onRegimes:(value:string[])=>void};
const movementOptions=[{key:"up7",label:"7D increases",className:"up"},{key:"down7",label:"7D decreases",className:"down"},{key:"up30",label:"30D increases",className:"up"},{key:"down30",label:"30D decreases",className:"down"}] satisfies {key:keyof MovementFilters;label:string;className:string}[];
export const regimeOptions=(Object.keys(REGIME_LABELS) as MarketRegime[]).map(key=>({key,label:REGIME_LABELS[key]}));

export default function CardFilters({sets,setGroups,selectedSets,onSets,minPrice,maxPrice,onMinPrice,onMaxPrice,movement,onMovement,regimes,onRegimes}:Props){
 const {root,draft,setDraft,onToggle,close}=useFilterDraft({selectedSets,minPrice,maxPrice,movement,regimes});
 const active=selectedSets.length+Number(Boolean(minPrice))+Number(Boolean(maxPrice))+Object.values(movement).filter(Boolean).length+regimes.length;
 const draftActive=draft.selectedSets.length+Number(Boolean(draft.minPrice))+Number(Boolean(draft.maxPrice))+Object.values(draft.movement).filter(Boolean).length+draft.regimes.length;
 const selectedMovement=movementOptions.filter(option=>draft.movement[option.key]).map(option=>option.key);
 const apply=()=>{onSets(draft.selectedSets);onMinPrice(draft.minPrice);onMaxPrice(draft.maxPrice);onMovement(draft.movement);onRegimes(draft.regimes);close()};
 const reset=()=>setDraft({selectedSets:[],minPrice:"",maxPrice:"",movement:{up7:false,down7:false,up30:false,down30:false},regimes:[]});
 return <details ref={root} onToggle={onToggle} className={`card-filters ${active?"has-filters":""}`}><FilterButton active={active} description="Price, sets & movement"/><div className="filter-panel">
  <FilterPanelHeader onClose={close}/>
  <RangeFilter title="Market price" min={draft.minPrice} max={draft.maxPrice} onMin={value=>setDraft(current=>({...current,minPrice:value}))} onMax={value=>setDraft(current=>({...current,maxPrice:value}))}/>
  <fieldset><legend>Price movement</legend><CheckboxGrid className="movement-filters" options={movementOptions} selected={selectedMovement} onToggle={key=>setDraft(current=>({...current,movement:{...current.movement,[key]:!current.movement[key as keyof MovementFilters]}}))}/></fieldset>
  <fieldset><legend>Market regime</legend><CheckboxGrid className="movement-filters regime-filters" options={regimeOptions} selected={draft.regimes} onToggle={key=>setDraft(current=>({...current,regimes:current.regimes.includes(key)?current.regimes.filter(value=>value!==key):[...current.regimes,key]}))}/></fieldset>
  <SearchableCheckboxGrid legend="Available sets" options={sets.map(set=>({key:set,label:set,group:setGroups?.[set]}))} selected={draft.selectedSets} onChange={value=>setDraft(current=>({...current,selectedSets:value}))} searchLabel="Search card sets"/>
  <FilterActions active={draftActive} onReset={reset} onCancel={close} onApply={apply}/>
 </div></details>;
}
