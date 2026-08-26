import type {Direction} from "../MarketUI.tsx";
import type {CatalogDerived} from "../data/catalog-query.ts";
import type {PriceHistory,MarketSignal,SignalSide} from "../domain/types.ts";
import type {SortOption} from "./types.ts";

type CatalogItem={productId:number};
type SignalResolver<T extends CatalogItem>=(item:T)=>MarketSignal|null;

const unavailableDerived:CatalogDerived={change7:null,change30:null,low30:null,high30:null,signal:null};

export function buildCatalogDerived<T extends CatalogItem>(items:T[],history:Record<number,PriceHistory>,persisted:{ready:boolean;derived:Record<number,CatalogDerived>},signalFor:SignalResolver<T>){
 return Object.fromEntries(items.map(item=>{
  if(persisted.ready)return[item.productId,persisted.derived[item.productId]??unavailableDerived];
  const itemHistory=history[item.productId];
  return[item.productId,{change7:itemHistory?.change7??null,change30:itemHistory?.change30??null,low30:itemHistory?.low30??null,high30:itemHistory?.high30??null,signal:signalFor(item)} satisfies CatalogDerived];
 })) as Record<number,CatalogDerived>;
}

export function signalAwareSorts<T extends string>(sorts:SortOption<T>[],signalSort:SortOption<T>,side:SignalSide){
 return side==="leaderboard"?sorts:[sorts[0],signalSort,...sorts.slice(1)];
}

export function nextSortDirection<T extends string>(currentSort:T,currentDirection:Direction,nextSort:T,ascendingByDefault:ReadonlySet<T>):Direction{
 return currentSort===nextSort?(currentDirection==="asc"?"desc":"asc"):ascendingByDefault.has(nextSort)?"asc":"desc";
}
