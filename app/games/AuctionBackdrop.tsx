"use client";
/* eslint-disable @next/next/no-img-element -- decorative, lazy catalog artwork */
import {useEffect,useMemo,useState} from 'react';
import type {AuctionCard} from '../../core/domain/auction-types';
import {auctionBackdropImages} from '../../core/domain/auction-backdrop';

export default function AuctionBackdrop({catalog,seed,lobby=false}:{catalog:AuctionCard[];seed?:number;lobby?:boolean}){
 const [visitSeed,setVisitSeed]=useState<number|null>(null);
 useEffect(()=>{if(seed===undefined)queueMicrotask(()=>setVisitSeed(crypto.getRandomValues(new Uint32Array(1))[0]))},[seed]);
 const selectedSeed=seed??visitSeed;
 const art=useMemo(()=>selectedSeed===null?[]:auctionBackdropImages(catalog,selectedSeed),[catalog,selectedSeed]);
 const [broken,setBroken]=useState<string[]>([]),working=art.filter(src=>!broken.includes(src));
 return <div className={`auction-entry-backdrop${lobby?' auction-lobby-backdrop':''}`} aria-hidden="true">{[0,1,2].map(row=><div className="auction-entry-art-lane" key={row}>{[0,1].map(copy=><div className="auction-entry-art-group" key={copy}>{working.map((_,index)=>{const src=working[(index+row*5)%working.length];return <img key={src} src={src} alt="" width="160" height="224" loading="eager" decoding="async" fetchPriority="low" onError={()=>setBroken(previous=>previous.includes(src)?previous:[...previous,src])}/>})}</div>)}</div>)}</div>;
}
