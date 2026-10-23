"use client";
/* eslint-disable @next/next/no-img-element -- decorative catalog artwork, decoded in a bounded low-priority queue */
import {useEffect,useMemo,useRef,useState,useSyncExternalStore,type CSSProperties} from 'react';
import type {AuctionCard} from '../../core/domain/auction-types';
import {auctionBackdropImages,auctionBackdropSlots} from '../../core/domain/auction-backdrop';
import {createBackdropArtwork} from '../data/auction-backdrop-artwork';
import {useBackdropPhase} from './useBackdropPhase';

export default function AuctionBackdrop({catalog,seed,lobby=false}:{catalog:(Pick<AuctionCard,'image'>&Partial<Pick<AuctionCard,'rarity'|'section'>>)[];seed?:number;lobby?:boolean;fill?:boolean}){
 const [visitSeed,setVisitSeed]=useState<number|null>(null);
 const [slots,setSlots]=useState(9);
 useEffect(()=>{let frame=0;const resize=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>setSlots(auctionBackdropSlots(window.innerWidth)))};resize();window.addEventListener('resize',resize);return()=>{cancelAnimationFrame(frame);window.removeEventListener('resize',resize)}},[]);
 useEffect(()=>{if(seed===undefined)queueMicrotask(()=>setVisitSeed(crypto.getRandomValues(new Uint32Array(1))[0]))},[seed]);
 const selectedSeed=seed??visitSeed;
 const art=useMemo(()=>selectedSeed===null?[]:auctionBackdropImages(catalog,selectedSeed,36),[catalog,selectedSeed]);
 const selection=JSON.stringify(art),resources=useMemo(()=>createBackdropArtwork(JSON.parse(selection) as string[]),[selection]);
 const sources=useSyncExternalStore(resources.subscribe,resources.getSnapshot,resources.getServerSnapshot),root=useRef<HTMLDivElement>(null);
 useEffect(()=>{resources.start();return resources.stop},[resources]);
 useEffect(()=>resources.activate([0,1,2].flatMap(row=>Array.from({length:slots},(_,index)=>(index+row*5)%18))),[resources,slots]);
 useBackdropPhase(root);
 // Stable logical assignments and shared decoded resources: a failed source can
 // replace its own slots/twins, never compact or reorder healthy artwork.
 return <div ref={root} className={`auction-entry-backdrop${lobby?' auction-lobby-backdrop':''}`} style={{'--auction-backdrop-slots':slots} as CSSProperties} aria-hidden="true">{[0,1,2].map(row=><div className="auction-entry-art-lane" key={row}>{[0,1].map(copy=><div className="auction-entry-art-group" key={copy}>{Array.from({length:slots},(_,index)=>{const position=(index+row*5)%18,src=sources[position];return <img key={index} data-art-slot={position} className={src?'is-decoded':''} src={src??undefined} alt="" width="160" height="224" decoding="async" fetchPriority="low" onError={()=>{if(src)resources.reject(position,src)}}/>})}</div>)}</div>)}</div>;
}
