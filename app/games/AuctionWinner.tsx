"use client";
import {useEffect,useState,type CSSProperties} from 'react';
import type {Auction} from '../../core/domain/auction-types';
import AuctionBidder from './AuctionBidder';
import {auctionUsd} from './AuctionWallet';

export function useAuctionWinner(auction:Auction|null){
 const [presentation,setPresentation]=useState<{seed:number;ready:boolean}|null>(null);
 const seed=auction?.seed,stage=auction?.stage;
 useEffect(()=>{
  if(seed===undefined)return;
  if(stage==='round'){const timer=setTimeout(()=>setPresentation({seed,ready:false}),0);return()=>clearTimeout(timer)}
  if(stage==='result'){const timer=setTimeout(()=>setPresentation({seed,ready:true}),1600);return()=>clearTimeout(timer)}
 },[seed,stage]);
 // A saved finished auction opens directly on results, without replaying a celebration.
 return stage==='result'&&presentation!==null&&presentation.seed===seed&&!presentation.ready;
}
export default function AuctionWinner({auction}:{auction:Auction}){
 const result=auction.result!,won=result.winner==='You';
 return <section className="detail-section auction-winner" role="status"><span className="games-eyebrow">{result.buyout?'Early Buyout':'Final Auction'}</span><h2>Winner Announced</h2>{result.winner?<><AuctionBidder name={result.winner}/><p>Wins the collection for <strong>{auctionUsd(result.bid)}</strong></p></>:<p>No positive bids. The collection remains unsold.</p>}<small>Results follow in a moment…</small>{won&&<div className="auction-confetti" aria-hidden="true">{Array.from({length:40},(_,index)=>{
  const angle=index*Math.PI*2/40,distance=180+index%5*45;
  return <i key={index} style={{'--confetti-x':`${Math.cos(angle)*distance}px`,'--confetti-y':`${Math.sin(angle)*distance+160}px`,'--confetti-turn':`${index%2?540:-540}deg`,animationDelay:`${index%4*.03}s`} as CSSProperties}/>;
 })}</div>}</section>;
}
