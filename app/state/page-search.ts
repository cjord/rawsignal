export type PageSearch=Record<string,string|string[]|undefined>;
// Match URLSearchParams.get's first-value semantics, including repeated keys.
export function pageSearch(values:PageSearch){
 const query=new URLSearchParams();
 for(const [key,value] of Object.entries(values)){const first=Array.isArray(value)?value[0]:value;if(first!==undefined)query.set(key,first)}
 return query.toString();
}
