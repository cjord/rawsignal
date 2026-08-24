"use client";
import { useEffect, useRef, useState } from "react";

type Props={src:string;alt:string;className?:string};

export default function DeferredImage({src,alt,className=""}:Props){
 const host=useRef<HTMLSpanElement>(null),[near,setNear]=useState(false),[idle,setIdle]=useState(false),[loaded,setLoaded]=useState(false);
 useEffect(()=>{const node=host.current;if(!node)return;const connection=(navigator as Navigator&{connection?:{saveData?:boolean}}).connection;const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){setNear(true);observer.disconnect()}},{rootMargin:connection?.saveData?"0px":"280px"});observer.observe(node);return()=>observer.disconnect()},[]);
 useEffect(()=>{let idleId:number|undefined,timeoutId:number|undefined,cancelled=false;const queue=()=>{requestAnimationFrame(()=>{if(cancelled)return;if("requestIdleCallback" in window)idleId=window.requestIdleCallback(()=>setIdle(true),{timeout:1200});else timeoutId=window.setTimeout(()=>setIdle(true),80)})};if(document.readyState==="complete")queue();else window.addEventListener("load",queue,{once:true});return()=>{cancelled=true;window.removeEventListener("load",queue);if(idleId!==undefined&&"cancelIdleCallback" in window)window.cancelIdleCallback(idleId);if(timeoutId!==undefined)window.clearTimeout(timeoutId)}},[]);
 return <span ref={host} className={`deferred-image ${loaded?"is-loaded":""} ${className}`}>{near&&idle&&<img src={src} alt={alt} loading="lazy" decoding="async" fetchPriority="low" onLoad={()=>setLoaded(true)}/>}</span>;
}
