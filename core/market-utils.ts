import {changeAtCutoff,extremaWithin,normalizePricePoints} from "./domain/history-metrics.ts";
import type {PricePoint} from "./domain/types.ts";

export const normalized=(value:string)=>value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();

export function editDistance(a:string,b:string){const row=Array.from({length:b.length+1},(_,index)=>index);for(let i=1;i<=a.length;i++){let previous=row[0];row[0]=i;for(let j=1;j<=b.length;j++){const current=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,previous+(a[i-1]===b[j-1]?0:1));previous=current}}return row[b.length]}

export function fuzzyTextMatch(text:string,query:string){const tokens=normalized(query).split(" ").filter(Boolean);if(!tokens.length)return true;const words=normalized(text).split(" ");return tokens.every(token=>words.some(word=>word.includes(token)||(token.length>=4&&editDistance(token,word)<=Math.max(1,Math.floor(token.length*.2)))))}

export function nearestChange(points:PricePoint[],days:number){return changeAtCutoff(normalizePricePoints(points),days)}

export function rangeStats(points:PricePoint[],days:number){return extremaWithin(normalizePricePoints(points),days)}

export async function mapWithConcurrency<T,R>(items:T[],limit:number,worker:(item:T)=>Promise<R>){const results=new Array<R>(items.length),cursor={value:0};await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{while(cursor.value<items.length){const index=cursor.value++;results[index]=await worker(items[index])}}));return results}
