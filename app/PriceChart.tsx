"use client";
import {useState} from "react";
import {formatUsd,formatUtcDate} from "./domain/formatters";
import type {PricePoint} from "./domain/types";

export default function PriceChart({points,large=false,label="market"}:{points:PricePoint[];large?:boolean;label?:string}){
 const [hovered,setHovered]=useState<number|null>(null),[range,setRange]=useState<7|30|90>(30);
 if(points.length<2)return <span className="no-chart">History unavailable</span>;
 const cutoff=new Date(`${points.at(-1)!.date}T00:00:00Z`);cutoff.setUTCDate(cutoff.getUTCDate()-range);
 const shown=points.filter(point=>new Date(`${point.date}T00:00:00Z`)>=cutoff),chartPoints=shown.length>1?shown:points;
 const values=chartPoints.map(point=>point.price),times=chartPoints.map(point=>Date.parse(`${point.date}T00:00:00Z`)),min=Math.min(...values),max=Math.max(...values),span=max-min||1,timeSpan=times.at(-1)!-times[0]||1;
 const xy=chartPoints.map((point,index)=>({x:((times[index]-times[0])/timeSpan)*240,y:70-((point.price-min)/span)*62})),active=hovered==null?null:{...chartPoints[hovered],...xy[hovered]};
 const move=(event:React.PointerEvent<SVGSVGElement>)=>{const rect=event.currentTarget.getBoundingClientRect(),target=times[0]+Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width))*timeSpan;let nearest=0;for(let i=1;i<times.length;i++)if(Math.abs(times[i]-target)<Math.abs(times[nearest]-target))nearest=i;setHovered(nearest)};
 return <div className={`chart-wrap ${large?"chart-large":""}`}>
  <div className="chart-toolbar"><div className={`chart-readout ${active?"visible":""}`}>{active?<><b>{formatUsd(active.price)}</b><span>{formatUtcDate(active.date,true)}</span></>:<span>{range}-day {label} history</span>}</div><div className="chart-ranges" role="group" aria-label="Chart range">{([7,30,90] as const).map(days=><button key={days} className={range===days?"active":""} onClick={event=>{event.preventDefault();setRange(days)}}>{days===90?"90D":`${days}D`}</button>)}</div></div>
  <div className="chart-canvas"><span className="axis axis-high">{formatUsd(max)}</span><svg className="sparkline" viewBox="0 0 240 76" preserveAspectRatio="none" role="img" aria-label={active?`${formatUsd(active.price)} on ${active.date}`:`${range}-day ${label} price history`} onPointerMove={move} onPointerLeave={()=>setHovered(null)} onClick={event=>event.preventDefault()}><polyline points={xy.map(point=>`${point.x},${point.y}`).join(" ")}/>{active&&<><line className="chart-cursor" x1={active.x} x2={active.x} y1="2" y2="74"/><circle className="chart-point" cx={active.x} cy={active.y} r="3.5"/></>}</svg><span className="axis axis-low">{formatUsd(min)}</span><span className="axis axis-date-start">{formatUtcDate(chartPoints[0].date)}</span><span className="axis axis-date-end">{formatUtcDate(chartPoints.at(-1)!.date)}</span></div>
 </div>;
}
