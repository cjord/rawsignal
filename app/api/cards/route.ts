import {NextResponse} from "next/server";
type Card={productId:number;name:string;set:string;number:string;rarity:string;printing:string;marketPrice:number;lowPrice:number|null;highPrice:number|null;priceChange:number|null};
const groupKeys=["magic-m","magic-r","magic-u","magic-c","magic-s","magic-p","magic-l","magic-t"];
const memoryCache=new Map<string,Promise<Card[]>>(),dataOrigin="https://raw-signal-pokemon-watch.drdrrr.chatgpt.site";
const loadGroup=(key:string)=>{if(!groupKeys.includes(key))return Promise.resolve([]);if(!memoryCache.has(key))memoryCache.set(key,fetch(`${dataOrigin}/data/${key}.json`,{headers:{Accept:"application/json"}}).then(response=>{if(!response.ok)throw new Error(`Unable to load ${key}`);return response.json() as Promise<Card[]>}));return memoryCache.get(key)!};
const normalized=(value:string)=>value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();
const search=(card:Card,query:string)=>{const haystack=normalized(`${card.name} ${card.set} ${card.number} ${card.rarity} ${card.printing}`);return normalized(query).split(" ").filter(Boolean).every(token=>haystack.includes(token))};

export async function GET(request:Request){
 try{const url=new URL(request.url),params=url.searchParams,section=params.get("section")??"magic-m",query=params.get("q")??"",sort=params.get("sort")??"market",direction=params.get("direction")==="asc"?1:-1,page=Math.max(1,Number(params.get("page"))||1),perPage=Math.min(50,Math.max(20,Number(params.get("perPage"))||20));
  const source=(await Promise.all((section==="all"?groupKeys:[section]).map(loadGroup))).flat(),unique=[...new Map(source.map(card=>[card.productId,card])).values()];
  const cards=unique.filter(card=>search(card,query)).sort((a,b)=>{let value=0;if(sort==="name")value=a.name.localeCompare(b.name);else if(sort==="set")value=a.set.localeCompare(b.set)||a.name.localeCompare(b.name);else if(sort==="low")value=(a.lowPrice??Infinity)-(b.lowPrice??Infinity);else if(sort==="high")value=(a.highPrice??Infinity)-(b.highPrice??Infinity);else if(sort==="change7"||sort==="change30")value=(a.priceChange??0)-(b.priceChange??0);else value=a.marketPrice-b.marketPrice;return value*direction});
  const start=(page-1)*perPage;return NextResponse.json({cards:cards.slice(start,start+perPage),total:cards.length,page,perPage},{headers:{"Cache-Control":"public, max-age=300, s-maxage=300, stale-while-revalidate=3600"}})
 }catch{return NextResponse.json({error:"Card index temporarily unavailable"},{status:503,headers:{"Cache-Control":"no-store"}})}
}
