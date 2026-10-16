"use client";
import {useMemo,useState} from "react";
import {GamesShell} from "./GamesView";
import SlidingTabs from "./SlidingTabs";
import {CheckboxGrid} from "./filters/CheckboxGrid";
import GameSession from "./games/PriceShowdownSession";
import PriceShowdownSkeleton from "./games/PriceShowdownSkeleton";
import {useCatalogPage} from "./data/useCatalogPage";
import {createPriceGameImageLoader} from "./data/price-game-images";
import {parseCards} from "../core/domain/contracts";
import type {Card} from "../core/domain/types";
import {allowedRarities} from "../core/market-state";
import {priceGamePool,type PriceGameDifficulty} from "../core/domain/price-game";

const sources=allowedRarities.riftbound.map(section=>`/data/${section}.json`);
const cardKey=(card:Card)=>`${card.productId}:${card.printing}`;
const difficultyOptions=[{key:"normal",label:"Normal · 2 cards"},{key:"hard",label:"Hard · 3 cards"}];

export default function RiftboundPriceGame(){
 const {items,status,reload}=useCatalogPage({sources,parse:parseCards,keyOf:cardKey});
 const [difficulty,setDifficulty]=useState<PriceGameDifficulty>("normal"),[session,setSession]=useState(0),[auto,setAuto]=useState(true);
 const pool=useMemo(()=>priceGamePool(items,"riftbound"),[items]),images=useMemo(()=>createPriceGameImageLoader(),[]);
 return <GamesShell><a className="games-back" href="/games">← Games</a><header className="games-heading"><span className="games-eyebrow">Riftbound · Singles</span><h1>Riftbound Price Showdown</h1><p>How well do you know the market? Pick the most valuable card to build your streak.</p></header>
  <div className="price-game-controls">
   <SlidingTabs options={difficultyOptions} selectedKey={difficulty} onSelect={key=>setDifficulty(key as PriceGameDifficulty)} label="Difficulty" className="price-game-difficulty market-tabs" disabled={status==="loading"}/>
   <CheckboxGrid className="set-option-grid price-game-auto" options={[{key:"auto",label:"Auto next round (1s)"}]} selected={auto?["auto"]:[]} onToggle={()=>setAuto(value=>!value)}/>
   <button className="game-control price-game-restart" type="button" disabled={status==="loading"} onClick={()=>setSession(value=>value+1)}>Restart Game</button>
  </div>
  <p className="games-note price-game-mode-note"><span>Changing difficulty resets your streak and score.</span> <a className="games-back" href="/games/riftbound-price/daily">Play the Daily Challenge →</a></p>
  {status==="loading"&&<><p role="status">Loading Riftbound cards…</p><PriceShowdownSkeleton difficulty={difficulty}/></>}
  {(status==="error"||status==="empty")&&<p role="status">Card prices are unavailable. <button type="button" className="game-control" onClick={reload}>Try again</button></p>}
  {status==="success"&&pool.length>0&&<GameSession key={`${difficulty}:${session}`} pool={pool} difficulty={difficulty} images={images} auto={auto}/>}
  {status==="success"&&!pool.length&&<p role="status">No eligible priced cards are available.</p>}
  <p className="games-note">TCGCSV / TCGplayer market prices in USD, frozen when this page loads—not completed-sale prices. Missing prices, unavailable artwork and ambiguous printings are excluded. Scores last for this session.</p>
 </GamesShell>;
}
