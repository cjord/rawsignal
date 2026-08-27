"use client";
import {useId,useState} from "react";
import {formatPercent,formatUsd,formatUtcDate} from "./domain/formatters";
import type {PricePoint} from "./domain/types";

const rangeLabel=(days:7|30|90|365)=>days===365?"1Y":`${days}D`;

export default function PriceChart({points,large=false,label="market"}:{points:PricePoint[];large?:boolean;label?:string}){
 const gradientId=useId().replace(/:/g,""),[hovered,setHovered]=useState<number|null>(null),[range,setRange]=useState<7|30|90|365>(30);
 if(points.length<2)return <span className="no-chart">History unavailable</span>;
 const cutoff=new Date(`${points.at(-1)!.date}T00:00:00Z`);cutoff.setUTCDate(cutoff.getUTCDate()-range);
 const shown=points.filter(point=>new Date(`${point.date}T00:00:00Z`)>=cutoff),chartPoints=shown.length>1?shown:points;
 const values=chartPoints.map(point=>point.price),times=chartPoints.map(point=>Date.parse(`${point.date}T00:00:00Z`)),min=Math.min(...values),max=Math.max(...values),span=max-min||1,timeSpan=times.at(-1)!-times[0]||1;
 const xy=chartPoints.map((point,index)=>({x:((times[index]-times[0])/timeSpan)*240,y:70-((point.price-min)/span)*62})),active=hovered==null?null:{...chartPoints[hovered],...xy[hovered]};
 const first=values[0],last=values.at(-1)!,delta=first?((last-first)/first)*100:null,deltaTone=delta==null||delta===0?"":delta>0?"up":"down";
 const midDate=chartPoints[Math.floor(chartPoints.length/2)].date,line=xy.map(point=>`${point.x},${point.y}`).join(" ");
 const move=(event:React.PointerEvent<SVGSVGElement>)=>{const rect=event.currentTarget.getBoundingClientRect(),target=times[0]+Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width))*timeSpan;let nearest=0;for(let i=1;i<times.length;i++)if(Math.abs(times[i]-target)<Math.abs(times[nearest]-target))nearest=i;setHovered(nearest)};
 return <div className={`chart-wrap ${large?"chart-large":""}`}>
  <div className="chart-toolbar"><div className={`chart-readout ${active?"visible":""}`}>{active?<><b>{formatUsd(active.price)}</b><span>{formatUtcDate(active.date,true)}</span></>:<><span>{rangeLabel(range)} {label} history</span>{delta!=null&&<b className={`chart-delta ${deltaTone}`}>{formatPercent(delta)}</b>}</>}</div><div className="chart-ranges" role="group" aria-label="Chart range">{([7,30,90,365] as const).map(days=><button key={days} className={range===days?"active":""} onClick={event=>{event.preventDefault();setRange(days)}}>{rangeLabel(days)}</button>)}</div></div>
  <div className="chart-canvas"><span className="axis axis-high">{formatUsd(max)}</span><svg className="sparkline" viewBox="0 0 240 76" preserveAspectRatio="none" role="img" aria-label={active?`${formatUsd(active.price)} on ${active.date}`:`${rangeLabel(range)} ${label} price history, ${delta==null?"movement unavailable":`${formatPercent(delta)} over the range`}`} onPointerMove={move} onPointerLeave={()=>setHovered(null)} onClick={event=>event.preventDefault()}>
   <defs><linearGradient id={`chart-fill-${gradientId}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--blue)" stopOpacity=".26"/><stop offset="1" stopColor="var(--blue)" stopOpacity="0"/></linearGradient></defs>
   <polygon className="chart-area" fill={`url(#chart-fill-${gradientId})`} points={`${xy[0].x},76 ${line} ${xy.at(-1)!.x},76`}/>
   <polyline points={line}/>
   <circle className="chart-end" cx={xy.at(-1)!.x} cy={xy.at(-1)!.y} r="3"/>
   {active&&<><line className="chart-cursor" x1={active.x} x2={active.x} y1="2" y2="74"/><circle className="chart-point" cx={active.x} cy={active.y} r="3.5"/></>}
  </svg><span className="axis axis-low">{formatUsd(min)}</span>{large&&<span className="axis axis-price-mid">{formatUsd((min+max)/2)}</span>}<span className="axis axis-date-start">{formatUtcDate(chartPoints[0].date)}</span>{large&&<span className="axis axis-date-mid">{formatUtcDate(midDate)}</span>}<span className="axis axis-date-end">{formatUtcDate(chartPoints.at(-1)!.date)}</span></div>
 </div>;
}
