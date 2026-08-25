import type {PriceHistory,PricePoint} from "./types";

export type DerivedHistoryMetrics=Pick<PriceHistory,"change7"|"change30"|"change90"|"low30"|"high30"|"historyLow"|"historyHigh">;

const dayMs=86_400_000;
const timestamp=(date:string)=>Date.parse(`${date}T00:00:00Z`);

export function normalizePricePoints(points:PricePoint[]){
 const dated=points.filter(point=>Number.isFinite(point.price)&&Number.isFinite(timestamp(point.date))).sort((a,b)=>timestamp(a.date)-timestamp(b.date));
 return [...new Map(dated.map(point=>[point.date,point])).values()];
}

export function changeAtCutoff(points:PricePoint[],days:number){
 if(points.length<2)return null;
 const latest=points.at(-1)!,cutoff=timestamp(latest.date)-days*dayMs;
 const prior=[...points].reverse().find(point=>timestamp(point.date)<=cutoff);
 return prior&&prior.price!==0?(latest.price-prior.price)/prior.price*100:null;
}

export function extremaWithin(points:PricePoint[],days:number){
 if(!points.length)return{low:null,high:null};
 const cutoff=timestamp(points.at(-1)!.date)-days*dayMs,prices=points.filter(point=>timestamp(point.date)>=cutoff).map(point=>point.price);
 return prices.length?{low:Math.min(...prices),high:Math.max(...prices)}:{low:null,high:null};
}

export function deriveHistoryMetrics(input:PricePoint[]):DerivedHistoryMetrics{
 const points=normalizePricePoints(input),month=extremaWithin(points,30),prices=points.map(point=>point.price);
 return{change7:changeAtCutoff(points,7),change30:changeAtCutoff(points,30),change90:changeAtCutoff(points,90),low30:month.low,high30:month.high,historyLow:prices.length?Math.min(...prices):null,historyHigh:prices.length?Math.max(...prices):null};
}
