"use client";
import useDismissibleDetails from "./filters/useDismissibleDetails";
import FilterButton from "./filters/FilterButton";
import RangeFilter from "./filters/RangeFilter";
import {CheckboxGrid,SearchableCheckboxGrid} from "./filters/CheckboxGrid";
import FilterActions from "./filters/FilterActions";
import {REGIME_LABELS,type MarketRegime} from "../core/domain/regime";

export type MovementFilters={up7:boolean;down7:boolean;up30:boolean;down30:boolean};
type Props={sets:string[];setGroups?:Record<string,string>;selectedSets:string[];onSets:(sets:string[])=>void;minPrice:string;maxPrice:string;onMinPrice:(value:string)=>void;onMaxPrice:(value:string)=>void;movement:MovementFilters;onMovement:(value:MovementFilters)=>void;regimes:string[];onRegimes:(value:string[])=>void;onReset:()=>void};
const movementOptions=[{key:"up7",label:"7D increases",className:"up"},{key:"down7",label:"7D decreases",className:"down"},{key:"up30",label:"30D increases",className:"up"},{key:"down30",label:"30D decreases",className:"down"}] satisfies {key:keyof MovementFilters;label:string;className:string}[];
export const regimeOptions=(Object.keys(REGIME_LABELS) as MarketRegime[]).map(key=>({key,label:REGIME_LABELS[key]}));

export default function CardFilters({sets,setGroups,selectedSets,onSets,minPrice,maxPrice,onMinPrice,onMaxPrice,movement,onMovement,regimes,onRegimes,onReset}:Props){
 const root=useDismissibleDetails(),active=selectedSets.length+Number(Boolean(minPrice))+Number(Boolean(maxPrice))+Object.values(movement).filter(Boolean).length+regimes.length,selectedMovement=movementOptions.filter(option=>movement[option.key]).map(option=>option.key);
 return <details ref={root} className={`card-filters ${active?"has-filters":""}`}><FilterButton active={active} description="Price, sets & movement"/><div className="filter-panel">
  <RangeFilter title="Market price" min={minPrice} max={maxPrice} onMin={onMinPrice} onMax={onMaxPrice}/>
  <fieldset><legend>Price movement</legend><CheckboxGrid className="movement-filters" options={movementOptions} selected={selectedMovement} onToggle={key=>onMovement({...movement,[key]:!movement[key as keyof MovementFilters]})}/></fieldset>
  <fieldset><legend>Market regime</legend><CheckboxGrid className="movement-filters regime-filters" options={regimeOptions} selected={regimes} onToggle={key=>onRegimes(regimes.includes(key)?regimes.filter(value=>value!==key):[...regimes,key])}/></fieldset>
  <SearchableCheckboxGrid legend="Available sets" options={sets.map(set=>({key:set,label:set,group:setGroups?.[set]}))} selected={selectedSets} onChange={onSets} searchLabel="Search card sets"/>
  <FilterActions active={active} noun="cards" onReset={onReset}/>
 </div></details>;
}
