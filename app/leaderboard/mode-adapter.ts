import type {Direction} from "../MarketUI.tsx";
import type {CatalogDerived} from "../../core/catalog-query.ts";
import type {PriceHistory,MarketSignal,RowMetrics,SignalSide,SignalStrictness} from "../../core/domain/types.ts";
import {marketSignal} from "../../core/signal-utils.ts";
import {matchingRowHistory,loadedRowHistory} from "../../core/domain/history-snapshot.ts";
import type {ActiveFilterItem,SortOption} from "./types.ts";

type CatalogItem={productId:number;metrics?:RowMetrics;printing?:string};
type SignalResolver<T extends CatalogItem>=(item:T)=>MarketSignal|null;


// A row's feed metrics as the history shape the columns render from (no points: the chart
// still loads lazily on hover). Undefined when the feed carried no metrics.
export function historyFromMetrics(item:CatalogItem):PriceHistory|undefined{
 return matchingRowHistory(item.metrics,undefined);
}

export function buildCatalogDerived<T extends CatalogItem>(items:T[],history:Record<number,PriceHistory>,persisted:{ready:boolean;derived:Record<number,CatalogDerived>},signalFor:SignalResolver<T>){
 return Object.fromEntries(items.map(item=>{
  // Ranking is a catalog snapshot, never a side effect of opening a chart.
  const metrics=item.metrics;
  return[item.productId,{change7:metrics?.change7??null,change30:metrics?.change30??null,low30:metrics?.low30??null,high30:metrics?.high30??null,regime:(metrics?.regime as CatalogDerived["regime"])??null,signal:persisted.ready?persisted.derived[item.productId]?.signal??null:signalFor(item)}];
 })) as Record<number,CatalogDerived>;
}

// The per-item signal used while a signal board is showing: persisted signals once the
// readiness marker is published, otherwise a live evaluation of the item's fetched history
// at its current price. Shared by the Singles and Sealed orchestrators, which differ only
// in how they read an item's current price.
export function signalResolver<T extends CatalogItem>(side:SignalSide,strictness:SignalStrictness,persisted:{ready:boolean;derived:Record<number,CatalogDerived>},history:Record<number,PriceHistory>,priceOf:(item:T)=>number|null|undefined):SignalResolver<T>{
 return item=>side==="leaderboard"||priceOf(item)==null
  ?null
  :persisted.ready
   ?(persisted.derived[item.productId]?.signal??null)
   :marketSignal((loadedRowHistory(history,item)??(item.metrics?undefined:history[item.productId]))?.points??[],side,strictness,priceOf(item));
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
