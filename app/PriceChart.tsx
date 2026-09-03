"use client";
import {useId,useMemo,useState} from "react";
import {chartGeometry,type ChartOverlay,type ChartVolume} from "./chart-geometry";
import {formatPercent,formatUsd,formatUtcDate} from "../core/domain/formatters";
import type {PricePoint} from "../core/domain/types";

const rangeLabel=(days:7|30|90|365)=>days===365?"1Y":`${days}D`;
// Visible toolbar text follows the site's Title Case label convention; aria strings stay natural language.
const titleCase=(text:string)=>text.replace(/(^|\s)[a-z]/g,match=>match.toUpperCase());

export default function PriceChart({points,volumes,overlays,mainLabel,formatValue=formatUsd,large=false,label="market"}:{points:PricePoint[];volumes?:ChartVolume[];overlays?:ChartOverlay[];mainLabel?:string;formatValue?:(value:number)=>string;large?:boolean;label?:string}){
 const gradientId=useId().replace(/:/g,""),[hovered,setHovered]=useState<number|null>(null),[range,setRange]=useState<7|30|90|365>(30);
 // Geometry is memoized (app/chart-geometry.ts): hover re-renders on every pointer move
 // and used to recompute the whole chart, including the O(n²) trailing mean.
 const geometry=useMemo(()=>points.length<2?null:chartGeometry(points,range,overlays,volumes,large),[points,range,overlays,volumes,large]);
 if(!geometry)return <span className="no-chart">History unavailable</span>;
 const {chartPoints,times,timeSpan,overlays:overlaysShown,min,max,mainMin,mainMax,xy,delta,deltaTone,midDate,line,shownVolumes,maxQuantity,volumeByDate,barWidth,minIndex,maxIndex,maLine}=geometry;
 const active=hovered==null?null:{...chartPoints[hovered],...xy[hovered]};
 const activeQuantity=active?volumeByDate.get(active.date):undefined;
 // Tooltip rows for multi-line charts: every overlay's nearest sample at the cursor time.
 const activeRows=active&&overlaysShown.length?[{label:mainLabel??label,className:"tip-main",value:active.price},...overlaysShown.map(series=>{
  const time=Date.parse(`${active.date}T00:00:00Z`);
  let nearest=series.points[0];for(const point of series.points)if(Math.abs(point.time-time)<Math.abs(nearest.time-time))nearest=point;
  return {label:series.label,className:series.className,value:nearest.price};
 })]:null;
 const move=(event:React.PointerEvent<SVGSVGElement>)=>{const rect=event.currentTarget.getBoundingClientRect(),target=times[0]+Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width))*timeSpan;let nearest=0;for(let i=1;i<times.length;i++)if(Math.abs(times[i]-target)<Math.abs(times[nearest]-target))nearest=i;setHovered(nearest)};
 // The SVG is stretched with preserveAspectRatio="none", which turns viewBox circles into
 // ellipses; markers and the cursor tooltip render as HTML positioned by percentage instead.
 const pctX=(x:number)=>`${((x/240)*100).toFixed(2)}%`,pctY=(y:number)=>`${((y/76)*100).toFixed(2)}%`;
 const tipEdge=active==null?"center":active.x<45?"left":active.x>195?"right":"center";
 return <div className={`chart-wrap ${large?"chart-large":""}${deltaTone?` chart-${deltaTone}`:""}`}>
  <div className="chart-toolbar"><div className={`chart-readout ${active?"visible":""}`}>{active?<><b>{formatValue(active.price)}</b><span>{formatUtcDate(active.date,true)}{activeQuantity!=null&&` · ${activeQuantity} sold`}</span></>:<><span>{rangeLabel(range)} {titleCase(`${label} history`)}</span>{delta!=null&&<b className={`chart-delta ${deltaTone}`}>{formatPercent(delta)}</b>}</>}</div><div className="chart-ranges" role="group" aria-label="Chart range">{([7,30,90,365] as const).map(days=><button key={days} className={range===days?"active":""} onClick={event=>{event.preventDefault();setRange(days)}}>{rangeLabel(days)}</button>)}</div></div>
  <div className="chart-canvas"><span className="axis axis-high">{formatValue(max)}</span><div className="chart-plot"><svg className="sparkline" viewBox="0 0 240 76" preserveAspectRatio="none" role="img" aria-label={active?`${formatValue(active.price)} on ${active.date}`:`${rangeLabel(range)} ${label} price history, ${delta==null?"movement unavailable":`${formatPercent(delta)} over the range`}`} onPointerMove={move} onPointerLeave={()=>setHovered(null)} onClick={event=>event.preventDefault()}>
   <defs><linearGradient id={`chart-fill-${gradientId}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--chart-line,var(--blue))" stopOpacity=".24"/><stop offset="1" stopColor="var(--chart-line,var(--blue))" stopOpacity="0"/></linearGradient></defs>
   <polygon className="chart-area" fill={`url(#chart-fill-${gradientId})`} points={`${xy[0].x},76 ${line} ${xy.at(-1)!.x},76`}/>
   {maxQuantity>0&&shownVolumes.map(bucket=><rect key={bucket.date} className="chart-volume" x={Math.max(0,Math.min(240-barWidth,((bucket.time-times[0])/timeSpan)*240-barWidth/2))} y={76-(bucket.quantity/maxQuantity)*15-1} width={barWidth} height={(bucket.quantity/maxQuantity)*15+1}/>)}
   {maLine&&<polyline className="chart-ma" points={maLine}/>}
   {overlaysShown.map(series=><polyline key={series.label} className={series.className} points={series.line}/>)}
   <polyline points={line}/>
   {active&&<line className="chart-cursor" x1={active.x} x2={active.x} y1="2" y2="74"/>}
  </svg>
  {mainMax>mainMin&&<><span className="chart-dot chart-dot-extreme" style={{left:pctX(xy[maxIndex].x),top:pctY(xy[maxIndex].y)}} title={`Range high ${formatValue(mainMax)}`} aria-hidden="true"/><span className="chart-dot chart-dot-extreme" style={{left:pctX(xy[minIndex].x),top:pctY(xy[minIndex].y)}} title={`Range low ${formatValue(mainMin)}`} aria-hidden="true"/></>}
  <span className="chart-dot chart-dot-end" style={{left:pctX(xy.at(-1)!.x),top:pctY(xy.at(-1)!.y)}} aria-hidden="true"/>
  {active&&<span className="chart-dot chart-dot-active" style={{left:pctX(active.x),top:pctY(active.y)}} aria-hidden="true"/>}
  {active&&<div className={`chart-tip edge-${tipEdge}${active.y<20?" flip-below":""}${activeRows?" chart-tip-multi":""}`} style={{left:pctX(active.x),top:pctY(active.y)}} aria-hidden="true">{activeRows?<><span className="tip-date">{formatUtcDate(active.date,true)}</span>{activeRows.map(row=><span key={row.label} className={`tip-row ${row.className}`}><i aria-hidden="true"/>{row.label}<b>{formatValue(row.value)}</b></span>)}</>:<><b>{formatValue(active.price)}</b><span>{formatUtcDate(active.date,true)}{activeQuantity!=null&&` · ${activeQuantity} sold`}</span></>}</div>}
  </div><span className="axis axis-low">{formatValue(min)}</span>{large&&<span className="axis axis-price-mid">{formatValue((min+max)/2)}</span>}<span className="axis axis-date-start">{formatUtcDate(chartPoints[0].date)}</span>{large&&<span className="axis axis-date-mid">{formatUtcDate(midDate)}</span>}<span className="axis axis-date-end">{formatUtcDate(chartPoints.at(-1)!.date)}</span></div>
 </div>;
}
