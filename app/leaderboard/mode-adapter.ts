import type {Direction} from "../MarketUI.tsx";
import type {CatalogDerived} from "../../core/catalog-query.ts";
import {classifyRegime} from "../../core/domain/regime.ts";
import type {PriceHistory,MarketSignal,SignalSide,SignalStrictness} from "../../core/domain/types.ts";
import {marketSignal} from "../../core/signal-utils.ts";
import type {ActiveFilterItem,SortOption} from "./types.ts";

type CatalogItem={productId:number};
type SignalResolver<T extends CatalogItem>=(item:T)=>MarketSignal|null;

const unavailableDerived:CatalogDerived={change7:null,change30:null,low30:null,high30:null,regime:null,signal:null};

export function buildCatalogDerived<T extends CatalogItem>(items:T[],history:Record<number,PriceHistory>,persisted:{ready:boolean;derived:Record<number,CatalogDerived>},signalFor:SignalResolver<T>){
 return Object.fromEntries(items.map(item=>{
  if(persisted.ready)return[item.productId,persisted.derived[item.productId]??unavailableDerived];
  const itemHistory=history[item.productId];
  return[item.productId,{change7:itemHistory?.change7??null,change30:itemHistory?.change30??null,low30:itemHistory?.low30??null,high30:itemHistory?.high30??null,regime:itemHistory?.points?classifyRegime(itemHistory.points)?.regime??null:null,signal:signalFor(item)} satisfies CatalogDerived];
 })) as Record<number,CatalogDerived>;
}

// The per-item signal used while a signal board is showing: persisted signals once the
// readiness marker is published, otherwise a live evaluation of the item's fetched history
// at its current price. Shared by the Singles and Sealed orchestrators, which differ only
// in how they read an item's current price.
export function signalResolver<T extends CatalogItem>(side:SignalSide,strictness:SignalStrictness,persisted:{ready:boolean;derived:Record<number,CatalogDerived>},history:Record<number,PriceHistory>,priceOf:(item:T)=>number|null|undefined):SignalResolver<T>{
 return item=>side==="leaderboard"
  ?null
  :persisted.ready
   ?(persisted.derived[item.productId]?.signal??null)
   :marketSignal(history[item.productId]?.points??[],side,strictness,priceOf(item));
}

export function signalAwareSorts<T extends string>(sorts:SortOption<T>[],signalSort:SortOption<T>,side:SignalSide){
 return side==="leaderboard"?sorts:[sorts[0],signalSort,...sorts.slice(1)];
}

export function nextSortDirection<T extends string>(currentSort:T,currentDirection:Direction,nextSort:T,ascendingByDefault:ReadonlySet<T>):Direction{
 return currentSort===nextSort?(currentDirection==="asc"?"desc":"asc"):ascendingByDefault.has(nextSort)?"asc":"desc";
}

// One active-filter chip per selected value (sets, regimes, ...): clearing a chip removes
// just that value. Shared by the Singles and Sealed orchestrators so the two chip builders
// cannot drift.
export function selectionChips(prefix:string,selected:string[],update:(next:string[])=>void,label:(value:string)=>string=value=>value):ActiveFilterItem[]{
 return selected.map(value=>({key:`${prefix}:${value}`,label:label(value),clear:()=>update(selected.filter(item=>item!==value))}));
}
