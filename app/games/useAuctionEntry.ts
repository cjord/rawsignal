"use client";
import {useEffect,useRef,useState} from 'react';
import type {AuctionCard,AuctionKind,AuctionSave} from '../../core/domain/auction-types';
import {beginAuction} from '../../core/domain/auction-engine';
import {prepareAuctionLot} from '../data/auction-images';
import {createPriceGameImageLoader} from '../data/price-game-images';
import {auctionMarketPrior} from '../../core/domain/auction-market-prior';
import {auctionNpcRoster} from '../../core/domain/auction-npcs';

export const AUCTION_INTRO_MS=7000;
export type AuctionEntry={seed:number;kind:AuctionKind;rivals?:string[]};
export function useAuctionEntry(catalog:AuctionCard[],transact:(update:(save:AuctionSave)=>AuctionSave)=>AuctionSave|null,unlock:()=>void,checkMarket?:()=>Promise<AuctionCard[]|null>){
 const [entry,setEntry]=useState<AuctionEntry|null>(null),[imageError,setImageError]=useState(''),[checking,setChecking]=useState(false),checkingRef=useRef(false),mounted=useRef(true);
 const loader=useRef(createPriceGameImageLoader()),pending=useRef<AbortController|null>(null),finishIntro=useRef<(()=>void)|null>(null);
 const cancel=()=>{pending.current?.abort();pending.current=null;finishIntro.current?.();finishIntro.current=null;setEntry(null)};
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;pending.current?.abort();pending.current=null;finishIntro.current?.();finishIntro.current=null}},[]);
 const enter=async(kind:AuctionKind)=>{
  if(pending.current||checkingRef.current)return;
  unlock();let poolCatalog=catalog;
  const existing=transact(current=>current);if(!existing||existing.auction)return;
  if(checkMarket&&!existing.drafts?.[kind]){
   checkingRef.current=true;setChecking(true);
   try{const latest=await checkMarket();if(!mounted.current)return;if(!latest){setImageError('No valid market prices are available yet. Retry the price check.');return}poolCatalog=latest}catch{if(mounted.current)setImageError('Market prices could not be checked. Please retry.');return}finally{checkingRef.current=false;if(mounted.current)setChecking(false)}
  }
  if(!mounted.current)return;
  const saved=transact(current=>{
   if(current.auction||current.drafts?.[kind])return current;
   const seed=crypto.getRandomValues(new Uint32Array(1))[0],pool=poolCatalog.filter(card=>/^https?:\/\//.test(card.image)).map(card=>({...card}));
   if(pool.length<6)return current;
   return {...current,drafts:{...current.drafts,[kind]:{seed,kind,pool,marketPrior:auctionMarketPrior(pool,seed,kind),rivals:auctionNpcRoster(seed).map(profile=>profile.name)}}};
  });
  const draft=saved?.drafts?.[kind];if(!draft||saved?.auction)return;
  unlock();const controller=new AbortController();pending.current=controller;
  const seed=draft.seed;setEntry({seed,kind,rivals:draft.rivals});setImageError('');
  const intro=new Promise<void>(resolve=>{finishIntro.current=resolve});
  const duration=window.matchMedia('(prefers-reduced-motion: reduce)').matches?400:AUCTION_INTRO_MS;
  const completeIntro=finishIntro.current!;
  const timer=window.setTimeout(completeIntro,duration);
  try{
   const prepare=async()=>{
    if(draft.lot)return draft.lot;
    const lot=await prepareAuctionLot(draft.pool??catalog,loader.current,seed,kind,controller.signal);
    if(!controller.signal.aborted&&lot.length)transact(current=>current.drafts?.[kind]?.seed===seed?{...current,drafts:{...current.drafts,[kind]:{seed,kind,lot,marketPrior:draft.marketPrior,rivals:draft.rivals}}}:current);
    return lot;
   };
   const [lot]=await Promise.all([prepare(),intro]);
   if(controller.signal.aborted)return;
   if(lot.length)transact(current=>current.drafts?.[kind]?.seed===seed?beginAuction(current,catalog,Date.now(),current.drafts[kind]!.lot??lot,seed,kind):current);
   else setImageError('Auctions are temporarily unavailable. Your balance has not changed. Refresh the market to check availability.');
  }catch{
   if(!controller.signal.aborted)setImageError('Auction preparation could not finish. Your balance has not changed. Please retry.');
  }finally{
   window.clearTimeout(timer);
   if(pending.current===controller){pending.current=null;finishIntro.current=null;setEntry(null)}
  }
 };
 return {entry,checking,imageError,enter,cancel,skip:()=>finishIntro.current?.()};
}
