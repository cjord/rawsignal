"use client";
import {useEffect,useRef,useState,type RefObject} from 'react';
import type {Auction} from '../../core/domain/auction-types';
import {usePreference} from '../state/usePreference';
import {playAuctionSound} from './auction-sound';

export function useAuctionNavigation(arena:RefObject<HTMLDivElement|null>,auction:Auction|null,celebrating:boolean){
 const seed=auction?.seed,round=auction?.round,stage=auction?.stage;
 useEffect(()=>{arena.current?.scrollIntoView({behavior:'instant',block:'start'})},[arena,seed,round]);
 useEffect(()=>{if(stage==='result'&&!celebrating)arena.current?.querySelector('#auction-settled')?.scrollIntoView({behavior:'instant',block:'start'})},[arena,seed,stage,celebrating]);
}

export function useAuctionReveal(auction:Auction|null,start=true){
 const [progress,setProgress]=useState<{seed:number;count:number}|null>(null);
 const finished=auction?.stage==='result'&&start;
 useEffect(()=>{
  if(!finished){const reset=setTimeout(()=>setProgress(null),0);return()=>clearTimeout(reset)}
  if(!auction||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const seed=auction.seed,total=auction.lot.length-auction.known.length;let count=0;
  const timer=window.setInterval(()=>{count++;setProgress(previous=>({seed,count:previous?.seed===seed?Math.max(previous.count,count):count}));if(count>=total)clearInterval(timer)},85);
  return()=>clearInterval(timer);
 },[finished,auction]);
 const reduced=typeof window!=='undefined'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const hidden=auction?.lot.map((_,index)=>index).filter(index=>!auction.known.includes(index))??[];
 const visible=finished&&auction?[...auction.known,...hidden.slice(0,reduced?hidden.length:progress?.seed===auction.seed?progress.count:0)]:auction?.known??[];
 const done=!finished||visible.length===auction?.lot.length;
 return {visible,done,skip:()=>{if(auction)setProgress({seed:auction.seed,count:auction.lot.length})}};
}

export function useAuctionSound(auction:Auction|null,now:number,visibleCount=0){
 const [sound,setSound]=usePreference<'on'|'muted'>('raw-signal-auction-sound',value=>value==='on'||value==='muted'?value:null,'on');
 const context=useRef<AudioContext|null>(null),last=useRef(''),observed=useRef<{seed:number;visible:number;clues:number}|null>(null);
 const unlock=()=>{try{context.current??=new AudioContext();void context.current.resume().catch(()=>{})}catch{/* Audio is optional. */}};
 useEffect(()=>()=>{void context.current?.close().catch(()=>{})},[]);
 useEffect(()=>{
  const previous=observed.current;
  observed.current=auction?{seed:auction.seed,visible:visibleCount,clues:auction.clues.length}:null;
  if(!auction)return;
  const same=previous?.seed===auction.seed;
  if(same&&auction.clues.length>previous.clues)playAuctionSound(context.current,sound==='on','investigation');
  if(visibleCount>(same?previous.visible:0))playAuctionSound(context.current,sound==='on','flip');
 },[auction,visibleCount,sound]);
 useEffect(()=>{
  const seconds=auction?Math.max(0,Math.ceil((auction.deadline-now)/1000)):0;
  const cue=auction?`${auction.seed}:${auction.round}:${auction.stage}:${auction.stage==='round'&&seconds<=10?seconds:'start'}`:'';
  if(last.current===cue)return;last.current=cue;
  if(!auction)return;
  const tick=auction.stage==='round'&&seconds<=10;
  if(auction.stage==='round'&&!tick&&seconds<59)return;
  playAuctionSound(context.current,sound==='on',tick?'tick':'round');
 },[auction,now,sound]);
 return {sound,unlock,toggle:()=>{unlock();setSound(sound==='on'?'muted':'on')}};
}
