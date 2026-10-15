"use client";
import {useEffect,useState} from 'react';
import type {Auction,AuctionSave} from '../../core/domain/auction-types';
import {nextAuctionRound} from '../../core/domain/auction-engine';
import {usePreference} from '../state/usePreference';

export function useAuctionAutoAdvance(auction:Auction|null,now:number,transact:(update:(save:AuctionSave)=>AuctionSave)=>void){
 const [setting,setSetting]=usePreference('raw-signal-auction-auto-advance',value=>value==='on'||value==='off'?value:null,'off');
 const [review,setReview]=useState<{key:string;deadline:number}|null>(null);
 const key=auction?.stage==='reveal'?`${auction.seed}:${auction.round}`:null,enabled=setting==='on';
 useEffect(()=>{
  if(!enabled||!key)return;
  const deadline=Date.now()+20000;
  const start=window.setTimeout(()=>setReview({key,deadline}),0);
  const timer=window.setTimeout(()=>transact(current=>{
   const active=current.auction;
   return active?.stage==='reveal'&&`${active.seed}:${active.round}`===key?nextAuctionRound(current,Date.now()):current;
  }),20000);
  return()=>{clearTimeout(start);clearTimeout(timer)};
 },[enabled,key,transact]);
 return {enabled,toggle:()=>setSetting(enabled?'off':'on'),seconds:enabled&&key?Math.max(0,Math.min(20,Math.ceil(((review?.key===key?review.deadline:now+20000)-now)/1000))):null};
}
