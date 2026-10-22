export type QuerySet={game:string;setName:string};

// A single JSON binding avoids D1's parameter ceiling for the top sets of two games.
// Joining the exact game/set pairs also preserves colliding names such as Unleashed.
export function setQueryScope(sets?:readonly QuerySet[]){
 if(sets===undefined)return {from:'catalog_products p',params:[] as unknown[]};
 const unique=[...new Map(sets.map(set=>[JSON.stringify([set.game,set.setName]),[set.game,set.setName]])).values()];
 // CROSS JOIN deliberately keeps the small selected-set table outermost. An ordinary
 // join let SQLite scan all products before probing JSON despite the set index.
 return {from:"json_each(?) selected_set cross join catalog_products p on p.game=json_extract(selected_set.value,'$[0]') and p.set_name=json_extract(selected_set.value,'$[1]')",params:[JSON.stringify(unique)] as unknown[]};
}
