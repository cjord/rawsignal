"use client";
/* eslint-disable @next/next/no-img-element -- external TCGplayer CDN images use a custom data-first loader */
import { useEffect, useRef, useState } from "react";

// `fallback` (2026-09-04): a second source tried once when `src` fails to load — the TCGdex
// scan for Pokémon cards (app/data/card-images.ts). Only after both fail does the tile read
// "Image unavailable". TCGplayer's CDN answers a product it has no photo for with a 200
// placeholder JPEG (400×570, or 200×285 for the 200w variant) rather than an error, so a
// loaded CDN image of exactly that size counts as a failure too.
type Props={src?:string|null;fallback?:string|null;alt:string;className?:string};

const TCGPLAYER_CDN=/^https:\/\/tcgplayer-cdn\.tcgplayer\.com\//;
export const isTcgplayerPlaceholder=(image:{currentSrc?:string;src:string;naturalWidth:number;naturalHeight:number})=>TCGPLAYER_CDN.test(image.currentSrc||image.src)&&((image.naturalWidth===400&&image.naturalHeight===570)||(image.naturalWidth===200&&image.naturalHeight===285));

export default function DeferredImage({src,fallback=null,alt,className=""}:Props){
 const host=useRef<HTMLSpanElement>(null),[near,setNear]=useState(false),[idle,setIdle]=useState(false),[loaded,setLoaded]=useState(false),[failed,setFailed]=useState(false),[useFallback,setUseFallback]=useState(false);
 const current=useFallback?fallback:src;
 const onError=()=>{if(!useFallback&&fallback&&fallback!==src){setUseFallback(true);return}setFailed(true)};
 const onLoad=(event:React.SyntheticEvent<HTMLImageElement>)=>{if(isTcgplayerPlaceholder(event.currentTarget)){onError();return}setLoaded(true)};
 useEffect(()=>{const node=host.current;if(!node)return;const connection=(navigator as Navigator&{connection?:{saveData?:boolean}}).connection;const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){setNear(true);observer.disconnect()}},{rootMargin:connection?.saveData?"0px":"280px"});observer.observe(node);return()=>observer.disconnect()},[]);
 useEffect(()=>{let idleId:number|undefined,timeoutId:number|undefined,cancelled=false;const queue=()=>{requestAnimationFrame(()=>{if(cancelled)return;if("requestIdleCallback" in window)idleId=window.requestIdleCallback(()=>setIdle(true),{timeout:1200});else timeoutId=Number(setTimeout(()=>setIdle(true),80))})};if(document.readyState==="complete")queue();else window.addEventListener("load",queue,{once:true});return()=>{cancelled=true;window.removeEventListener("load",queue);if(idleId!==undefined&&"cancelIdleCallback" in window)window.cancelIdleCallback(idleId);if(timeoutId!==undefined)clearTimeout(timeoutId)}},[]);
 return <span ref={host} className={`deferred-image ${loaded?"is-loaded":""} ${!current||failed?"is-empty":""} ${className}`}>{current&&near&&idle&&!failed&&<img key={current} src={current} alt={alt} loading="lazy" decoding="async" fetchPriority="low" onLoad={onLoad} onError={onError}/>} {(!current||failed)&&<span className="image-fallback" aria-label={alt||"Card image unavailable"}>Image<br/>unavailable</span>}</span>;
}
