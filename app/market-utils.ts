import type {PricePoint} from "./PriceChart";

export const normalized=(value:string)=>value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();

export function editDistance(a:string,b:string){const row=Array.from({length:b.length+1},(_,index)=>index);for(let i=1;i<=a.length;i++){let previous=row[0];row[0]=i;for(let j=1;j<=b.length;j++){const current=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,previous+(a[i-1]===b[j-1]?0:1));previous=current}}return row[b.length]}

export function fuzzyTextMatch(text:string,query:string){const tokens=normalized(query).split(" ").filter(Boolean);if(!tokens.length)return true;const words=normalized(text).split(" ");return tokens.every(token=>words.some(word=>word.includes(token)||(token.length>=4&&editDistance(token,word)<=Math.max(1,Math.floor(token.length*.2)))))}

export function nearestChange(points:PricePoint[],days:number){if(points.length<2)return null;const latest=points.at(-1)!,target=new Date(`${latest.date}T00:00:00Z`);target.setUTCDate(target.getUTCDate()-days);const prior=[...points].reverse().find(point=>new Date(`${point.date}T00:00:00Z`)<=target);return prior?((latest.price-prior.price)/prior.price)*100:null}

export function rangeStats(points:PricePoint[],days:number){if(!points.length)return{low:null,high:null};const latest=new Date(`${points.at(-1)!.date}T00:00:00Z`);latest.setUTCDate(latest.getUTCDate()-days);const prices=points.filter(point=>new Date(`${point.date}T00:00:00Z`)>=latest).map(point=>point.price);return prices.length?{low:Math.min(...prices),high:Math.max(...prices)}:{low:null,high:null}}

export async function mapWithConcurrency<T,R>(items:T[],limit:number,worker:(item:T)=>Promise<R>){const results=new Array<R>(items.length),cursor={value:0};await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{while(cursor.value<items.length){const index=cursor.value++;results[index]=await worker(items[index])}}));return results}
