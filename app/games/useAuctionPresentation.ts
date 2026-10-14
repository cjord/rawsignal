"use client";
import {useEffect,useRef,useState} from 'react';
import type {Auction} from '../../core/domain/auction-types';
import {usePreference} from '../state/usePreference';

export function useAuctionReveal(auction:Auction|null,start=true){
 const [progress,setProgress]=useState<{seed:number;count:number}|null>(null);
 const finished=auction?.stage==='result'&&start;
 useEffect(()=>{
  if(!finished||!auction||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
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

export function useAuctionSound(auction:Auction|null,now:number){
 const [sound,setSound]=usePreference<'on'|'muted'>('raw-signal-auction-sound',value=>value==='on'||value==='muted'?value:null,'on');
 const context=useRef<AudioContext|null>(null),last=useRef('');
 const unlock=()=>{try{context.current??=new AudioContext();void context.current.resume().catch(()=>{})}catch{/* Audio is optional. */}};
 useEffect(()=>()=>{void context.current?.close().catch(()=>{})},[]);
 useEffect(()=>{
  const seconds=auction?Math.max(0,Math.ceil((auction.deadline-now)/1000)):0;
  const cue=auction?`${auction.seed}:${auction.round}:${auction.stage}:${auction.stage==='round'&&seconds<=10?seconds:'start'}`:'';
  if(last.current===cue)return;last.current=cue;
  const audio=context.current;
  if(sound==='muted'||!audio||audio.state!=='running'||document.hidden||!auction)return;
  const tick=auction.stage==='round'&&seconds<=10;
  if(auction.stage==='round'&&!tick&&seconds<59)return;
  try{
   const oscillator=audio.createOscillator(),gain=audio.createGain(),start=audio.currentTime;
   oscillator.frequency.setValueAtTime(tick?520:780,start);oscillator.frequency.linearRampToValueAtTime(tick?520:1040,start+.12);
   gain.gain.setValueAtTime(.035,start);gain.gain.exponentialRampToValueAtTime(.001,start+.15);
   oscillator.connect(gain);gain.connect(audio.destination);oscillator.start(start);oscillator.stop(start+.16);
   oscillator.onended=()=>{oscillator.disconnect();gain.disconnect()};
  }catch{/* Sound must never interrupt a bid. */}
 },[auction,now,sound]);
 return {sound,unlock,toggle:()=>{unlock();setSound(sound==='on'?'muted':'on')}};
}
