"use client";
/* eslint-disable @next/next/no-img-element -- reused catalog art and optimized local portraits */
import {useEffect,useMemo,useRef,useState} from 'react';
import {AUCTION_LOT_THEMES,auctionLotTheme} from '../../core/domain/auction-lot-themes';
import {AUCTION_NPCS,auctionNpcRoster} from '../../core/domain/auction-npcs';
import type {AuctionCard} from '../../core/domain/auction-types';
import {AUCTION_INTRO_MS,type AuctionEntry} from './useAuctionEntry';
import AuctionBidder from './AuctionBidder';

export default function AuctionEntryReveal({entry,catalog,cancel,skip}:{entry:AuctionEntry;catalog:AuctionCard[];cancel:()=>void;skip:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),[ticks,setElapsed]=useState(0);
 const reduced=typeof window!=='undefined'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches,elapsed=reduced?AUCTION_INTRO_MS:ticks;
 const theme=auctionLotTheme(entry.seed),rivals=auctionNpcRoster(entry.seed,entry.rivals),settled=elapsed>=1600;
 const art=useMemo(()=>[...new Set(catalog.filter(card=>card.image.trim()).map(card=>card.image))].slice(0,10),[catalog]);
 useEffect(()=>{
  dialog.current?.showModal();const started=Date.now(),timer=window.setInterval(()=>setElapsed(Date.now()-started),100);
  return()=>window.clearInterval(timer);
 },[]);
 const visibleTheme=settled?theme:AUCTION_LOT_THEMES[Math.floor(elapsed/110)%AUCTION_LOT_THEMES.length];
 return <dialog ref={dialog} className="auction-entry-stage" aria-labelledby="auction-entry-title" onCancel={event=>{event.preventDefault();cancel()}}>
  <div className="auction-entry-backdrop" aria-hidden="true">{[0,1].map(row=><div className="auction-entry-art-lane" key={row}>{[...art,...art].map((src,index)=><img key={`${index}-${src}`} src={src} alt="" width="160" height="224" onError={event=>event.currentTarget.style.visibility='hidden'}/>)}</div>)}</div>
  <section className="auction-entry-briefing"><div className="auction-entry-top"><span className="games-eyebrow">{entry.kind==='paid'?'Paid Auction':'Free Auction'} · Preparing Your Table</span><button className="game-control" type="button" onClick={cancel}>Cancel</button></div>
   <h2 id="auction-entry-title">Your Next Auction</h2><p className="auction-entry-status" role="status">Starting Auction… {elapsed>=AUCTION_INTRO_MS?'Checking card artwork…':settled?'Meeting your rivals.':'Finding your collection.'}</p>
   <div className={`auction-entry-theme${settled?' is-locked':''}`}><small>Collection</small><strong data-collection-theme={visibleTheme.id} aria-hidden="true">{visibleTheme.collectionName}</strong><span className="sr-only" aria-live="polite">{settled?theme.collectionName:'Selecting collection type'}</span></div>
   <div className="auction-entry-rivals" aria-label="Your opponents">{rivals.map((npc,index)=>{
    const locked=elapsed>=2400+index*650,placeholder=AUCTION_NPCS[(Math.floor(elapsed/130)+index*3)%AUCTION_NPCS.length];
    return <div key={npc.name} className={locked?'is-locked':''}><span aria-hidden="true"><AuctionBidder name={locked?npc.name:placeholder.name}/></span><small>{locked?npc.strategy:`Choosing Rival ${index+1}`}</small><span className="sr-only">{locked?npc.name:'Selecting rival'}</span></div>;
   })}</div>
   <div className="auction-entry-progress" role="progressbar" aria-label="Auction introduction" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100,Math.round(elapsed/AUCTION_INTRO_MS*100))}><span style={{width:`${Math.min(100,elapsed/AUCTION_INTRO_MS*100)}%`}}/></div>
   <div className="auction-entry-bottom"><p>Entry is charged and the round timer starts only when your collection is ready. Cancel keeps this auction for your return.</p><button className="game-control" type="button" onClick={skip}>Skip Intro</button></div>
  </section>
 </dialog>;
}
