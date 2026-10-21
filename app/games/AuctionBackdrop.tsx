"use client";
/* eslint-disable @next/next/no-img-element -- decorative, lazy catalog artwork */
import {useEffect,useMemo,useState} from 'react';
import type {AuctionCard} from '../../core/domain/auction-types';
import {auctionBackdropImages} from '../../core/domain/auction-backdrop';

function BackdropImage({src,failed}:{src:string;failed:()=>void}){
 const [ready,setReady]=useState(false);
 return <img className={ready?'is-decoded':''} src={src} alt="" width="160" height="224" loading="eager" decoding="async" fetchPriority="low" onLoad={async event=>{const image=event.currentTarget;try{await image.decode();if(image.naturalWidth===400&&image.naturalHeight===570){failed();return}setReady(true)}catch{failed()}}} onError={failed}/>;
}

export default function AuctionBackdrop({catalog,seed,lobby=false,fill=false}:{catalog:(Pick<AuctionCard,'image'>&Partial<Pick<AuctionCard,'rarity'|'section'>>)[];seed?:number;lobby?:boolean;fill?:boolean}){
 const [visitSeed,setVisitSeed]=useState<number|null>(null);
 useEffect(()=>{if(seed===undefined)queueMicrotask(()=>setVisitSeed(crypto.getRandomValues(new Uint32Array(1))[0]))},[seed]);
 const selectedSeed=seed??visitSeed;
 const art=useMemo(()=>selectedSeed===null?[]:auctionBackdropImages(catalog,selectedSeed),[catalog,selectedSeed]);
 const [broken,setBroken]=useState<string[]>([]),available=art.filter(src=>!broken.includes(src)),working=fill&&available.length?Array.from({length:Math.max(18,available.length)},(_,index)=>available[index%available.length]):available;
 return <div className={`auction-entry-backdrop${lobby?' auction-lobby-backdrop':''}`} aria-hidden="true">{[0,1,2].map(row=><div className="auction-entry-art-lane" key={row}>{[0,1].map(copy=><div className="auction-entry-art-group" key={copy}>{working.map((_,index)=>{const src=working[(index+row*5)%working.length];return <BackdropImage key={`${src}-${index}`} src={src} failed={()=>setBroken(previous=>previous.includes(src)?previous:[...previous,src])}/>})}</div>)}</div>)}</div>;
}
