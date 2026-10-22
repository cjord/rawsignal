"use client";
/* eslint-disable @next/next/no-img-element -- decorative, lazy catalog artwork */
import {useEffect,useMemo,useState} from 'react';
import type {AuctionCard} from '../../core/domain/auction-types';
import {auctionBackdropImages,auctionBackdropSlots,auctionBackdropThumbnail} from '../../core/domain/auction-backdrop';
import {isTcgplayerPlaceholder} from '../../core/domain/image-availability';

function BackdropImage({src,failed}:{src:string|undefined;failed:()=>void}){
 const [decoded,setDecoded]=useState<string>(),[original,setOriginal]=useState<string>();
 const current=src&&(original===src?src:auctionBackdropThumbnail(src));
 const reject=()=>{if(current&&current!==src)setOriginal(src);else failed()};
 return <img className={current&&decoded===current?'is-decoded':''} src={current} alt="" width="160" height="224" loading="lazy" decoding="async" fetchPriority="low" onLoad={async event=>{const image=event.currentTarget;try{await image.decode();if(isTcgplayerPlaceholder(image)||(image.naturalWidth===400&&image.naturalHeight===570)){reject();return}setDecoded(current)}catch{reject()}}} onError={reject}/>;
}

export default function AuctionBackdrop({catalog,seed,lobby=false}:{catalog:(Pick<AuctionCard,'image'>&Partial<Pick<AuctionCard,'rarity'|'section'>>)[];seed?:number;lobby?:boolean;fill?:boolean}){
 const [visitSeed,setVisitSeed]=useState<number|null>(null);
 const [slots,setSlots]=useState(9);
 useEffect(()=>{let frame=0;const resize=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>setSlots(auctionBackdropSlots(window.innerWidth)))};resize();window.addEventListener('resize',resize);return()=>{cancelAnimationFrame(frame);window.removeEventListener('resize',resize)}},[]);
 useEffect(()=>{if(seed===undefined)queueMicrotask(()=>setVisitSeed(crypto.getRandomValues(new Uint32Array(1))[0]))},[seed]);
 const selectedSeed=seed??visitSeed;
 const art=useMemo(()=>selectedSeed===null?[]:auctionBackdropImages(catalog,selectedSeed,36),[catalog,selectedSeed]);
 const [broken,setBroken]=useState<string[]>([]),available=art.filter(src=>!broken.includes(src));
 // Reserve the viewport budget before selection/decoding and after failures.
 // Stable keys replace artwork in place instead of shortening the animated group.
 // Repeated slots share at most eighteen artworks, even on very wide displays.
 // Remaining sampled images are replacement candidates, not extra downloads.
 return <div className={`auction-entry-backdrop${lobby?' auction-lobby-backdrop':''}`} aria-hidden="true">{[0,1,2].map(row=><div className="auction-entry-art-lane" key={row}>{[0,1].map(copy=><div className="auction-entry-art-group" key={copy}>{Array.from({length:slots},(_,index)=>{const position=(index+row*5)%18,src=available.length?available[position%available.length]:undefined;return <BackdropImage key={index} src={src} failed={()=>{if(src)setBroken(previous=>previous.includes(src)?previous:[...previous,src])}}/>})}</div>)}</div>)}</div>;
}
