"use client";
/* eslint-disable @next/next/no-img-element -- verified game artwork reuses the browser image cache */
import {useCallback,useEffect,useReducer,useRef,useState} from "react";
import {CheckboxGrid} from "../filters/CheckboxGrid";
import {useArtTilt} from "../hooks/useArtTilt";
import {preparePriceRound,type PriceGameImageLoader} from "../data/price-game-images";
import {isTcgplayerPlaceholder} from "../../core/domain/image-availability";
import {initialPriceGame,priceGameReducer,priceGameWinner,type PriceGameCard,type PriceGameDifficulty} from "../../core/domain/price-game";

const usd=(value:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(value);

function Choice({card,locked,revealed,winner,selected,onChoose,onReady,onFailed,buttonRef}:{card:PriceGameCard;locked:boolean;revealed:boolean;winner:boolean;selected:boolean;onChoose:(keyboard:boolean)=>void;onReady:()=>void;onFailed:()=>void;buttonRef?:(element:HTMLButtonElement|null)=>void}){
 const [artRef,tilt]=useArtTilt();
 return <button ref={buttonRef} type="button" className={`price-game-choice${revealed&&winner?" is-correct":""}${revealed&&selected&&!winner?" is-wrong":""}`} aria-disabled={locked} onClick={event=>{if(!locked)onChoose(event.detail===0)}} aria-label={revealed?`${card.name}, ${usd(card.marketPrice)}${winner?", highest price":""}`:`Choose ${card.name}`}>
  <b className="price-game-name">{card.name}</b><div className="price-game-art" ref={artRef} {...tilt}><span className="price-game-image"><img src={card.image} alt="" decoding="async" loading="eager" onError={onFailed} onLoad={event=>{if(isTcgplayerPlaceholder(event.currentTarget))onFailed();else onReady()}}/></span></div>
  <span className="price-game-reveal">{revealed&&<><strong>{usd(card.marketPrice)}</strong><small>{winner?"Highest price":selected?"Your pick":"Market price"}</small></>}</span>
 </button>;
}

function RoundChoices({round,difficulty,selected,preparing,onChoose,onFailed,firstButton}:{round:PriceGameCard[];difficulty:PriceGameDifficulty;selected:number|null;preparing:boolean;onChoose:(card:PriceGameCard,keyboard:boolean)=>void;onFailed:(image:string)=>void;firstButton:React.RefObject<HTMLButtonElement|null>}){
 const [ready,setReady]=useState<number[]>([]);
 const allReady=round.every(card=>ready.includes(card.productId)),winner=priceGameWinner(round),revealed=selected!=null;
 return <div className={`price-game-round mode-${difficulty}`} aria-busy={preparing||!allReady}>
  {!allReady&&<span className="sr-only" role="status">Loading card artwork…</span>}
  {round.map((card,index)=><Choice key={card.productId} card={card} locked={revealed||preparing||!allReady} revealed={revealed} winner={card.productId===winner?.productId} selected={card.productId===selected} buttonRef={index===0?element=>{firstButton.current=element}:undefined} onChoose={keyboard=>onChoose(card,keyboard)} onReady={()=>setReady(previous=>previous.includes(card.productId)?previous:[...previous,card.productId])} onFailed={()=>{setReady(previous=>previous.filter(id=>id!==card.productId));onFailed(card.image)}}/>)}
 </div>;
}

export default function GameSession({pool,difficulty,images}:{pool:PriceGameCard[];difficulty:PriceGameDifficulty;images:PriceGameImageLoader}){
 const [state,dispatch]=useReducer(priceGameReducer,initialPriceGame([]));
 const [preparing,setPreparing]=useState(true),[error,setError]=useState(false),[auto,setAuto]=useState(true);
 const firstButton=useRef<HTMLButtonElement|null>(null),restoreFocus=useRef(false),request=useRef<AbortController|null>(null);
 const winner=priceGameWinner(state.round),revealed=state.selected!=null,correct=state.selected===winner?.productId;
 useEffect(()=>{
  const controller=new AbortController();request.current=controller;
  preparePriceRound(pool,difficulty,[],images,controller.signal).then(round=>{
   if(controller.signal.aborted)return;
   dispatch({type:"replace",round});setError(!round.length);setPreparing(false);
  }).catch(()=>{if(!controller.signal.aborted){setError(true);setPreparing(false)}});
  return()=>{request.current?.abort()};
 },[pool,difficulty,images]);
 const advance=useCallback(async()=>{
  request.current?.abort();const controller=new AbortController();request.current=controller;
  setPreparing(true);setError(false);
  try{
   const round=await preparePriceRound(pool,difficulty,state.round.map(card=>card.productId),images,controller.signal);
   if(controller.signal.aborted)return;
   if(round.length)dispatch({type:revealed?"next":"replace",round});else setError(true);
  }catch{if(!controller.signal.aborted)setError(true)}
  finally{if(!controller.signal.aborted)setPreparing(false)}
 },[pool,difficulty,images,state.round,revealed]);
 useEffect(()=>{
  if(!revealed||!auto||preparing||error)return;
  let timer:number|undefined;
  const schedule=()=>{window.clearTimeout(timer);if(!document.hidden)timer=window.setTimeout(()=>void advance(),1000)};
  schedule();document.addEventListener("visibilitychange",schedule);
  return()=>{window.clearTimeout(timer);document.removeEventListener("visibilitychange",schedule)};
 },[revealed,auto,preparing,error,advance]);
 useEffect(()=>{if(restoreFocus.current){firstButton.current?.focus({preventScroll:true});restoreFocus.current=false}},[state.roundNumber]);
 return <section aria-label="Price comparison game">
  <div className="price-game-toolbar"><dl className="price-game-score">
   <div className="detail-metric price-game-stat stat-correct"><dt><span aria-hidden="true">✓</span>Total correct</dt><dd>{state.correct}</dd></div>
   <div className="detail-metric price-game-stat stat-streak"><dt><span aria-hidden="true">↗</span>Streak</dt><dd>{state.streak}</dd></div>
   <div className="detail-metric price-game-stat stat-round"><dt><span aria-hidden="true">◇</span>Round</dt><dd>{state.roundNumber}</dd></div>
  </dl><CheckboxGrid className="set-option-grid price-game-auto" options={[{key:"auto",label:"Auto next round (1s)"}]} selected={auto?["auto"]:[]} onToggle={()=>setAuto(value=>!value)}/></div>
  <p className="price-game-result" role="status" aria-live="polite" aria-atomic="true">{revealed?`${correct?"Correct!":"Not quite."} ${winner?.name} has the highest price at ${usd(winner!.marketPrice)}.`:preparing?"Preparing card artwork…":""}</p>
  {error&&<p className="games-note" role="alert">Not enough cards with working artwork are available for this round. <button type="button" className="game-control" onClick={()=>void advance()}>Try another round</button></p>}
  {state.round.length>0&&<RoundChoices key={`${state.roundNumber}:${state.round.map(card=>card.productId).join(",")}`} round={state.round} difficulty={difficulty} selected={state.selected} preparing={preparing} firstButton={firstButton} onChoose={(card,keyboard)=>{restoreFocus.current=keyboard;dispatch({type:"answer",productId:card.productId})}} onFailed={image=>{images.exclude(image);void advance()}}/>}
  <div className="price-game-next"><button type="button" className="game-control" disabled={!revealed||preparing} onClick={()=>{restoreFocus.current=true;void advance()}}>{preparing&&revealed?"Preparing next round…":"Next round →"}</button><span className="games-note">{state.attempts} answered · {state.attempts?Math.round(state.correct/state.attempts*100):0}% correct</span></div>
 </section>;
}
