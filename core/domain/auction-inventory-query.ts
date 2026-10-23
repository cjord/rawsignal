import {initialInventoryFilters,type InventoryFilters} from './auction-inventory-management.ts';
const sorts:InventoryFilters['sort'][]=['value-desc','value-asc','unit-desc','quantity-desc','rarity-desc','name'];
export function parseAuctionInventoryQuery(search:string){
 const params=new URLSearchParams(search),sort=params.get('sort'),availability=params.get('availability'),page=params.get('page')??'1';
 const filters:InventoryFilters={search:(params.get('q')??'').slice(0,200),rarity:(params.get('rarity')??'').slice(0,100),set:(params.get('set')??'').slice(0,300),sort:sorts.includes(sort as InventoryFilters['sort'])?sort as InventoryFilters['sort']:initialInventoryFilters.sort,availability:availability==='priced'||availability==='unpriced'?availability:'all'};
 return {filters,page:/^\d{1,5}$/.test(page)?Math.max(0,Math.min(9999,Number(page)-1)):0};
}
export function serializeAuctionInventoryQuery(filters:InventoryFilters,page:number){
 const params=new URLSearchParams();if(filters.search)params.set('q',filters.search);if(filters.rarity)params.set('rarity',filters.rarity);if(filters.set)params.set('set',filters.set);if(filters.sort!==initialInventoryFilters.sort)params.set('sort',filters.sort);if(filters.availability!=='all')params.set('availability',filters.availability);if(page>0)params.set('page',String(page+1));return params.toString();
}
