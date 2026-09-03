import type {PricePoint} from "../core/domain/types";

// The pure geometry behind PriceChart: range slicing, scale, the polyline, volume bars, the
// extreme markers, overlays, and the trailing 30-day mean. Computed once per
// (points, range, overlays, volumes, large) and memoized by the component — hover moves
// re-render on every pointer event, and the moving average is O(n²) over the series.
export type ChartOverlay={label:string;points:PricePoint[];className?:string};
export type ChartVolume={date:string;quantity:number};
export type ChartGeometry=ReturnType<typeof chartGeometry>;

const time=(date:string)=>Date.parse(`${date}T00:00:00Z`);

export function chartGeometry(points:PricePoint[],range:7|30|90|365,overlays:ChartOverlay[]|undefined,volumes:ChartVolume[]|undefined,large:boolean){
 const cutoff=new Date(`${points.at(-1)!.date}T00:00:00Z`);cutoff.setUTCDate(cutoff.getUTCDate()-range);
 const shown=points.filter(point=>new Date(`${point.date}T00:00:00Z`)>=cutoff),chartPoints=shown.length>1?shown:points;
 const values=chartPoints.map(point=>point.price),times=chartPoints.map(point=>time(point.date)),timeSpan=times.at(-1)!-times[0]||1;
 // Optional comparison series (base-100 overlays, the S&P benchmark) share the scale and
 // time axis; each keeps its label so the hover tooltip can read every line at once.
 const overlaysShown=(overlays??[]).map(series=>({label:series.label,className:series.className??"chart-overlay",points:series.points.map(point=>({price:point.price,time:time(point.date)})).filter(point=>point.time>=times[0]&&point.time<=times.at(-1)!)})).filter(series=>series.points.length>1);
 const overlayPrices=overlaysShown.flatMap(series=>series.points.map(point=>point.price));
 const mainMin=Math.min(...values),mainMax=Math.max(...values);
 const min=Math.min(mainMin,...overlayPrices),max=Math.max(mainMax,...overlayPrices),span=max-min||1;
 const xy=chartPoints.map((point,index)=>({x:((times[index]-times[0])/timeSpan)*240,y:70-((point.price-min)/span)*62}));
 const first=values[0],last=values.at(-1)!,delta=first?((last-first)/first)*100:null,deltaTone=delta==null||delta===0?"":delta>0?"up":"down";
 const midDate=chartPoints[Math.floor(chartPoints.length/2)].date,line=xy.map(point=>`${point.x},${point.y}`).join(" ");
 const shownVolumes=(volumes??[]).map(bucket=>({...bucket,time:time(bucket.date)})).filter(bucket=>bucket.time>=times[0]&&bucket.time<=times.at(-1)!);
 const maxQuantity=Math.max(0,...shownVolumes.map(bucket=>bucket.quantity)),volumeByDate=new Map(shownVolumes.map(bucket=>[bucket.date,bucket.quantity])),barWidth=shownVolumes.length?Math.max(1.4,Math.min(7,240/(shownVolumes.length*1.7))):0;
 // Extreme markers belong to the main series; the scale may be stretched by the overlay.
 const minIndex=values.indexOf(mainMin),maxIndex=values.indexOf(mainMax);
 // Detail-page overlay only: trailing 30-day mean computed over the full series so short ranges stay anchored.
 const maLine=large&&chartPoints.length>7?chartPoints.map((point,index)=>{
  const end=time(point.date),start=end-30*86400000;
  const windowPrices=points.filter(item=>{const t=time(item.date);return t>start&&t<=end}).map(item=>item.price);
  const value=windowPrices.length?windowPrices.reduce((sum,item)=>sum+item,0)/windowPrices.length:point.price;
  return `${xy[index].x},${Math.max(4,Math.min(74,70-((value-min)/span)*62)).toFixed(2)}`;
 }).join(" "):null;
 const overlayLines=overlaysShown.map(series=>({...series,line:series.points.map(point=>`${(((point.time-times[0])/timeSpan)*240).toFixed(2)},${(70-((point.price-min)/span)*62).toFixed(2)}`).join(" ")}));
 return {chartPoints,times,timeSpan,overlays:overlayLines,min,max,mainMin,mainMax,xy,delta,deltaTone,midDate,line,shownVolumes,maxQuantity,volumeByDate,barWidth,minIndex,maxIndex,maLine};
}
