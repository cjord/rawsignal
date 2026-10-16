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
 return <div className={`auction-entry-backdrop${lobby?' auction-lobby-backdrop':''}`} aria-hidden="true">{[0,1].map(row=><div className="auction-entry-art-lane" key={row}>{[...art,...art].map((src,index)=><img key={`${index}-${src}`} src={src} alt="" width="160" height="224" loading="lazy" decoding="async" fetchPriority="low" onError={event=>event.currentTarget.style.visibility='hidden'}/>)}</div>)}</div>;
}
