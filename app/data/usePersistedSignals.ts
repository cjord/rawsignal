"use client";
/* eslint-disable react-hooks/set-state-in-effect -- remote signal readiness follows the requested market */
import {useEffect,useMemo,useState} from "react";
import type {CatalogDerived} from "../../core/catalog-query.ts";
import type {SealedMarket,SignalSide,SignalStrictness,SinglesGame} from "../../core/domain/types.ts";

type SignalRecord={productId:number;change7Bps:number|null;change30Bps:number|null;low30Cents:number|null;high30Cents:number|null;side:"buy"|"sell";score:number;confidence:"high"|"medium"|"low";reason:string;detail:string;distanceBps:number;cutoffBps:number};
type ResponseBody={ready:boolean;asOfDate?:string;records?:SignalRecord[]};

export function usePersistedSignals(options:{kind:"single"|"sealed";market:SinglesGame|SealedMarket;side:SignalSide;strictness:SignalStrictness}){
 const {kind,market,side,strictness}=options,enabled=side!=="leaderboard",key=`${kind}:${market}:${side}:${strictness}`;
 const [state,setState]=useState<{key:string;resolved:boolean;ready:boolean;derived:Record<number,CatalogDerived>;asOfDate?:string}>({key:"",resolved:false,ready:false,derived:{}});
 useEffect(()=>{
  if(!enabled){setState({key,resolved:true,ready:false,derived:{}});return}
  const controller=new AbortController();setState({key,resolved:false,ready:false,derived:{}});
  // The "all" scope fans out to every game the mode covers and merges; readiness requires
  // every game to be ready — partial coverage would silently hide one game's signals.
  const games=market==="all"?(kind==="single"?["pokemon","riftbound"]:["pokemon","riftbound","onepiece"]):[market];
  Promise.all(games.map(game=>{
   const params=new URLSearchParams({kind,market:game,side,strictness});
   return fetch(`/api/signals?${params}`,{signal:controller.signal}).then(async response=>response.ok?await response.json() as ResponseBody:{ready:false} as ResponseBody);
  })).then(bodies=>{
   if(controller.signal.aborted)return;const derived:Record<number,CatalogDerived>={};
   const ready=bodies.every(body=>body.ready);
   if(ready)for(const body of bodies)for(const row of body.records??[])derived[row.productId]={change7:row.change7Bps==null?null:row.change7Bps/100,change30:row.change30Bps==null?null:row.change30Bps/100,low30:row.low30Cents==null?null:row.low30Cents/100,high30:row.high30Cents==null?null:row.high30Cents/100,signal:{side:row.side,score:row.score,confidence:row.confidence,reason:row.reason,detail:row.detail,distance:row.distanceBps/100,cutoff:row.cutoffBps/100}};
   setState({key,resolved:true,ready,derived,asOfDate:bodies[0]?.asOfDate});
  }).catch(()=>{if(!controller.signal.aborted)setState({key,resolved:true,ready:false,derived:{}})});return()=>controller.abort();
 },[enabled,key,kind,market,side,strictness]);
 return useMemo(()=>state.key===key?state:{key,resolved:false,ready:false,derived:{}},[state,key]);
}
