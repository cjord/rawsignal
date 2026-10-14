"use client";
import {useEffect,useMemo,useReducer,useRef,useState} from "react";
import {GamesShell} from "./GamesView";
import DeferredImage from "./DeferredImage";
import {useArtTilt} from "./hooks/useArtTilt";
import {useCatalogPage} from "./data/useCatalogPage";
import {parseCards} from "../core/domain/contracts";
import type {Card} from "../core/domain/types";
import {allowedRarities} from "../core/market-state";
import {drawPriceRound,initialPriceGame,priceGamePool,priceGameReducer,priceGameWinner,type PriceGameCard,type PriceGameDifficulty} from "../core/domain/price-game";

const sources=allowedRarities.riftbound.map(section=>`/data/${section}.json`);
const cardKey=(card:Card)=>`${card.productId}:${card.printing}`;
const usd=(value:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(value);

function Choice({card,revealed,winner,selected,onChoose,buttonRef}:{card:PriceGameCard;revealed:boolean;winner:boolean;selected:boolean;onChoose:(keyboard:boolean)=>void;buttonRef?:(element:HTMLButtonElement|null)=>void}){
 const [artRef,tilt]=useArtTilt();
 return <button ref={buttonRef} type="button" className={`price-game-choice${revealed&&winner?" is-correct":""}${revealed&&selected&&!winner?" is-wrong":""}`} aria-disabled={revealed} onClick={event=>{if(!revealed)onChoose(event.detail===0)}} aria-label={revealed?`${card.name}, ${usd(card.marketPrice)}${winner?", highest price":""}`:`Choose ${card.name}`}>
  <b className="price-game-name">{card.name}</b><div className="price-game-art" ref={artRef} {...tilt}><DeferredImage src={card.image} alt=""/></div>
  <span className="price-game-reveal">{revealed&&<><strong>{usd(card.marketPrice)}</strong><small>{winner?"Highest price":selected?"Your pick":"Market price"}</small></>}</span>
 </button>;
}

function GameSession({pool,difficulty}:{pool:PriceGameCard[];difficulty:PriceGameDifficulty}){
 const [state,dispatch]=useReducer(priceGameReducer,pool,cards=>initialPriceGame(drawPriceRound(cards,difficulty)));
 const [auto,setAuto]=useState(true),firstButton=useRef<HTMLButtonElement|null>(null),restoreFocus=useRef(false);
 const winner=priceGameWinner(state.round),revealed=state.selected!=null,correct=state.selected===winner?.productId;
 const next=()=>dispatch({type:"next",round:drawPriceRound(pool,difficulty,state.round.map(card=>card.productId))});
 useEffect(()=>{
  if(!revealed||!auto)return;
  let timer:number|undefined;
  const schedule=()=>{window.clearTimeout(timer);if(!document.hidden)timer=window.setTimeout(()=>dispatch({type:"next",round:drawPriceRound(pool,difficulty,state.round.map(card=>card.productId))}),1000)};
  schedule();document.addEventListener("visibilitychange",schedule);
  return()=>{window.clearTimeout(timer);document.removeEventListener("visibilitychange",schedule)};
 },[revealed,auto,pool,difficulty,state.round]);
 useEffect(()=>{if(restoreFocus.current){firstButton.current?.focus({preventScroll:true});restoreFocus.current=false}},[state.roundNumber]);
 if(!state.round.length)return <p role="status">Not enough distinct priced cards are available for this mode. Try Normal or reload the catalog.</p>;
 return <section aria-label="Price comparison game">
  <div className="price-game-toolbar"><dl className="price-game-score"><div><dt>Total correct</dt><dd>{state.correct}</dd></div><div><dt>Streak</dt><dd>{state.streak}</dd></div><div><dt>Round</dt><dd>{state.roundNumber}</dd></div></dl><label className="price-game-auto"><input type="checkbox" checked={auto} onChange={event=>setAuto(event.target.checked)}/> Auto next round (1s)</label></div>
  <p className="price-game-result" role="status" aria-live="polite" aria-atomic="true">{revealed?`${correct?"Correct!":"Not quite."} ${winner?.name} has the highest price at ${usd(winner!.marketPrice)}.`:"Which card has the highest market price?"}</p>
  <div className={`price-game-round mode-${difficulty}`}>{state.round.map((card,index)=><Choice key={`${state.roundNumber}:${card.productId}`} card={card} revealed={revealed} winner={card.productId===winner?.productId} selected={card.productId===state.selected} buttonRef={index===0?element=>{firstButton.current=element}:undefined} onChoose={keyboard=>{restoreFocus.current=keyboard;dispatch({type:"answer",productId:card.productId})}}/>)}</div>
  <div className="price-game-next"><button type="button" className="game-control" disabled={!revealed} onClick={()=>{restoreFocus.current=true;next()}}>Next round →</button><span className="games-note">{state.attempts} answered · {state.attempts?Math.round(state.correct/state.attempts*100):0}% correct</span></div>
 </section>;
}

export default function RiftboundPriceGame(){
 const {items,status,reload}=useCatalogPage({sources,parse:parseCards,keyOf:cardKey});
 const [difficulty,setDifficulty]=useState<PriceGameDifficulty>("normal"),[session,setSession]=useState(0);
 // Keep the pool identity stable while score and reveal controls change.
 const pool=useMemo(()=>priceGamePool(items,"riftbound"),[items]);
 return <GamesShell><a className="games-back" href="/games">← Games</a><header className="games-heading"><span className="games-eyebrow">Riftbound · Singles</span><h1>Riftbound Price Showdown</h1><p>Artwork and names are your clues. Pick the most expensive card to build your streak.</p></header>
  <div className="price-game-controls">
   <label>Difficulty <select disabled={status==="loading"} value={difficulty} onChange={event=>setDifficulty(event.target.value as PriceGameDifficulty)}><option value="normal">Normal · 2 cards</option><option value="hard">Hard · 3 cards</option></select></label>
   <button className="game-control" type="button" disabled={status==="loading"} onClick={()=>setSession(value=>value+1)}>Restart game</button>
   <span className="games-note">Changing difficulty starts a new score.</span>
  </div>
  {status==="loading"&&<p role="status">Loading Riftbound cards…</p>}
  {(status==="error"||status==="empty")&&<p role="status">Card prices are unavailable. <button type="button" className="game-control" onClick={reload}>Try again</button></p>}
  {status==="success"&&pool.length>0&&<GameSession key={`${difficulty}:${session}`} pool={pool} difficulty={difficulty}/>}
  {status==="success"&&!pool.length&&<p role="status">No eligible priced cards are available.</p>}
  <p className="games-note">TCGCSV / TCGplayer market prices in USD, frozen when this page loads—not completed-sale prices. Missing prices and ambiguous printings are excluded. Scores last for this session.</p>
 </GamesShell>;
}
