"use client";
/* eslint-disable @next/next/no-img-element -- decorative, lazy catalog artwork */
import {useEffect,useMemo,useState} from 'react';
import type {AuctionCard} from '../../core/domain/auction-types';
import {auctionBackdropImages} from '../../core/domain/auction-backdrop';

function BackdropImage({src,failed}:{src:string|undefined;failed:()=>void}){
 const [decoded,setDecoded]=useState<string>();
 return <img className={src&&decoded===src?'is-decoded':''} src={src} alt="" width="160" height="224" loading="eager" decoding="async" fetchPriority="low" onLoad={async event=>{const image=event.currentTarget;try{await image.decode();if(image.naturalWidth===400&&image.naturalHeight===570){failed();return}setDecoded(src)}catch{failed()}}} onError={failed}/>;
}

export default function AuctionBackdrop({catalog,seed,lobby=false}:{catalog:(Pick<AuctionCard,'image'>&Partial<Pick<AuctionCard,'rarity'|'section'>>)[];seed?:number;lobby?:boolean;fill?:boolean}){
 const [visitSeed,setVisitSeed]=useState<number|null>(null);
 useEffect(()=>{if(seed===undefined)queueMicrotask(()=>setVisitSeed(crypto.getRandomValues(new Uint32Array(1))[0]))},[seed]);
 const selectedSeed=seed??visitSeed;
 const art=useMemo(()=>selectedSeed===null?[]:auctionBackdropImages(catalog,selectedSeed,36),[catalog,selectedSeed]);
 const [broken,setBroken]=useState<string[]>([]),available=art.filter(src=>!broken.includes(src));
 // Reserve the same eighteen slots before selection/decoding and after failures.
 // Stable keys replace artwork in place instead of shortening the animated group.
 return <div className={`auction-entry-backdrop${lobby?' auction-lobby-backdrop':''}`} aria-hidden="true">{[0,1,2].map(row=><div className="auction-entry-art-lane" key={row}>{[0,1].map(copy=><div className="auction-entry-art-group" key={copy}>{Array.from({length:18},(_,index)=>{const position=(index+row*5)%18,src=available.length?available[position%available.length]:undefined;return <BackdropImage key={index} src={src} failed={()=>{if(src)setBroken(previous=>previous.includes(src)?previous:[...previous,src])}}/>})}</div>)}</div>)}</div>;
}
